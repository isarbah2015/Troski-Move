import { eq } from "drizzle-orm";
import type { RouteStop } from "@trotrolink/shared";
import { db } from "./db";
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

export async function vehicleWithRoute(shortCode: string) {
  const [row] = await db
    .select({ vehicle: vehiclesTable, route: routesTable })
    .from(vehiclesTable)
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(eq(vehiclesTable.shortCode, shortCode.toUpperCase()))
    .limit(1);
  return row ?? null;
}

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
): { ok: true; from: number; to: number; officialFare: number } | { ok: false; error: string; officialFare?: number } {
  const from = boardingStop ? stopIndex(stops, boardingStop) : 0;
  const to = stopIndex(stops, alightingStop);
  if (from < 0 || to < 0 || to <= from) return { ok: false, error: "Unknown or out-of-order stops for this route" };
  const officialFare = round2(stops[to]!.fare - stops[from]!.fare);
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
export function amountDue(officialFare: number): number {
  return Math.ceil(officialFare - 1e-9);
}
