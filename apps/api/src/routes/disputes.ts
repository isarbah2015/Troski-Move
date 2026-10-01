import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { DisputeBody, UnpaidDisputeBody } from "@trotrolink/shared";
import { conductorOf, requireConductor, requireUnion } from "../auth";
import { db } from "../db";
import { disputesTable, routesTable, transactionsTable, tripEventsTable, usersTable, vehiclesTable } from "../db/schema";
import { guestUserId } from "../lib";

const router: IRouter = Router();

/** A passenger reports their trip. The server attaches the evidence, so the report cannot be doctored afterwards. */
router.post("/disputes", async (req, res): Promise<void> => {
  const parsed = DisputeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report", issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, b.tripId));
  if (!t) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const reporterId = await guestUserId(b.deviceId, "passenger");
  if (reporterId !== t.passengerId) {
    res.status(403).json({ error: "This is not your trip" });
    return;
  }

  const [v] = await db.select({ vehicle: vehiclesTable, routeName: routesTable.routeName }).from(vehiclesTable).innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id)).where(eq(vehiclesTable.id, t.vehicleId));
  const events = await db.select().from(tripEventsTable).where(eq(tripEventsTable.vehicleId, t.vehicleId)).orderBy(desc(tripEventsTable.createdAt)).limit(40);
  const [conductor] = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.conductorVehicleCode, v!.vehicle.shortCode));

  const evidence = {
    trip: { tripId: t.tripRef, boardingStop: t.boardingStop, alightingStop: t.alightingStop, officialFare: Number(t.officialFare), amountPaid: Number(t.amountPaid), startedAt: t.timestamp, arrivedAt: t.arrivedAt, customStopNote: t.customStopNote, alightGps: t.alightGps ? { status: t.alightGps, distanceM: t.alightDistanceM } : null },
    vehicle: { shortCode: v!.vehicle.shortCode, driverName: v!.vehicle.driverName, conductorName: v!.vehicle.conductorName, route: v!.routeName },
    conductorOnDuty: conductor ?? null,
    // The vehicle's events around this trip: every stop the conductor marked, and the passenger's milestones.
    events: events.filter((e) => e.tripId === t.id || e.tripId === null).map((e) => ({ type: e.eventType, stop: e.stopName, at: e.createdAt })),
    filedAt: new Date().toISOString(),
  };
  const [row] = await db
    .insert(disputesTable)
    .values({ transactionId: t.id, vehicleId: t.vehicleId, reporterId, disputeType: b.reason, description: b.description ?? null, evidence })
    .returning({ id: disputesTable.id });
  res.json({ ok: true, disputeId: row!.id });
});

/** A conductor reports a passenger on board who did not pay. */
router.post("/disputes/unpaid", requireConductor, async (req, res): Promise<void> => {
  const parsed = UnpaidDisputeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report" });
    return;
  }
  const { id, vehicleCode } = conductorOf(res);
  const [veh] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.shortCode, vehicleCode));
  const [row] = await db
    .insert(disputesTable)
    .values({ vehicleId: veh?.id ?? null, reporterId: id, disputeType: "unpaid_passenger", description: parsed.data.description ?? null, evidence: { vehicle: vehicleCode, filedAt: new Date().toISOString() } })
    .returning({ id: disputesTable.id });
  res.json({ ok: true, disputeId: row!.id });
});

/** For the union dashboard (later): newest first, with the evidence attached. */
router.get("/disputes", requireUnion, async (_req, res): Promise<void> => {
  const rows = await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt)).limit(200);
  res.json({ disputes: rows });
});

export default router;
