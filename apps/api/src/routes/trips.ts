import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { AlightBody, GuestBody, StartTripBody, StopMarkBody, type HistoryTrip, type ServerTrip } from "@trotrolink/shared";
import { db } from "../db";
import { activeTripsTable, ratingsTable, routesTable, transactionsTable, tripEventsTable, vehiclesTable } from "../db/schema";
import { checkTrip, etaBetween, guestUserId, insertTrip, newTripRef, stopIndex, userExists, vehicleWithRoute } from "../lib";

const router: IRouter = Router();

/** Anonymous identity for a device, until phone OTP accounts exist. */
router.post("/guests", async (req, res): Promise<void> => {
  const parsed = GuestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  res.json({ userId: await guestUserId(parsed.data.deviceId, parsed.data.role) });
});

/** Passenger has paid: record the transaction and start an active trip. Safe to retry with the same `tripId`. */
router.post("/trips/start", async (req, res): Promise<void> => {
  // Real trips are created by a successful payment (POST /api/payments/*). This unpaid shortcut is dev-only.
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = StartTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const found = await vehicleWithRoute(body.vehicleCode);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const stops = found.route.stopsJson;
  const check = checkTrip(stops, body.boardingStop, body.alightingStop, body.amountPaid);
  if (!check.ok) {
    res.status(400).json({ error: check.error, ...(check.officialFare !== undefined ? { officialFare: check.officialFare } : {}) });
    return;
  }
  const { from, to, officialFare } = check;

  let passengerId = body.passengerId;
  if (passengerId === undefined) passengerId = await guestUserId(body.deviceId!, "passenger");
  else if (!(await userExists(passengerId))) {
    res.status(404).json({ error: "Passenger not found" });
    return;
  }

  const tripRef = body.tripId ?? newTripRef();
  const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, tripRef));
  if (existing) {
    if (existing.passengerId !== passengerId) {
      res.status(409).json({ error: "Trip reference already used" });
      return;
    }
    res.json({ tripId: tripRef, startedAt: existing.timestamp.toISOString(), passengerId });
    return;
  }

  const startedAt = await db.transaction(async (tx) => {
    const t = await insertTrip(tx, { vehicleId: found.vehicle.id, passengerId: passengerId!, stops, from, to, officialFare, amountPaid: body.amountPaid, tripRef });
    return t.timestamp;
  });

  res.json({ tripId: tripRef, startedAt: startedAt.toISOString(), passengerId });
});

/**
 * Conductor marks the anchor the vehicle is at. Every active trip on the vehicle whose boarding stop is
 * behind it moves forward (never backward, and never past the passenger's own stop).
 */
// TODO(MUST FIX before launch): authenticate the conductor and check they work this vehicle. Today anyone can post a stop mark.
router.post("/trips/stop", async (req, res): Promise<void> => {
  const parsed = StopMarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;

  const found = await vehicleWithRoute(body.vehicleCode);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const stops = found.route.stopsJson;
  const at = stopIndex(stops, body.stopName);
  if (at < 0) {
    res.status(400).json({ error: "Unknown stop for this route" });
    return;
  }

  let conductorId: number | null = null;
  if (body.conductorId !== undefined) {
    if (!(await userExists(body.conductorId))) {
      res.status(404).json({ error: "Conductor not found" });
      return;
    }
    conductorId = body.conductorId;
  } else if (body.deviceId) {
    conductorId = await guestUserId(body.deviceId, "conductor");
  }

  const passengersNotified = await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, eventType: "stop_reached", stopName: stops[at]!.name });

    const active = await tx
      .select({ trip: activeTripsTable, boardingStop: transactionsTable.boardingStop })
      .from(activeTripsTable)
      .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
      .where(eq(activeTripsTable.vehicleId, found.vehicle.id));

    let notified = 0;
    for (const { trip, boardingStop } of active) {
      const board = boardingStop ? stopIndex(stops, boardingStop) : 0;
      const alight = stopIndex(stops, trip.alightingStop);
      const current = stopIndex(stops, trip.currentStop);
      const target = Math.min(at, alight);
      if (at < board || target <= current) {
        await tx.update(activeTripsTable).set({ lastStopMarkedAt: now, conductorId }).where(eq(activeTripsTable.id, trip.id));
        continue;
      }
      await tx
        .update(activeTripsTable)
        .set({ currentStop: stops[target]!.name, etaMinutes: etaBetween(stops, target, alight), lastStopMarkedAt: now, conductorId })
        .where(eq(activeTripsTable.id, trip.id));
      if (target === alight) {
        await tx.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, tripId: trip.transactionId, eventType: "arrived", stopName: stops[alight]!.name });
      }
      notified += 1;
    }
    return notified;
  });

  res.json({ ok: true, passengersNotified });
});

