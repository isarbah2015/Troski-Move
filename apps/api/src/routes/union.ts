import { Router, type IRouter } from "express";
import { DisputeStatusBody } from "@trotrolink/shared";
import { and, count, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { requireUnion } from "../auth";
import { computeCompliance } from "../services/compliance";
import { db } from "../db";
import { conductorSessionsTable, disputesTable, ratingsTable, transactionsTable, usersTable, vehiclesTable } from "../db/schema";

const router: IRouter = Router();
router.use("/union", requireUnion);

const DAY = sql`now() - interval '24 hours'`;

/** The headline numbers for the dashboard. */
router.get("/union/overview", async (_req, res): Promise<void> => {
  const [today] = await db.select({ trips: count(), revenue: sql<string>`coalesce(sum(${transactionsTable.amountPaid}), 0)` }).from(transactionsTable).where(gt(transactionsTable.timestamp, DAY));
  const [active] = await db.execute(sql`select count(*)::int as n from active_trips`).then((r) => r.rows as Array<{ n: number }>);
  const [open] = await db.select({ n: count() }).from(disputesTable).where(eq(disputesTable.status, "open"));
  const [overcharge] = await db.select({ n: count() }).from(disputesTable).where(and(eq(disputesTable.disputeType, "overcharge"), eq(disputesTable.status, "open")));
  const [rating] = await db.select({ avg: sql<string | null>`round(avg(${ratingsTable.driverRating})::numeric, 2)`, n: count() }).from(ratingsTable).where(gt(ratingsTable.ratedAt, DAY));
  const flagged = await computeCompliance();
  const [urgent] = await db.execute(sql`select count(*)::int as n from disputes where urgent = true and status in ('open','investigating')`).then((r) => r.rows as Array<{ n: number }>);
  const [unreg] = await db.execute(sql`select count(*)::int as n from unregistered_reports where status = 'open'`).then((r) => r.rows as Array<{ n: number }>);
  res.json({
    tripsToday: today?.trips ?? 0,
    revenueToday: Number(today?.revenue ?? 0),
    activeTrips: active?.n ?? 0,
    openDisputes: open?.n ?? 0,
    openOvercharges: overcharge?.n ?? 0,
    avgRating24h: rating?.avg ? Number(rating.avg) : null,
    ratings24h: rating?.n ?? 0,
    flaggedVehicles: flagged.filter((v) => v.severity !== "ok").length,
    suspendedVehicles: flagged.filter((v) => v.status === "suspended").length,
    unregisteredOpen: unreg?.n ?? 0,
    urgentAlerts: urgent?.n ?? 0,
  });
});

router.get("/union/transactions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ t: transactionsTable, code: vehiclesTable.shortCode })
    .from(transactionsTable)
    .innerJoin(vehiclesTable, eq(transactionsTable.vehicleId, vehiclesTable.id))
    .orderBy(desc(transactionsTable.timestamp))
    .limit(200);
  res.json({
    transactions: rows.map(({ t, code }) => ({
      tripRef: t.tripRef,
      at: t.timestamp,
      vehicle: code,
      from: t.boardingStop,
      to: t.alightingStop,
      customStop: t.customStopNote,
      officialFare: Number(t.officialFare),
      paid: Number(t.amountPaid),
      arrivedAt: t.arrivedAt,
      gps: t.alightGps ? { status: t.alightGps, distanceM: t.alightDistanceM } : null,
    })),
  });
});

router.get("/union/disputes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt)).limit(200);
  res.json({ disputes: rows });
});

