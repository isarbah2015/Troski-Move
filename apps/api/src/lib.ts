import { eq } from "drizzle-orm";
import type { RouteStop } from "@trotrolink/shared";
import { db } from "./db";
import { routesTable, usersTable, vehiclesTable } from "./db/schema";

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
