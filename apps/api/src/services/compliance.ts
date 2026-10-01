import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { routesTable, vehiclesTable } from "../db/schema";
import { isSuspended } from "../lib";

/** The union's rules, in one place so the dashboard and the flags always agree. */
export const RULES = {
  /** An average asked fare more than this far over the official fare is flagged. */
  overFarePct: 5,
  /** A driver below this average rating (with enough ratings) is flagged for review. */
  lowRating: 3.0,
  minRatingsForFlag: 3,
  /** Overcharge reports in 30 days that move a vehicle to "warn". */
  overchargeReportsWarn: 3,
  /** This many warnings in 90 days makes a vehicle a repeat offender: suspension is recommended. */
  repeatWarnings: 2,
} as const;

export type Flag = "overcharge_reports" | "fare_over_5pct" | "low_rating" | "repeat_offender" | "suspended";
export type Severity = "ok" | "watch" | "warn" | "critical";

export type VehicleCompliance = {
  vehicle: string;
  driver: string;
  conductor: string;
  route: string;
  terminal: string;
  hasPhone: boolean;
  status: "active" | "suspended";
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  trips30: number;
  avgDriver: number | null;
  ratings: number;
  overchargeReports30: number;
  openOvercharge: number;
  /** Average of (asked − official) / official over reports that gave an amount; null when none did. */
  avgOverPct: number | null;
  warnings90: number;
  flags: Flag[];
  severity: Severity;
};

type Row = Record<string, unknown>;
const by = (rows: Row[]) => new Map(rows.map((r) => [Number(r["vehicle_id"]), r]));

export async function computeCompliance(): Promise<VehicleCompliance[]> {
  const vehicles = await db.select({ v: vehiclesTable, r: routesTable }).from(vehiclesTable).innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id)).orderBy(vehiclesTable.shortCode);
  const ratings = by((await db.execute(sql`select vehicle_id, round(avg(driver_rating)::numeric, 2)::float as avg, count(*)::int as n from ratings group by vehicle_id`)).rows);
  const over = by(
    (
      await db.execute(sql`
        select d.vehicle_id, count(*)::int as n, (count(*) filter (where d.status = 'open'))::int as open_n,
               avg((d.amount_asked - t.official_fare) / nullif(t.official_fare, 0))::float as over_pct
        from disputes d left join transactions t on t.id = d.transaction_id
        where d.dispute_type = 'overcharge' and d.created_at > now() - interval '30 days' and d.vehicle_id is not null
        group by d.vehicle_id`)
    ).rows,
  );
  const warns = by((await db.execute(sql`select vehicle_id, count(*)::int as n from warnings where created_at > now() - interval '90 days' group by vehicle_id`)).rows);
  const trips = by((await db.execute(sql`select vehicle_id, count(*)::int as n from transactions where timestamp > now() - interval '30 days' group by vehicle_id`)).rows);

  return vehicles.map(({ v, r }) => {
    const rat = ratings.get(v.id);
    const o = over.get(v.id);
    const avgDriver = rat ? Number(rat["avg"]) : null;
    const nRatings = rat ? Number(rat["n"]) : 0;
    const overN = o ? Number(o["n"]) : 0;
    const overPct = o && o["over_pct"] !== null ? Number(o["over_pct"]) * 100 : null;
    const warnN = warns.get(v.id) ? Number(warns.get(v.id)!["n"]) : 0;
    const suspended = isSuspended(v);

    const flags: Flag[] = [];
    if (overN > 0) flags.push("overcharge_reports");
    if (overPct !== null && overPct > RULES.overFarePct) flags.push("fare_over_5pct");
    if (avgDriver !== null && nRatings >= RULES.minRatingsForFlag && avgDriver < RULES.lowRating) flags.push("low_rating");
    if (warnN >= RULES.repeatWarnings) flags.push("repeat_offender");
    if (suspended) flags.push("suspended");

    const severity: Severity = suspended || flags.includes("repeat_offender") ? "critical" : flags.includes("fare_over_5pct") || overN >= RULES.overchargeReportsWarn ? "warn" : flags.length ? "watch" : "ok";
    return {
      vehicle: v.shortCode,
      driver: v.driverName,
      conductor: v.conductorName,
      route: r.routeName,
      terminal: r.origin,
      hasPhone: !!v.driverPhone,
      status: suspended ? "suspended" : "active",
      suspendedUntil: v.suspendedUntil,
      suspensionReason: v.suspensionReason,
      trips30: trips.get(v.id) ? Number(trips.get(v.id)!["n"]) : 0,
      avgDriver,
      ratings: nRatings,
      overchargeReports30: overN,
      openOvercharge: o ? Number(o["open_n"]) : 0,
      avgOverPct: overPct === null ? null : Math.round(overPct * 10) / 10,
      warnings90: warnN,
      flags,
      severity,
    };
  });
}