/** Active trips, by vehicle (conductor's passenger count), by trip (a passenger's own state) or by passenger. */
router.get("/trips/active", async (req, res): Promise<void> => {
  const vehicleCode = typeof req.query["vehicleCode"] === "string" ? req.query["vehicleCode"].toUpperCase() : null;
  const tripId = typeof req.query["tripId"] === "string" ? req.query["tripId"] : null;
  const passengerId = typeof req.query["passengerId"] === "string" ? Number(req.query["passengerId"]) : null;
  if (!vehicleCode && !tripId && !(passengerId && Number.isInteger(passengerId))) {
    res.status(400).json({ error: "Provide vehicleCode, tripId or passengerId" });
    return;
  }

  const filter = vehicleCode
    ? eq(vehiclesTable.shortCode, vehicleCode)
    : tripId
      ? eq(transactionsTable.tripRef, tripId)
      : eq(activeTripsTable.passengerId, passengerId!);

  const rows = await db
    .select({ trip: activeTripsTable, tripRef: transactionsTable.tripRef, boardingStop: transactionsTable.boardingStop, code: vehiclesTable.shortCode, stops: routesTable.stopsJson })
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .innerJoin(vehiclesTable, eq(activeTripsTable.vehicleId, vehiclesTable.id))
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(filter)
    .orderBy(desc(activeTripsTable.startedAt));

  const trips: ServerTrip[] = rows.map(({ trip, tripRef, boardingStop, code, stops }) => ({
    tripId: tripRef ?? `TRX-${trip.transactionId}`,
    passengerId: trip.passengerId,
    vehicleCode: code,
    boardingStop: boardingStop ?? stops[0]!.name,
    alightingStop: trip.alightingStop,
    currentStop: trip.currentStop,
    stopsRemaining: Math.max(0, stopIndex(stops, trip.alightingStop) - stopIndex(stops, trip.currentStop)),
    etaMinutes: trip.etaMinutes,
    startedAt: trip.startedAt.toISOString(),
    lastStopMarkedAt: trip.lastStopMarkedAt?.toISOString() ?? null,
  }));
  res.json({ trips });
});

/** Passenger confirms they got off. Ends the active trip; rating is separate and optional. */
router.post("/trips/alight", async (req, res): Promise<void> => {
  const parsed = AlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, parsed.data.tripId));
  if (!t) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  await endTrip(t.id, t.vehicleId, t.alightingStop);
  res.json({ ok: true });
});

/** Stamps `arrived_at` (once), removes the active row and logs `alighted`. Idempotent. */
export async function endTrip(transactionId: number, vehicleId: number, stopName: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(transactionsTable)
      .set({ arrivedAt: sql`coalesce(${transactionsTable.arrivedAt}, now())` })
      .where(eq(transactionsTable.id, transactionId));
    const removed = await tx.delete(activeTripsTable).where(eq(activeTripsTable.transactionId, transactionId)).returning({ id: activeTripsTable.id });
    if (removed.length > 0) {
      await tx.insert(tripEventsTable).values({ vehicleId, tripId: transactionId, eventType: "alighted", stopName });
    }
  });
}

/** A passenger's last 50 trips, each with the rating they gave. */
router.get("/trips/history", async (req, res): Promise<void> => {
  const passengerId = Number(req.query["passengerId"]);
  if (!Number.isInteger(passengerId)) {
    res.status(400).json({ error: "passengerId is required" });
    return;
  }
  const rows = await db
    .select({ t: transactionsTable, code: vehiclesTable.shortCode, routeName: routesTable.routeName, r: ratingsTable })
    .from(transactionsTable)
    .innerJoin(vehiclesTable, eq(transactionsTable.vehicleId, vehiclesTable.id))
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .leftJoin(ratingsTable, eq(ratingsTable.transactionId, transactionsTable.id))
    .where(and(eq(transactionsTable.passengerId, passengerId)))
    .orderBy(desc(transactionsTable.timestamp))
    .limit(50);

  const trips: HistoryTrip[] = rows.map(({ t, code, routeName, r }) => ({
    tripId: t.tripRef ?? `TRX-${t.id}`,
    vehicleCode: code,
    routeName,
    boardingStop: t.boardingStop ?? "",
    alightingStop: t.alightingStop,
    startedAt: t.timestamp.toISOString(),
    officialFare: Number(t.officialFare),
    amountPaid: Number(t.amountPaid),
    arrivedAt: t.arrivedAt?.toISOString() ?? null,
    rating: r ? { driverRating: r.driverRating, conductorRating: r.conductorRating, comment: r.comment } : null,
  }));
  res.json({ trips });
});

export default router;
