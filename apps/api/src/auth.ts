import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { conductorSessionsTable, usersTable } from "./db/schema";

export const SESSION_HOURS = 12;
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/** `s1$<salt>$<hash>`: scrypt with a random salt per PIN. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `s1$${salt.toString("hex")}$${scryptSync(pin, salt, 32).toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [v, saltHex, hashHex] = stored.split("$");
  if (v !== "s1" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pin, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type AuthedConductor = { id: number; vehicleCode: string };

/** The conductor behind a valid, unexpired `Authorization: Bearer` token, or null. */
export async function conductorFromRequest(req: Request): Promise<AuthedConductor | null> {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const [row] = await db
    .select({ id: usersTable.id, vehicleCode: usersTable.conductorVehicleCode })
    .from(conductorSessionsTable)
    .innerJoin(usersTable, eq(conductorSessionsTable.conductorId, usersTable.id))
    .where(and(eq(conductorSessionsTable.tokenHash, hashToken(token)), gt(conductorSessionsTable.expiresAt, new Date())));
  return row && row.vehicleCode ? { id: row.id, vehicleCode: row.vehicleCode } : null;
}

/** Requires a signed-in conductor; the conductor is then available as `conductorOf(res)`. */
export async function requireConductor(req: Request, res: Response, next: NextFunction): Promise<void> {
  const conductor = await conductorFromRequest(req);
  if (!conductor) {
    res.status(401).json({ error: "Sign in as a conductor" });
    return;
  }
  res.locals["conductor"] = conductor;
  next();
}

export const conductorOf = (res: Response) => res.locals["conductor"] as AuthedConductor;

/** The signed-in conductor may only act on their own vehicle. Returns false (and answers 403) otherwise. */
export function ownsVehicle(res: Response, vehicleCode: string): boolean {
  if (conductorOf(res).vehicleCode === vehicleCode.toUpperCase()) return true;
  res.status(403).json({ error: "This is not your vehicle" });
  return false;
}

/**
 * Union access: the `x-union-key` header must equal UNION_API_KEY. With no key set, access is open in development
 * only; production refuses everything until a key is configured.
 */
export function requireUnion(req: Request, res: Response, next: NextFunction): void {
  const want = process.env.UNION_API_KEY;
  const given = req.header("x-union-key");
  const ok = want ? typeof given === "string" && given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want)) : process.env.NODE_ENV !== "production";
  if (!ok) {
    res.status(401).json({ error: "Union access only" });
    return;
  }
  next();
}
