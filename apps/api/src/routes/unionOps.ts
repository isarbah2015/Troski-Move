import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { requireUnion } from "../auth";
import { db } from "../db";
import { disputesTable, fareTablesTable, routeChangesTable, routesTable, unregisteredReportsTable, usersTable, vehiclesTable, warningsTable } from "../db/schema";
import { logger } from "../logger";
import { computeCompliance, RULES } from "../services/compliance";
import { buildPercentTable, currentFares, invalidateFareCache } from "../services/fares";
import { sendPush } from "../services/push";
import { sendSms } from "../services/sms";
import { terminalFeeGhs } from "../lib";

const router: IRouter = Router();
router.use("/union", requireUnion);

const vehicleCode = (req: { params: Record<string, unknown> }) => String(req.params["code"]).toUpperCase();
async function findVehicle(code: string) {
  const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.shortCode, code));
  return v ?? null;
}

// ---- Compliance: flags, warnings, suspensions --------------------------------------------------------

router.get("/union/compliance", async (_req, res): Promise<void> => {
  res.json({ rules: RULES, vehicles: await computeCompliance() });
});

const defaultWarning = (code: string) =>
  `GPRTU OFFICIAL WARNING: Vehicle ${code} has been reported for charging above the official fare. Charge only the fare shown on TrotroLink. Repeat reports lead to suspension from the terminal.`;

router.post("/union/vehicles/:code/warn", async (req, res): Promise<void> => {
  const code = vehicleCode(req);
  const v = await findVehicle(code);
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const parsed = z.object({ message: z.string().trim().min(5).max(300).optional() }).safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid message" });
    return;
  }
  const message = parsed.data.message ?? defaultWarning(code);
  const smsStatus = await sendSms(v.driverPhone, message);
  const [row] = await db.insert(warningsTable).values({ vehicleId: v.id, message, smsStatus }).returning({ id: warningsTable.id });
  res.json({ ok: true, warningId: row!.id, smsStatus });
});

router.get("/union/warnings", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: warningsTable.id, vehicle: vehiclesTable.shortCode, driver: vehiclesTable.driverName, message: warningsTable.message, smsStatus: warningsTable.smsStatus, at: warningsTable.createdAt })
    .from(warningsTable)
    .innerJoin(vehiclesTable, eq(warningsTable.vehicleId, vehiclesTable.id))
    .orderBy(desc(warningsTable.createdAt))
    .limit(100);
  res.json({ warnings: rows });
});

router.post("/union/vehicles/:code/suspend", async (req, res): Promise<void> => {
  const code = vehicleCode(req);
  const parsed = z.object({ days: z.number().int().min(1).max(180), reason: z.string().trim().min(3).max(300) }).safeParse(req.body);
  const v = await findVehicle(code);
  if (!parsed.success || !v) {
    res.status(parsed.success ? 404 : 400).json({ error: parsed.success ? "Vehicle not found" : "Give a number of days and a reason" });
    return;
  }
  const until = new Date(Date.now() + parsed.data.days * 86_400_000);
  await db.update(vehiclesTable).set({ status: "suspended", suspendedUntil: until, suspensionReason: parsed.data.reason }).where(eq(vehiclesTable.id, v.id));
  const smsStatus = await sendSms(v.driverPhone, `GPRTU: Vehicle ${code} is suspended from the terminal until ${until.toISOString().slice(0, 10)}. Reason: ${parsed.data.reason}. Contact your terminal chairman.`);
  res.json({ ok: true, until, smsStatus });
});

router.post("/union/vehicles/:code/reinstate", async (req, res): Promise<void> => {
  const v = await findVehicle(vehicleCode(req));
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  await db.update(vehiclesTable).set({ status: "active", suspendedUntil: null, suspensionReason: null }).where(eq(vehiclesTable.id, v.id));
  res.json({ ok: true });
});

// ---- Live safety alerts: accidents and careless driving ------------------------------------------------

const ALERT_LABEL: Record<string, string> = { accident: "an accident", careless_driving: "careless driving" };

