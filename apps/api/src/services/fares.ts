import { asc, desc, gt, lte } from "drizzle-orm";
import type { RouteStop } from "@trotrolink/shared";
import { db } from "../db";
import { fareTablesTable, routesTable } from "../db/schema";

type FareTable = typeof fareTablesTable.$inferSelect;

/** Fares change rarely and are read on every scan, so the active table is cached briefly. */
let cache: { at: number; table: FareTable | null } | null = null;
/** The rounding step of the table in force; refreshed whenever the table is read, so read prices after `activeFareTable()`. */
let activeStep = 1;
export const getRoundingStep = () => activeStep;
const TTL_MS = 15_000;

export function invalidateFareCache(): void {
  cache = null;
}

/** The fare table in force now: the newest one whose effective time has passed, or null (seeded fares apply). */
export async function activeFareTable(): Promise<FareTable | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.table;
  const [table] = await db.select().from(fareTablesTable).where(lte(fareTablesTable.effectiveFrom, new Date())).orderBy(desc(fareTablesTable.effectiveFrom), desc(fareTablesTable.id)).limit(1);
  cache = { at: Date.now(), table: table ?? null };
  activeStep = table ? Number(table.roundingStep) || 1 : 1;
  return cache.table;
}

/** The route's stops with the active table's fares laid over the seeded ones. Stops the table does not mention keep their fare. */
export function overlayFares(routeId: string, stops: RouteStop[], table: FareTable | null): RouteStop[] {
  const fares = table?.fares[routeId];
  if (!fares) return stops;
  return stops.map((s, i) => (i === 0 ? s : { ...s, fare: fares[s.name] ?? s.fare }));
}

/** Applies the active fare table to a route row. Use this wherever a price is read. */
export async function withFares<T extends { routeId: string; stopsJson: RouteStop[] }>(route: T): Promise<T> {
  const table = await activeFareTable();
  return table ? { ...route, stopsJson: overlayFares(route.routeId, route.stopsJson, table) } : route;
}

/** A recent fare change, so passengers are told why the price differs from last time. */
export async function fareNotice(): Promise<{ label: string; effectiveFrom: string } | null> {
  const table = await activeFareTable();
  if (!table || Date.now() - table.effectiveFrom.getTime() > 14 * 86_400_000) return null;
  return { label: table.label, effectiveFrom: table.effectiveFrom.toISOString() };
}

/** Rounds to the nearest 10 pesewas, the way minibus fares are quoted. */
export const roundFare = (n: number) => Math.round(n * 10) / 10;

/** Builds a table from every route's current fares changed by `percent` (e.g. 8 for +8%). The origin stays 0. */
export async function buildPercentTable(percent: number): Promise<Record<string, Record<string, number>>> {
  const table = await activeFareTable();
  const routes = await db.select().from(routesTable);
  const out: Record<string, Record<string, number>> = {};
  for (const r of routes) {
    const stops = overlayFares(r.routeId, r.stopsJson, table);
    out[r.routeId] = Object.fromEntries(stops.map((s, i) => [s.name, i === 0 ? 0 : roundFare(s.fare * (1 + percent / 100))]));
  }
  return out;
}

/** The current fares of every route, in the same shape as a table's `fares`. */
export async function currentFares(): Promise<Record<string, Record<string, number>>> {
  const table = await activeFareTable();
  const routes = await db.select().from(routesTable);
  return Object.fromEntries(routes.map((r) => [r.routeId, Object.fromEntries(overlayFares(r.routeId, r.stopsJson, table).map((s) => [s.name, s.fare]))]));
}

/** The stop-to-stop fares in force for a route (`From|To` keys). */
export async function pairFaresFor(routeId: string): Promise<Record<string, number>> {
  return (await activeFareTable())?.pairs?.[routeId] ?? {};
}

/** Current stop-to-stop fares for every route. */
export async function currentPairs(): Promise<Record<string, Record<string, number>>> {
  return (await activeFareTable())?.pairs ?? {};
}

/** The same percentage change applied to the stop-to-stop fares in force. */
export async function buildPercentPairs(percent: number): Promise<Record<string, Record<string, number>>> {
  const pairs = await currentPairs();
  return Object.fromEntries(Object.entries(pairs).map(([r, m]) => [r, Object.fromEntries(Object.entries(m).map(([k, v]) => [k, roundFare(v * (1 + percent / 100))]))]));
}

/** A table announced for a future date, so the app can warn passengers before prices change. */
export async function upcomingFareTable(): Promise<FareTable | null> {
  const [t] = await db.select().from(fareTablesTable).where(gt(fareTablesTable.effectiveFrom, new Date())).orderBy(asc(fareTablesTable.effectiveFrom)).limit(1);
  return t ?? null;
}
