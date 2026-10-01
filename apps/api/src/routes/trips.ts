import { Router, type IRouter } from "express";
import { and, countDistinct, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { alightCheck, AlightBody, AT_STOP_RADIUS_M, ExtendBody, GuestBody, nearestStop, PositionBody, StartTripBody, StopMarkBody, type HistoryTrip, type RouteStop, type ServerTrip } from "@trotrolink/shared";
import { db } from "../db";
import { activeTripsTable, ratingsTable, routesTable, transactionsTable, tripEventsTable, usersTable, vehiclesTable } from "../db/schema";
import { conductorFromRequest, conductorOf, ownsVehicle, requireConductor } from "../auth";
import { isSimulator } from "../services/momo";
import { sendPush } from "../services/push";
import { initiateExtension } from "./payments";
import { amountDue, checkTrip, etaBetween, round2, guestUserId, insertTrip, newTripRef, reverseStops, stopIndex, userExists, vehicleWithRoute } from "../lib";
import { activeFareTable, overlayFares } from "../services/fares";

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
  const check = checkTrip(stops, body.boardingStop, body.alightingStop, body.amountPaid, found.pairs);
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

type FoundVehicle = NonNullable<Awaited<ReturnType<typeof vehicleWithRoute>>>;

/**
 * The vehicle has reached the stop at index `at`: every active trip on it moves forward (never backward, never past
 * its own stop). A trip whose stop is behind `at` starts an overstay, which can end in an automatic extra charge, so
 * only a signed-in conductor's phone, or several passengers' phones agreeing, may call this.
 */
async function applyStopMark(found: FoundVehicle, at: number, conductorId: number | null): Promise<number> {
  const pushes: Array<{ token: string | null; title: string; body: string }> = [];
  const stops = found.route.stopsJson;
  const passengersNotified = await db.transaction(async (tx) => {
    const now = new Date();
    await tx.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, eventType: "stop_reached", stopName: stops[at]!.name });

    const active = await tx
      .select({ trip: activeTripsTable, boardingStop: transactionsTable.boardingStop, pushToken: usersTable.pushToken })
      .from(activeTripsTable)
      .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
      .innerJoin(usersTable, eq(activeTripsTable.passengerId, usersTable.id))
      .where(eq(activeTripsTable.vehicleId, found.vehicle.id));

    let notified = 0;
    for (const { trip, boardingStop, pushToken } of active) {
      const board = boardingStop ? stopIndex(stops, boardingStop) : 0;
      const alight = stopIndex(stops, trip.alightingStop);
      const current = stopIndex(stops, trip.currentStop);
      const target = Math.min(at, alight);
      // The vehicle is past this passenger's stop and they are still on the trip: start (or advance) the overstay.
      if (at > alight && alight >= 0) {
        // The vehicle is past their stop. That alone is not proof they are still on it (they may have got off without
        // pressing anything), so an overstay needs their own phone to be travelling with the vehicle at or beyond `at`.
        if (!trip.overstayStop) {
          const [seen] = await tx
            .select({ id: tripEventsTable.id })
            .from(tripEventsTable)
            .where(and(eq(tripEventsTable.tripId, trip.transactionId), eq(tripEventsTable.eventType, "gps_report"), inArray(tripEventsTable.stopName, stops.slice(at).map((x) => x.name)), gt(tripEventsTable.createdAt, new Date(Date.now() - 5 * 60_000))))
            .limit(1);
          if (!seen) {
            await tx.update(activeTripsTable).set({ currentStop: stops[alight]!.name, etaMinutes: 0, lastStopMarkedAt: now }).where(eq(activeTripsTable.id, trip.id));
            continue;
          }
        }
        const furthest = trip.overstayStop ? Math.max(at, stopIndex(stops, trip.overstayStop)) : at;
        await tx
          .update(activeTripsTable)
          .set({ overstayStop: stops[furthest]!.name, overstayAt: trip.overstayAt ?? now, lastStopMarkedAt: now, conductorId, currentStop: stops[alight]!.name, etaMinutes: 0 })
          .where(eq(activeTripsTable.id, trip.id));
        if (!trip.overstayStop) pushes.push({ token: pushToken, title: `You have passed ${stops[alight]!.name}`, body: "Open TrotroLink to extend your trip or get off." });
        notified += 1;
        continue;
      }
      if (at < board || target <= current) {
        await tx.update(activeTripsTable).set({ lastStopMarkedAt: now, conductorId }).where(eq(activeTripsTable.id, trip.id));
        continue;
      }
      await tx
        .update(activeTripsTable)
        .set({ currentStop: stops[target]!.name, etaMinutes: etaBetween(stops, target, alight), lastStopMarkedAt: now, conductorId })
        .where(eq(activeTripsTable.id, trip.id));
      if (alight - target === 1) pushes.push({ token: pushToken, title: "Your stop is next", body: `Get ready to get off at ${stops[alight]!.name}.` });
      if (target === alight) {
        pushes.push({ token: pushToken, title: "You have arrived", body: `This is your stop, ${stops[alight]!.name}.` });
        await tx.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, tripId: trip.transactionId, eventType: "arrived", stopName: stops[alight]!.name });
      }
      notified += 1;
    }
    return notified;
  });

  // After the database commit; never let a slow push service delay the caller.
  for (const p of pushes) void sendPush(p.token, p.title, p.body);
  return passengersNotified;
}