/** Open urgent reports, newest first. The dashboard polls this every few seconds. */
router.get("/union/alerts", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ d: disputesTable, code: vehiclesTable.shortCode, driver: vehiclesTable.driverName, phone: vehiclesTable.driverPhone, route: routesTable.routeName })
    .from(disputesTable)
    .innerJoin(vehiclesTable, eq(disputesTable.vehicleId, vehiclesTable.id))
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(and(eq(disputesTable.urgent, true), inArray(disputesTable.status, ["open", "investigating"])))
    .orderBy(desc(disputesTable.createdAt))
    .limit(30);
  res.json({
    alerts: rows.map(({ d, code, driver, phone, route }) => ({
      id: d.id, type: d.disputeType, status: d.status, vehicle: code, driver, driverPhone: phone, route,
      note: d.description, lat: d.lat ? Number(d.lat) : null, lng: d.lng ? Number(d.lng) : null,
      at: d.createdAt, ageSeconds: Math.round((Date.now() - d.createdAt.getTime()) / 1000), reply: d.staffReply, repliedAt: d.repliedAt,
    })),
  });
});

/** The union's answer, shown to the passenger within seconds. Optionally warns the driver by SMS. */
router.post("/union/disputes/:id/reply", async (req, res): Promise<void> => {
  const parsed = z.object({ message: z.string().trim().min(3).max(300), smsDriver: z.boolean().optional() }).safeParse(req.body);
  const id = Number(req.params["id"]);
  if (!parsed.success || !Number.isInteger(id)) {
    res.status(400).json({ error: "Write a short message" });
    return;
  }
  const [d] = await db.select().from(disputesTable).where(eq(disputesTable.id, id));
  if (!d) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  await db.update(disputesTable).set({ staffReply: parsed.data.message, repliedAt: new Date(), status: d.status === "open" ? "investigating" : d.status }).where(eq(disputesTable.id, id));
  let smsStatus: string | null = null;
  if (parsed.data.smsDriver && d.vehicleId) {
    const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, d.vehicleId));
    if (v) smsStatus = await sendSms(v.driverPhone, `GPRTU: a passenger has reported ${ALERT_LABEL[d.disputeType] ?? "an incident"} on ${v.shortCode}. Drive carefully and call your terminal chairman now.`);
  }
  res.json({ ok: true, smsStatus });
});

// ---- Direction and route changes by conductors ----------------------------------------------------------

router.get("/union/route-changes", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ c: routeChangesTable, code: vehiclesTable.shortCode, driver: vehiclesTable.driverName })
    .from(routeChangesTable)
    .innerJoin(vehiclesTable, eq(routeChangesTable.vehicleId, vehiclesTable.id))
    .orderBy(desc(routeChangesTable.createdAt))
    .limit(100);
  const todayCount = new Map<string, number>();
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  for (const { c, code } of rows) if (c.kind === "route" && c.createdAt >= startOfDay) todayCount.set(code, (todayCount.get(code) ?? 0) + 1);
  res.json({
    changes: rows.map(({ c, code, driver }) => ({ id: c.id, vehicle: code, driver, kind: c.kind, from: c.fromRoute, to: c.toRoute, fromDirection: c.fromDirection, toDirection: c.toDirection, at: c.createdAt, /** More than two route switches in one day looks like dodging the route. */ unusual: c.kind === "route" && (todayCount.get(code) ?? 0) > 2 })),
  });
});

// ---- Registration: reports of unregistered vehicles ---------------------------------------------------

router.get("/union/unregistered-reports", async (_req, res): Promise<void> => {
  const rows = await db.select().from(unregisteredReportsTable).orderBy(desc(unregisteredReportsTable.createdAt)).limit(200);
  res.json({ reports: rows.map((r) => ({ id: r.id, code: r.codeSeen, note: r.note, lat: r.lat ? Number(r.lat) : null, lng: r.lng ? Number(r.lng) : null, status: r.status, at: r.createdAt })) });
});

router.post("/union/unregistered-reports/:id/status", async (req, res): Promise<void> => {
  const parsed = z.object({ status: z.enum(["open", "investigating", "resolved", "rejected"]) }).safeParse(req.body);
  const id = Number(req.params["id"]);
  if (!parsed.success || !Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }
  await db.update(unregisteredReportsTable).set({ status: parsed.data.status }).where(eq(unregisteredReportsTable.id, id));
  res.json({ ok: true });
});

// ---- Fare tables: schedule, preview, publish ---------------------------------------------------------

