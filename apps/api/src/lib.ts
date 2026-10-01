import { eq } from "drizzle-orm";
import type { RouteStop } from "@trotrolink/shared";
import { db } from "./db";
import { payAmount, tripFare } from "@trotrolink/shared";
import { getRoundingStep, pairFaresFor, withFares } from "./services/fares";
import { activeTripsTable, routesTable, transactionsTable, tripEventsTable, usersTable, vehiclesTable } from "./db/schema";

/** Finds (or creates) the anonymous user for a device. Real accounts arrive with phone OTP. */
export async function guestUserId(deviceId: string, role: "passenger" | "conductor"): Promise<number> {
  const phone = `guest-${deviceId}-${role}`;
  const [row] = await db
    .insert(usersTable)
    .values({ phone, name: "Guest", role })
    .onConflictDoUpdate({ target: usersTable.phone, set: { role } })
    .returning({ id: usersTable.id });
  return row!.id;
}

export async function userExists(id: number): Promise<boolean> {
  const [row] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id));
  return !!row;
}

/**
 * The return leg of a route: the same stops in reverse. Fares are symmetric (what you pay depends on the distance
 * between two stops), so each stop's fare from the new origin is the route total minus its old fare, and each leg
 * keeps the time it took the other way.
 */
export function reverseStops(stops: RouteStop[]): RouteStop[] {
  const n = stops.length;
  const total = stops[n - 1]!.fare;
  return stops
    .slice()
    .reverse()
    .map((s, i) => ({ ...s, fare: i === 0 ? 0 : round2(total - s.fare), etaMinutes: i === 0 ? 0 : stops[n - i]!.etaMinutes }));
}

/** "Circle → Kasoa via Kaneshie" becomes "Kasoa → Circle via Kaneshie". */
export function reverseRouteName(name: string): string {
  const m = name.match(/^(.*?) → (.*?)( via .*)?$/);
  return m ? `${m[2]} → ${m[1]}${m[3] ?? ""}` : name;
}

/** Lays a vehicle's direction over its route (after fares): inbound runs the stops, names and ends the other way. */
export function applyDirection<T extends { routeName: string; origin: string; destination: string; stopsJson: RouteStop[] }>(route: T, direction: string): T {
  if (direction !== "inbound") return route;
  return { ...route, routeName: reverseRouteName(route.routeName), origin: route.destination, destination: route.origin, stopsJson: reverseStops(route.stopsJson) };
}

export async function vehicleWithRoute(shortCode: string) {
  const [row] = await db
    .select({ vehicle: vehiclesTable, route: routesTable })
    .from(vehiclesTable)
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(eq(vehiclesTable.shortCode, shortCode.toUpperCase()))
    .limit(1);
  // Prices always come from the fare table in force, never from the seeded fares alone.
  return row ? { vehicle: row.vehicle, route: applyDirection(await withFares(row.route), row.vehicle.direction), pairs: await pairFaresFor(row.route.routeId) } : null;
}

/** A vehicle the union has suspended (and the suspension has not run out) cannot take payments. */
export function isSuspended(v: { status: string; suspendedUntil: Date | null }): boolean {
  return v.status === "suspended" && (!v.suspendedUntil || v.suspendedUntil > new Date());
}

/** The terminal fee booked per trip, in GHS (not charged to passengers). */
export const terminalFeeGhs = () => {
  const n = Number(process.env["TERMINAL_FEE_GHS"] ?? "0.10");
  return Number.isFinite(n) && n >= 0 ? n : 0.1;
};

export function stopIndex(stops: RouteStop[], name: string): number {
  return stops.findIndex((s) => s.name.toLowerCase() === name.trim().toLowerCase());
}

/** Minutes to ride from stop index `from` to `to`: the sum of the leg times after `from` up to `to`. */
export function etaBetween(stops: RouteStop[], from: number, to: number): number {
  return stops.slice(from + 1, to + 1).reduce((sum, s) => sum + s.etaMinutes, 0);
}

export function newTripRef(now = new Date()): string {
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "0");
  return `TRX-${yymmdd}-${tail}`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Checks the stops belong to the route and the amount covers the official fare. */
export function checkTrip(
  stops: RouteStop[],
  boardingStop: string | undefined,
  alightingStop: string,
  amountPaid: number,
  pairs?: Record<string, number>,
): { ok: true; from: number; to: number; officialFare: number } | { ok: false; error: string; officialFare?: number } {
  const from = boardingStop ? stopIndex(stops, boardingStop) : 0;
  const to = stopIndex(stops, alightingStop);
  if (from < 0 || to < 0 || to <= from) return { ok: false, error: "Unknown or out-of-order stops for this route" };
  // A specific stop-to-stop fare set by the union wins over the usual difference of the two stops' fares.
  const officialFare = tripFare(stops, pairs, stops[from]!.name, stops[to]!.name) ?? round2(stops[to]!.fare - stops[from]!.fare);
  if (amountPaid + 0.001 < officialFare) return { ok: false, error: "Amount paid is below the official fare", officialFare };
  return { ok: true, from, to, officialFare };
}

/** Writes the transaction, the active trip and the `boarded` event. Call inside a db transaction. */
export async function insertTrip(
  tx: Tx,
  p: { vehicleId: number; passengerId: number; stops: RouteStop[]; from: number; to: number; officialFare: number; amountPaid: number; tripRef: string; customStopNote?: string | null },
) {
  const [t] = await tx
    .insert(transactionsTable)
    .values({
      vehicleId: p.vehicleId,
      passengerId: p.passengerId,
      alightingStop: p.stops[p.to]!.name,
      boardingStop: p.stops[p.from]!.name,
      officialFare: p.officialFare.toFixed(2),
      amountPaid: p.amountPaid.toFixed(2),
      tripRef: p.tripRef,
      customStopNote: p.customStopNote ?? null,
      terminalFee: terminalFeeGhs().toFixed(2),
    })
    .returning();
  await tx.insert(activeTripsTable).values({
    passengerId: p.passengerId,
    vehicleId: p.vehicleId,
    alightingStop: p.stops[p.to]!.name,
    currentStop: p.stops[p.from]!.name,
    etaMinutes: etaBetween(p.stops, p.from, p.to),
    transactionId: t!.id,
    startedAt: t!.timestamp,
  });
  await tx.insert(tripEventsTable).values({ vehicleId: p.vehicleId, tripId: t!.id, eventType: "boarded", stopName: p.stops[p.from]!.name });
  return t!;
}

/** Passengers pay whole cedis: the official fare rounded up. The server decides the price; clients cannot. */
export function amountDue(officialFare: number, step = getRoundingStep()): number {
  return payAmount(officialFare, step);
}