/**
 * Conductor marks the anchor the vehicle is at. Every active trip on the vehicle whose boarding stop is
 * behind it moves forward (never backward, and never past the passenger's own stop).
 */
/** Conductor-only: the signed-in conductor can mark stops for their own vehicle and nobody else's. */
router.post("/trips/stop", requireConductor, async (req, res): Promise<void> => {
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

  if (!ownsVehicle(res, found.vehicle.shortCode)) return;
  const conductorId = conductorOf(res).id;

  const passengersNotified = await applyStopMark(found, at, conductorId);
  res.json({ ok: true, passengersNotified });
});

/**
 * A passenger's phone says where it is, so the trip follows the road without the conductor tapping anything.
 *  - Their own trip moves forward and arrives at their stop. It never starts an overstay: a passenger who got off and is
 *    walking away must not be charged for riding on.
 *  - Their report is also evidence about the vehicle. Once two different passengers' phones agree the trotro has reached
 *    a stop, the vehicle itself moves on, exactly as if the conductor's phone had said so.
 */
router.post("/trips/position", async (req, res): Promise<void> => {
  const parsed = PositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const passengerId = await guestUserId(body.deviceId, "passenger");
  const [row] = await db
    .select({ trip: activeTripsTable, tripRef: transactionsTable.tripRef, boardingStop: transactionsTable.boardingStop, code: vehiclesTable.shortCode })
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .innerJoin(vehiclesTable, eq(activeTripsTable.vehicleId, vehiclesTable.id))
    .where(and(eq(transactionsTable.tripRef, body.tripId), eq(activeTripsTable.passengerId, passengerId)));
  if (!row) {
    res.status(404).json({ error: "No active trip" });
    return;
  }
  if (body.accuracy !== undefined && body.accuracy > 100) {
    res.json({ ok: true, currentStop: row.trip.currentStop, ignored: "low_accuracy" });
    return;
  }
  const found = await vehicleWithRoute(row.code);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const stops = found.route.stopsJson;
  const hit = nearestStop(stops, { lat: body.lat, lng: body.lng }, AT_STOP_RADIUS_M);
  if (!hit) {
    res.json({ ok: true, currentStop: row.trip.currentStop });
    return;
  }
  const board = row.boardingStop ? stopIndex(stops, row.boardingStop) : 0;
  const alight = stopIndex(stops, row.trip.alightingStop);
  const current = stopIndex(stops, row.trip.currentStop);
  // Only forward progress counts, and not before the stop they boarded at.
  if (hit.index < board || hit.index <= current) {
    res.json({ ok: true, currentStop: row.trip.currentStop });
    return;
  }

  await db.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, tripId: row.trip.transactionId, eventType: "gps_report", stopName: stops[hit.index]!.name });

  let arrived = false;
  let currentStop = row.trip.currentStop;
  // Their phone is still travelling with the vehicle beyond their stop: if the vehicle itself is known to be there too,
  // that is an overstay (they can extend, or get off). A passenger who left the vehicle never gets here.
  if (alight >= 0 && hit.index > alight && !row.trip.overstayStop) {
    const [vehicleAt] = await db
      .select({ stop: tripEventsTable.stopName })
      .from(tripEventsTable)
      .where(and(eq(tripEventsTable.vehicleId, found.vehicle.id), eq(tripEventsTable.eventType, "stop_reached"), gt(tripEventsTable.createdAt, new Date(Date.now() - 6 * 3_600_000))))
      .orderBy(desc(tripEventsTable.createdAt))
      .limit(1);
    if (vehicleAt?.stop && stopIndex(stops, vehicleAt.stop) >= hit.index) {
      const now = new Date();
      await db.update(activeTripsTable).set({ overstayStop: stops[hit.index]!.name, overstayAt: now, lastStopMarkedAt: now, currentStop: stops[alight]!.name, etaMinutes: 0 }).where(eq(activeTripsTable.id, row.trip.id));
      void sendPush(await pushTokenOf(passengerId), `You have passed ${stops[alight]!.name}`, "Open TrotroLink to extend your trip or get off.");
      res.json({ ok: true, currentStop: stops[alight]!.name, arrived: false });
      return;
    }
  }
  if (alight >= 0 && !row.trip.overstayStop) {
    const target = Math.min(hit.index, alight);
    if (target > current) {
      currentStop = stops[target]!.name;
      await db.update(activeTripsTable).set({ currentStop, etaMinutes: etaBetween(stops, target, alight), lastStopMarkedAt: new Date() }).where(eq(activeTripsTable.id, row.trip.id));
      if (alight - target === 1) void sendPush(await pushTokenOf(passengerId), "Your stop is next", `Get ready to get off at ${stops[alight]!.name}.`);
      if (target === alight) {
        arrived = true;
        await db.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, tripId: row.trip.transactionId, eventType: "arrived", stopName: stops[alight]!.name });
        void sendPush(await pushTokenOf(passengerId), "You have arrived", `This is your stop, ${stops[alight]!.name}.`);
      }
    }
  }

  // Vehicle-level evidence: two different passengers' phones within five minutes, at this stop or further on.
  const [last] = await db
    .select({ stop: tripEventsTable.stopName })
    .from(tripEventsTable)
    .where(and(eq(tripEventsTable.vehicleId, found.vehicle.id), eq(tripEventsTable.eventType, "stop_reached"), gt(tripEventsTable.createdAt, new Date(Date.now() - 6 * 3_600_000))))
    .orderBy(desc(tripEventsTable.createdAt))
    .limit(1);
  const lastIndex = last?.stop ? stopIndex(stops, last.stop) : -1;
  if (hit.index > lastIndex) {
    const aheadNames = stops.slice(hit.index).map((s) => s.name);
    const [{ n } = { n: 0 }] = await db
      .select({ n: countDistinctTrips() })
      .from(tripEventsTable)
      .where(and(eq(tripEventsTable.vehicleId, found.vehicle.id), eq(tripEventsTable.eventType, "gps_report"), inArray(tripEventsTable.stopName, aheadNames), gt(tripEventsTable.createdAt, new Date(Date.now() - 5 * 60_000))));
    if (Number(n) >= 2) await applyStopMark(found, hit.index, null);
  }
  res.json({ ok: true, currentStop, arrived });
});