/** Parses "route,stop,fare" lines (a header row is skipped) over the current fares, and checks every fare. */
async function tableFromBody(body: { percent?: number; csv?: string }): Promise<{ ok: true; fares: Record<string, Record<string, number>> } | { ok: false; error: string }> {
  const routes = await db.select().from(routesTable);
  let fares: Record<string, Record<string, number>>;
  if (typeof body.percent === "number") {
    fares = await buildPercentTable(body.percent);
  } else if (typeof body.csv === "string" && body.csv.trim()) {
    fares = await currentFares();
    for (const [i, line] of body.csv.trim().split(/\r?\n/).entries()) {
      const [routeId, stop, fare] = line.split(",").map((x) => x.trim());
      if (i === 0 && Number.isNaN(Number(fare))) continue; // header
      const r = routes.find((x) => x.routeId === routeId);
      if (!r || !stop || !r.stopsJson.some((s) => s.name.toLowerCase() === stop.toLowerCase())) return { ok: false, error: `Line ${i + 1}: unknown route or stop` };
      const n = Number(fare);
      if (!Number.isFinite(n) || n < 0 || n > 500) return { ok: false, error: `Line ${i + 1}: fare must be between 0 and 500` };
      const name = r.stopsJson.find((s) => s.name.toLowerCase() === stop.toLowerCase())!.name;
      fares[routeId!]![name] = Math.round(n * 100) / 100;
    }
  } else {
    return { ok: false, error: "Give a percentage change or paste a fare list" };
  }
  // Fares must never go down along a route, and the origin stays free.
  for (const r of routes) {
    let last = 0;
    for (const [i, s] of r.stopsJson.entries()) {
      const f = i === 0 ? 0 : fares[r.routeId]?.[s.name];
      if (f === undefined || f < last) return { ok: false, error: `${r.routeId}: fare at ${s.name} is below the previous stop` };
      last = f;
    }
  }
  return { ok: true, fares };
}

const FareBody = z.object({ percent: z.number().min(-50).max(100).optional(), csv: z.string().max(20_000).optional() });

router.get("/union/fares", async (_req, res): Promise<void> => {
  const routes = await db.select().from(routesTable).orderBy(routesTable.routeId);
  const current = await currentFares();
  const tables = await db.select().from(fareTablesTable).orderBy(desc(fareTablesTable.effectiveFrom)).limit(30);
  const now = Date.now();
  res.json({
    current: routes.map((r) => ({ routeId: r.routeId, routeName: r.routeName, stops: r.stopsJson.map((s, i) => ({ name: s.name, fare: i === 0 ? 0 : current[r.routeId]?.[s.name] ?? s.fare, seeded: s.fare })) })),
    tables: tables.map((t) => ({ id: t.id, label: t.label, effectiveFrom: t.effectiveFrom, percentChange: t.percentChange ? Number(t.percentChange) : null, createdAt: t.createdAt, notifiedAt: t.notifiedAt, notifiedCount: t.notifiedCount, state: t.effectiveFrom.getTime() > now ? "scheduled" : "in_force" })),
  });
});

/** Shows what a change would do to every stop, without saving anything. */
router.post("/union/fares/preview", async (req, res): Promise<void> => {
  const parsed = FareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid fare change" });
    return;
  }
  const t = await tableFromBody(parsed.data);
  if (!t.ok) {
    res.status(400).json({ error: t.error });
    return;
  }
  const routes = await db.select().from(routesTable).orderBy(routesTable.routeId);
  const current = await currentFares();
  res.json({
    changes: routes.flatMap((r) => r.stopsJson.slice(1).map((s) => ({ routeId: r.routeId, stop: s.name, from: current[r.routeId]![s.name]!, to: t.fares[r.routeId]![s.name]!, pay: Math.ceil(t.fares[r.routeId]![s.name]! - 1e-9) }))),
  });
});

/**
 * Publishes a fare table with an effective time. From that moment every price the API quotes or accepts comes from it,
 * so nobody can be charged the old fare after the deadline. Optionally tells every conductor (push) and driver (SMS).
 */