router.post("/union/disputes/:id/status", async (req, res): Promise<void> => {
  const parsed = DisputeStatusBody.safeParse(req.body);
  const id = Number(req.params["id"]);
  if (!parsed.success || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  await db.update(disputesTable).set({ status: parsed.data.status }).where(eq(disputesTable.id, id));
  res.json({ ok: true });
});

/** Per-vehicle rating analytics and the latest comments. */
router.get("/union/ratings", async (_req, res): Promise<void> => {
  const perVehicle = await db
    .select({
      vehicle: vehiclesTable.shortCode,
      driver: vehiclesTable.driverName,
      avgDriver: sql<string>`round(avg(${ratingsTable.driverRating})::numeric, 2)`,
      avgConductor: sql<string>`round(avg(${ratingsTable.conductorRating})::numeric, 2)`,
      n: count(),
    })
    .from(ratingsTable)
    .innerJoin(vehiclesTable, eq(ratingsTable.vehicleId, vehiclesTable.id))
    .groupBy(vehiclesTable.id, vehiclesTable.shortCode, vehiclesTable.driverName)
    .orderBy(desc(sql`avg(${ratingsTable.driverRating})`));
  const comments = await db
    .select({ vehicle: vehiclesTable.shortCode, driver: ratingsTable.driverRating, conductor: ratingsTable.conductorRating, comment: ratingsTable.comment, at: ratingsTable.ratedAt })
    .from(ratingsTable)
    .innerJoin(vehiclesTable, eq(ratingsTable.vehicleId, vehiclesTable.id))
    .where(isNotNull(ratingsTable.comment))
    .orderBy(desc(ratingsTable.ratedAt))
    .limit(30);
  res.json({ vehicles: perVehicle.map((v) => ({ ...v, avgDriver: Number(v.avgDriver), avgConductor: Number(v.avgConductor) })), comments });
});

/** Where passengers say they actually get off, between anchors: candidates for new anchors. */
router.get("/union/stop-suggestions", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ after: transactionsTable.alightingStop, note: sql<string>`lower(trim(${transactionsTable.customStopNote}))`, n: count(), vehicle: sql<string>`min(${vehiclesTable.shortCode})` })
    .from(transactionsTable)
    .innerJoin(vehiclesTable, eq(transactionsTable.vehicleId, vehiclesTable.id))
    .where(isNotNull(transactionsTable.customStopNote))
    .groupBy(transactionsTable.alightingStop, sql`lower(trim(${transactionsTable.customStopNote}))`)
    .orderBy(desc(count()))
    .limit(100);
  res.json({ suggestions: rows });
});

/** Conductors and their sign-in state, for PIN resets. */
router.get("/union/conductors", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ vehicle: vehiclesTable.shortCode, name: vehiclesTable.conductorName, driver: vehiclesTable.driverName, user: usersTable })
    .from(vehiclesTable)
    .leftJoin(usersTable, eq(usersTable.conductorVehicleCode, vehiclesTable.shortCode))
    .orderBy(vehiclesTable.shortCode);
  res.json({
    conductors: rows.map((r) => ({
      vehicle: r.vehicle,
      conductor: r.name,
      driver: r.driver,
      hasPin: !!r.user?.conductorPinHash,
      lastLoginAt: r.user?.lastLoginAt ?? null,
      lockedUntil: r.user?.lockedUntil && r.user.lockedUntil > new Date() ? r.user.lockedUntil : null,
    })),
  });
});

/**
 * Resets a conductor's PIN: the old PIN stops working, every session is ended and the lockout cleared. The conductor
 * then taps "First time? Set up your PIN" and chooses a new one (needing the setup code, if one is configured).
 */
router.post("/union/conductors/:vehicle/reset-pin", async (req, res): Promise<void> => {
  const vehicle = String(req.params["vehicle"]).toUpperCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.conductorVehicleCode, vehicle));
  if (!user) {
    res.status(404).json({ error: "No conductor has set up this vehicle yet" });
    return;
  }
  await db.delete(conductorSessionsTable).where(eq(conductorSessionsTable.conductorId, user.id));
  await db.update(usersTable).set({ conductorPinHash: null, conductorVehicleCode: null, failedPinAttempts: 0, lockedUntil: null, phone: `reset-${user.id}-${vehicle}` }).where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