const countDistinctTrips = () => countDistinct(tripEventsTable.tripId);

async function pushTokenOf(userId: number): Promise<string | null> {
  const [u] = await db.select({ t: usersTable.pushToken }).from(usersTable).where(eq(usersTable.id, userId));
  return u?.t ?? null;
}

/** Active trips, by vehicle (conductor's passenger count), by trip (a passenger's own state) or by passenger. */
router.get("/trips/active", async (req, res): Promise<void> => {
  const vehicleCode = typeof req.query["vehicleCode"] === "string" ? req.query["vehicleCode"].toUpperCase() : null;
  const tripId = typeof req.query["tripId"] === "string" ? req.query["tripId"] : null;
  const passengerId = typeof req.query["passengerId"] === "string" ? Number(req.query["passengerId"]) : null;
  if (!vehicleCode && !tripId && !(passengerId && Number.isInteger(passengerId))) {
    res.status(400).json({ error: "Provide vehicleCode, tripId or passengerId" });
    return;
  }

  if (vehicleCode) {
    // The passenger list for a vehicle is for that vehicle's conductor only.
    const conductor = await conductorFromRequest(req);
    if (!conductor) {
      res.status(401).json({ error: "Sign in as a conductor" });
      return;
    }
    if (conductor.vehicleCode !== vehicleCode) {
      res.status(403).json({ error: "This is not your vehicle" });
      return;
    }
  }

  const filter = vehicleCode
    ? eq(vehiclesTable.shortCode, vehicleCode)
    : tripId
      ? eq(transactionsTable.tripRef, tripId)
      : eq(activeTripsTable.passengerId, passengerId!);

  const rows = await db
    .select({ trip: activeTripsTable, tripRef: transactionsTable.tripRef, boardingStop: transactionsTable.boardingStop, paid: transactionsTable.amountPaid, note: transactionsTable.customStopNote, code: vehiclesTable.shortCode, stops: routesTable.stopsJson, routeId: routesTable.routeId, direction: vehiclesTable.direction })
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .innerJoin(vehiclesTable, eq(activeTripsTable.vehicleId, vehiclesTable.id))
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(filter)
    .orderBy(desc(activeTripsTable.startedAt));

  const fareTable = await activeFareTable();
  const trips: ServerTrip[] = rows.map(({ trip, tripRef, boardingStop, paid, note, code, stops: seeded, routeId, direction }) => {
    // The stops in the order, and at the fares, the vehicle is running them now.
    const stops = direction === "inbound" ? reverseStops(overlayFares(routeId, seeded, fareTable)) : overlayFares(routeId, seeded, fareTable);
    return {
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
    amountPaid: Number(paid),
    customStopNote: note,
    overstay: trip.overstayStop && trip.overstayAt ? overstayInfo(trip, stops, boardingStop, Number(paid)) : null,
  };
  });
  res.json({ trips });
});