router.post("/union/fares", async (req, res): Promise<void> => {
  const parsed = FareBody.extend({ label: z.string().trim().min(3).max(80), effectiveFrom: z.string().datetime(), notify: z.boolean().default(true) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Give a name, an effective date and time, and the fare change" });
    return;
  }
  const b = parsed.data;
  const t = await tableFromBody(b);
  if (!t.ok) {
    res.status(400).json({ error: t.error });
    return;
  }
  const effectiveFrom = new Date(b.effectiveFrom);
  const [row] = await db.insert(fareTablesTable).values({ label: b.label, effectiveFrom, percentChange: b.percent !== undefined ? b.percent.toFixed(2) : null, fares: t.fares }).returning();
  invalidateFareCache();

  let notified = 0;
  if (b.notify) {
    const when = effectiveFrom.toISOString().slice(0, 10);
    const text = `GPRTU: New fares from ${when} (${b.label}). Open TrotroLink to see the table. Charge only the fare shown in the app.`;
    const vehicles = await db.select().from(vehiclesTable);
    await Promise.all(vehicles.map(async (v) => { if ((await sendSms(v.driverPhone, text)) !== "no_phone") notified++; }));
    const conductors = await db.select({ token: usersTable.pushToken }).from(usersTable).where(isNotNull(usersTable.pushToken));
    await Promise.all(conductors.map((c) => sendPush(c.token, "New GPRTU fares", text)));
    await db.update(fareTablesTable).set({ notifiedAt: new Date(), notifiedCount: notified }).where(eq(fareTablesTable.id, row!.id));
    logger.info({ tableId: row!.id, notified }, "Fare change published");
  }
  res.json({ ok: true, id: row!.id, effectiveFrom, notified });
});

// ---- Terminals: the digital terminal ticket ----------------------------------------------------------

router.get("/union/terminals", async (_req, res): Promise<void> => {
  const per = (
    await db.execute(sql`
      select r.origin as terminal, (t.timestamp at time zone 'UTC')::date as day, count(*)::int as trips,
             coalesce(sum(t.terminal_fee), 0)::float as fees, coalesce(sum(t.amount_paid), 0)::float as fares
      from transactions t join vehicles v on v.id = t.vehicle_id join routes r on r.id = v.route_id
      where t.timestamp > now() - interval '7 days'
      group by r.origin, (t.timestamp at time zone 'UTC')::date order by day`)
  ).rows as Array<{ terminal: string; day: string | Date; trips: number; fees: number; fares: number }>;
  const today = new Date().toISOString().slice(0, 10);
  const terminals = new Map<string, { terminal: string; tripsToday: number; feesToday: number; faresToday: number; trips7: number; fees7: number; days: Array<{ day: string; trips: number; fees: number }> }>();
  for (const r of per) {
    const day = typeof r.day === "string" ? r.day.slice(0, 10) : r.day.toISOString().slice(0, 10);
    const t = terminals.get(r.terminal) ?? { terminal: r.terminal, tripsToday: 0, feesToday: 0, faresToday: 0, trips7: 0, fees7: 0, days: [] };
    if (day === today) { t.tripsToday += r.trips; t.feesToday += r.fees; t.faresToday += r.fares; }
    t.trips7 += r.trips; t.fees7 += r.fees; t.days.push({ day, trips: r.trips, fees: Math.round(r.fees * 100) / 100 });
    terminals.set(r.terminal, t);
  }
  res.json({ feePerTrip: terminalFeeGhs(), terminals: [...terminals.values()].map((t) => ({ ...t, feesToday: Math.round(t.feesToday * 100) / 100, fees7: Math.round(t.fees7 * 100) / 100, faresToday: Math.round(t.faresToday * 100) / 100 })) });
});

// ---- Income statements (driver credit) ---------------------------------------------------------------

/**
 * A statement can be cut by week or by month, over any number of periods: a young programme has weeks of history, not
 * months. A period "counts" when the vehicle earned on enough days; the lender sets how many counting periods it needs.
 */
const PERIOD = {
  week: { trunc: "week", back: "26 weeks", activeDays: 4, defaultRequired: 12 },
  month: { trunc: "month", back: "12 months", activeDays: 15, defaultRequired: 6 },
} as const;
type Unit = keyof typeof PERIOD;
const unitOf = (q: unknown): Unit => (q === "week" ? "week" : "month");

router.post("/union/vehicles/:code/consent", async (req, res): Promise<void> => {
  const parsed = z.object({ consent: z.boolean() }).safeParse(req.body);
  const v = await findVehicle(vehicleCode(req));
  if (!parsed.success || !v) {
    res.status(parsed.success ? 404 : 400).json({ error: parsed.success ? "Vehicle not found" : "Invalid request" });
    return;
  }
  await db.update(vehiclesTable).set({ creditConsent: parsed.data.consent }).where(eq(vehiclesTable.id, v.id));
  res.json({ ok: true });
});

router.get("/union/statements", async (req, res): Promise<void> => {
  const unit = unitOf(req.query["unit"]);
  const trunc = PERIOD[unit].trunc;
  const required = Math.min(52, Math.max(1, Number(req.query["required"]) || PERIOD[unit].defaultRequired));
  const vs = await db.select().from(vehiclesTable).orderBy(vehiclesTable.shortCode);
  const hist = (await db.execute(sql`select vehicle_id, count(distinct date_trunc(${sql.raw(`'${trunc}'`)}, timestamp))::int as periods, count(*)::int as trips, coalesce(sum(amount_paid),0)::float as fares, min(timestamp) as first from transactions group by vehicle_id`)).rows as Array<Record<string, unknown>>;
  const h = new Map(hist.map((r) => [Number(r["vehicle_id"]), r]));
  res.json({ unit, required, activeDaysPerPeriod: PERIOD[unit].activeDays, vehicles: vs.map((v) => ({ vehicle: v.shortCode, driver: v.driverName, consent: v.creditConsent, periodsOfHistory: Number(h.get(v.id)?.["periods"] ?? 0), trips: Number(h.get(v.id)?.["trips"] ?? 0), fares: Number(h.get(v.id)?.["fares"] ?? 0), since: h.get(v.id)?.["first"] ?? null })) });
});

router.get("/union/statements/:code", async (req, res): Promise<void> => {
  const v = await findVehicle(vehicleCode(req));
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  if (!v.creditConsent) {
    res.status(403).json({ error: "The owner has not agreed to share an income statement for this vehicle.", consentRequired: true });
    return;
  }
  const unit = unitOf(req.query["unit"]);
  const cfg = PERIOD[unit];
  const required = Math.min(52, Math.max(1, Number(req.query["required"]) || cfg.defaultRequired));
  const trunc = sql.raw(`'${cfg.trunc}'`);
  const back = sql.raw(`'${cfg.back}'`);
  const periods = (
    await db.execute(sql`
      with m as (
        select date_trunc(${trunc}, timestamp) as mo, count(*)::int as trips, coalesce(sum(amount_paid), 0)::float as fares,
               count(distinct (timestamp at time zone 'UTC')::date)::int as active_days
        from transactions where vehicle_id = ${v.id} and timestamp > now() - ${back}::interval group by 1
      ), r as (
        select date_trunc(${trunc}, t.timestamp) as mo, round(avg(rt.driver_rating)::numeric, 2)::float as avg_rating
        from ratings rt join transactions t on t.id = rt.transaction_id where t.vehicle_id = ${v.id} group by 1
      )
      select to_char(m.mo, 'YYYY-MM-DD') as start, m.trips, m.fares, m.active_days, r.avg_rating from m left join r on r.mo = m.mo order by m.mo`)
  ).rows as Array<{ start: string; trips: number; fares: number; active_days: number; avg_rating: number | null }>;
  const consistent = periods.filter((m) => m.active_days >= cfg.activeDays).length;
  const totals = periods.reduce((a, m) => ({ trips: a.trips + m.trips, fares: a.fares + m.fares }), { trips: 0, fares: 0 });
  const [warn] = (await db.execute(sql`select count(*)::int as n from warnings where vehicle_id = ${v.id} and created_at > now() - interval '12 months'`)).rows as Array<{ n: number }>;
  res.json({
    generatedAt: new Date(),
    vehicle: v.shortCode,
    driver: v.driverName,
    unit,
    periods: periods.map((m) => ({ start: m.start, trips: m.trips, fares: Math.round(m.fares * 100) / 100, avgPerTrip: m.trips ? Math.round((m.fares / m.trips) * 100) / 100 : 0, activeDays: m.active_days, avgRating: m.avg_rating })),
    totals: { trips: totals.trips, fares: Math.round(totals.fares * 100) / 100 },
    warnings12m: warn?.n ?? 0,
    eligibility: { unit, required, activeDaysPerPeriod: cfg.activeDays, periodsOnRecord: periods.length, consistentPeriods: consistent, eligible: consistent >= required },
    notice: "Fares collected through TrotroLink only. Cash fares are not included. Shared with the owner's consent. The lender sets the credit decision.",
  });
});

export default router;
