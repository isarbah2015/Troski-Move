import { Router, type IRouter } from "express";
import { eq, lt } from "drizzle-orm";
import { ConductorLoginBody, ConductorSetupBody, type ConductorLoginResponse } from "@trotrolink/shared";
import { hashPin, hashToken, LOCKOUT_MINUTES, MAX_PIN_ATTEMPTS, newToken, SESSION_HOURS, verifyPin, conductorFromRequest } from "../auth";
import { db } from "../db";
import { conductorSessionsTable, usersTable } from "../db/schema";
import { vehicleWithRoute } from "../lib";

const router: IRouter = Router();

/**
 * First launch: the conductor chooses a PIN for their vehicle. A vehicle can be set up once; a reset is a union job.
 * If CONDUCTOR_SETUP_CODE is set (it must be, in production) the caller must also know it, so a stranger cannot
 * claim a vehicle before its real conductor does.
 */
router.post("/conductor/setup", async (req, res): Promise<void> => {
  const parsed = ConductorSetupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A vehicle code and a 4-digit PIN are required" });
    return;
  }
  const { vehicleCode, pin, setupCode } = parsed.data;

  const required = process.env.CONDUCTOR_SETUP_CODE;
  if (!required && process.env.NODE_ENV === "production") {
    res.status(503).json({ error: "Conductor setup is not configured" });
    return;
  }
  if (required && setupCode !== required) {
    res.status(403).json({ error: required && !setupCode ? "Enter the setup code from the union" : "Wrong setup code" });
    return;
  }

  const found = await vehicleWithRoute(vehicleCode);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.conductorVehicleCode, found.vehicle.shortCode));
  if (existing?.conductorPinHash) {
    res.status(409).json({ error: "This vehicle already has a PIN. Log in, or ask the union to reset it." });
    return;
  }

  const values = { phone: `conductor-${found.vehicle.shortCode}`, name: found.vehicle.conductorName, role: "conductor" as const, conductorPinHash: hashPin(pin), conductorVehicleCode: found.vehicle.shortCode };
  await db.insert(usersTable).values(values).onConflictDoUpdate({ target: usersTable.phone, set: { conductorPinHash: values.conductorPinHash, conductorVehicleCode: values.conductorVehicleCode } });
  res.json({ ok: true });
});

/** Checks the PIN and issues a 12-hour session token. Five wrong PINs lock the account for 15 minutes. */
router.post("/conductor/login", async (req, res): Promise<void> => {
  const parsed = ConductorLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A vehicle code and a 4-digit PIN are required" });
    return;
  }
  const { vehicleCode, pin } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.conductorVehicleCode, vehicleCode));

  // Same answer for "no such vehicle" and "wrong PIN", so codes cannot be probed.
  if (!user || !user.conductorPinHash) {
    res.status(401).json({ error: "Wrong vehicle code or PIN" });
    return;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    res.status(429).json({ error: `Too many wrong PINs. Try again in ${Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)} minutes.` });
    return;
  }
  if (!verifyPin(pin, user.conductorPinHash)) {
    const attempts = user.failedPinAttempts + 1;
    const lock = attempts >= MAX_PIN_ATTEMPTS;
    await db
      .update(usersTable)
      .set({ failedPinAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null })
      .where(eq(usersTable.id, user.id));
    res.status(lock ? 429 : 401).json({ error: lock ? `Too many wrong PINs. Locked for ${LOCKOUT_MINUTES} minutes.` : "Wrong vehicle code or PIN" });
    return;
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3_600_000);
  await db.update(usersTable).set({ failedPinAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  await db.delete(conductorSessionsTable).where(lt(conductorSessionsTable.expiresAt, new Date()));
  await db.insert(conductorSessionsTable).values({ conductorId: user.id, tokenHash: hashToken(token), expiresAt });

  const body: ConductorLoginResponse = { token, expiresAt: expiresAt.toISOString(), conductorId: user.id, vehicleCode: user.conductorVehicleCode!, conductorName: user.name };
  res.json(body);
});

router.post("/conductor/logout", async (req, res): Promise<void> => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (token && (await conductorFromRequest(req))) await db.delete(conductorSessionsTable).where(eq(conductorSessionsTable.tokenHash, hashToken(token)));
  res.json({ ok: true });
});

export default router;