/** What extending costs (the fare to the furthest stop reached, rounded up, minus what was paid) and when it is charged automatically. */
function overstayInfo(trip: typeof activeTripsTable.$inferSelect, stops: RouteStop[], boardingStop: string | null, paid: number) {
  const from = stopIndex(stops, boardingStop ?? stops[0]!.name);
  const to = stopIndex(stops, trip.overstayStop!);
  return {
    stop: trip.overstayStop!,
    extraFare: Math.max(0, amountDue(round2(stops[to]!.fare - stops[from]!.fare)) - paid),
    deadline: new Date(trip.overstayAt!.getTime() + 60_000).toISOString(),
  };
}

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
  await recordAlightCheck(t, parsed.data.lat, parsed.data.lng);
  await endTrip(t.id, t.vehicleId, t.alightingStop);
  res.json({ ok: true });
});

/** Compares the phone's position with the declared stop and stores the result. A far result is evidence for disputes, never a block. */
async function recordAlightCheck(t: typeof transactionsTable.$inferSelect, lat?: number, lng?: number) {
  if (lat === undefined || lng === undefined) return;
  const found = await db
    .select({ stops: routesTable.stopsJson })
    .from(vehiclesTable)
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(eq(vehiclesTable.id, t.vehicleId));
  const stops = found[0]?.stops;
  const check = stops ? alightCheck(stops[stopIndex(stops, t.alightingStop)], { lat, lng }) : null;
  if (check) await db.update(transactionsTable).set({ alightDistanceM: check.distanceM, alightGps: check.status }).where(eq(transactionsTable.id, t.id));
}

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

/** The passenger chooses to pay the difference to the stop the vehicle has reached. They approve it like any MoMo payment. */
router.post("/trips/extend", async (req, res): Promise<void> => {
  const parsed = ExtendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .select({ trip: activeTripsTable, ref: transactionsTable.tripRef })
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .where(eq(transactionsTable.tripRef, parsed.data.tripId));
  if (!row?.trip.overstayStop) {
    res.status(409).json({ error: "This trip has not passed its stop" });
    return;
  }
  const payment = await initiateExtension(row.ref!, row.trip.overstayStop);
  if (!payment) {
    res.status(502).json({ error: "Could not start the payment. Try again." });
    return;
  }
  // The passenger answered, so the 60-second auto-charge must not fire a second request.
  await db.update(activeTripsTable).set({ autoExtendedAt: new Date() }).where(eq(activeTripsTable.id, row.trip.id));
  res.json({ referenceId: payment.referenceId, tripId: payment.tripRef, status: payment.status, simulator: isSimulator() });
});

/** "Get off now": the passenger ends the trip at their declared stop, even though the vehicle went on. */
router.post("/trips/getoff", async (req, res): Promise<void> => {
  const parsed = AlightBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, parsed.data.tripId));
  if (!t) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  await recordAlightCheck(t, parsed.data.lat, parsed.data.lng);
  await endTrip(t.id, t.vehicleId, t.alightingStop);
  res.json({ ok: true });
});

/**
 * The conductor confirms an overstaying passenger is getting off here: the trip closes, and the difference to this
 * stop is charged to the passenger (so a passenger who ignores the prompt still pays for the ride they took).
 */
router.post("/trips/confirm-alight", requireConductor, async (req, res): Promise<void> => {
  const parsed = ExtendBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .select({ trip: activeTripsTable, t: transactionsTable, code: vehiclesTable.shortCode })
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .innerJoin(vehiclesTable, eq(activeTripsTable.vehicleId, vehiclesTable.id))
    .where(eq(transactionsTable.tripRef, parsed.data.tripId));
  if (!row) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  if (!ownsVehicle(res, row.code)) return;
  if (row.trip.overstayStop && !row.trip.autoExtendedAt) await initiateExtension(parsed.data.tripId, row.trip.overstayStop);
  await endTrip(row.t.id, row.t.vehicleId, row.trip.overstayStop ?? row.t.alightingStop);
  res.json({ ok: true });
});

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

/**
 * Closes trips nobody closed: a passenger who reached their stop and never pressed "I got off" would otherwise stay on
 * the conductor's board as a paid passenger for ever, hiding a real unpaid one. Ten minutes after arriving, or four hours
 * after starting, the trip ends by itself.
 */
export async function closeStaleTrips(): Promise<number> {
  const arrivedBefore = new Date(Date.now() - 10 * 60_000);
  const startedBefore = new Date(Date.now() - 4 * 3_600_000);
  const rows = await db
    .select({ transactionId: activeTripsTable.transactionId, vehicleId: activeTripsTable.vehicleId, stop: activeTripsTable.alightingStop })
    .from(activeTripsTable)
    .where(
      sql`(${activeTripsTable.currentStop} = ${activeTripsTable.alightingStop} and ${activeTripsTable.overstayStop} is null and coalesce(${activeTripsTable.lastStopMarkedAt}, ${activeTripsTable.startedAt}) < ${arrivedBefore.toISOString()}::timestamptz) or ${activeTripsTable.startedAt} < ${startedBefore.toISOString()}::timestamptz`,
    );
  for (const r of rows) await endTrip(r.transactionId, r.vehicleId, r.stop);
  return rows.length;
}
