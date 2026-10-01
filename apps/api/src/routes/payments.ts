import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";
import { InitiatePaymentBody, type InitiatePaymentResponse, type PaymentStatusResponse } from "@trotrolink/shared";
import { db } from "../db";
import { activeTripsTable, paymentsTable, transactionsTable, tripEventsTable, type Payment } from "../db/schema";
import { amountDue, checkTrip, guestUserId, insertTrip, round2, stopIndex, userExists, vehicleWithRoute } from "../lib";
import { logger } from "../logger";
import { getPaymentStatus, isSimulator, momoCurrency, newReferenceId, payerPhoneRequired, requestToPay } from "../services/momo";

const router: IRouter = Router();

const PENDING_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Turns a SUCCESSFUL payment into a trip. Idempotent and race-safe: the payment row is locked, so the
 * status poll and the webhook can both call this and exactly one trip is created.
 */
async function settleSuccess(referenceId: string, raw: unknown): Promise<Payment> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(paymentsTable).where(eq(paymentsTable.referenceId, referenceId)).for("update");
    if (!p) throw new Error("Payment not found");
    if (p.tripId !== null) return p;

    const found = await vehicleWithRoute(p.vehicleCode);
    if (!found) throw new Error("Vehicle no longer exists");
    const stops = found.route.stopsJson;

    // An extension adds to an existing trip: move its declared stop and add the money. No new trip.
    if (p.extendsTripRef) {
      const [t] = await tx.select().from(transactionsTable).where(eq(transactionsTable.tripRef, p.extendsTripRef));
      if (!t) throw new Error("Trip to extend not found");
      const from = stopIndex(stops, t.boardingStop ?? stops[0]!.name);
      const to = stopIndex(stops, p.alightingStop);
      const fare = round2(stops[to]!.fare - stops[from]!.fare);
      await tx.update(transactionsTable).set({ alightingStop: p.alightingStop, officialFare: fare.toFixed(2), amountPaid: (Number(t.amountPaid) + Number(p.amount)).toFixed(2) }).where(eq(transactionsTable.id, t.id));
      await tx
        .update(activeTripsTable)
        .set({ alightingStop: p.alightingStop, currentStop: p.alightingStop, etaMinutes: 0, overstayStop: null, overstayAt: null })
        .where(eq(activeTripsTable.transactionId, t.id));
      await tx.insert(tripEventsTable).values({ vehicleId: found.vehicle.id, tripId: t.id, eventType: "stop_reached", stopName: p.alightingStop });
      const [done] = await tx.update(paymentsTable).set({ status: "SUCCESSFUL", tripId: t.id, momoResponse: raw ?? null, completedAt: new Date() }).where(eq(paymentsTable.id, p.id)).returning();
      return done!;
    }

    const check = checkTrip(stops, p.boardingStop, p.alightingStop, Number(p.amount));
    if (!check.ok) throw new Error(check.error);

    const t = await insertTrip(tx, {
      vehicleId: found.vehicle.id,
      passengerId: p.passengerId,
      stops,
      from: check.from,
      to: check.to,
      officialFare: check.officialFare,
      amountPaid: Number(p.amount),
      tripRef: p.tripRef,
    });
    const [updated] = await tx
      .update(paymentsTable)
      .set({ status: "SUCCESSFUL", tripId: t.id, momoResponse: raw ?? null, completedAt: new Date() })
      .where(eq(paymentsTable.id, p.id))
      .returning();
    return updated!;
  });
}

async function settleFailure(referenceId: string, reason: string | undefined, raw: unknown): Promise<void> {
  await db
    .update(paymentsTable)
    .set({ status: "FAILED", failureReason: reason ?? "Payment was declined", momoResponse: raw ?? null, completedAt: new Date() })
    .where(eq(paymentsTable.referenceId, referenceId));
}

/** Asks MTN (or the simulator) where a payment stands and records the outcome. Safe to call repeatedly. */
async function refresh(p: Payment): Promise<Payment> {
  if (p.status !== "PENDING") return p;
  // A request nobody approved is dead after 10 minutes (the wallet prompt has expired): close it so it can never be charged late.
  if (Date.now() - p.createdAt.getTime() > PENDING_EXPIRY_MS) {
    const result = await getPaymentStatus(p.referenceId, p.createdAt).catch(() => null);
    if (result?.status === "SUCCESSFUL") return settleSuccess(p.referenceId, result.raw);
    await settleFailure(p.referenceId, "The payment request expired", result?.raw);
    const [fresh] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, p.id));
    return fresh!;
  }
  const result = await getPaymentStatus(p.referenceId, p.createdAt);
  if (result.status === "SUCCESSFUL") return settleSuccess(p.referenceId, result.raw);
  if (result.status === "FAILED") {
    await settleFailure(p.referenceId, result.reason, result.raw);
    const [fresh] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, p.id));
    return fresh!;
  }
  return p;
}

function statusBody(p: Payment): PaymentStatusResponse {
  return {
    status: p.status,
    ...(p.status === "SUCCESSFUL" ? { tripId: p.tripRef } : {}),
    ...(p.status === "FAILED" ? { reason: p.failureReason ?? "Payment was declined" } : {}),
  };
}

/** Starts a MoMo request-to-pay. The passenger approves it on their phone. */
router.post("/payments/initiate", async (req, res): Promise<void> => {
  const parsed = InitiatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;

  // A retry (double tap, flaky network) with the same trip reference returns the same payment: never a second charge.
  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.tripRef, b.tripId));
  if (existing) {
    const body: InitiatePaymentResponse = { referenceId: existing.referenceId, tripId: existing.tripRef, status: existing.status, simulator: isSimulator() };
    res.json(body);
    return;
  }

  const found = await vehicleWithRoute(b.vehicleCode);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const check = checkTrip(found.route.stopsJson, b.boardingStop, b.alightingStop, b.amount);
  if (!check.ok) {
    res.status(400).json({ error: check.error, ...(check.officialFare !== undefined ? { officialFare: check.officialFare } : {}) });
    return;
  }

  if (payerPhoneRequired() && !b.payerPhone) {
    res.status(400).json({ error: "Add your MTN MoMo number to pay" });
    return;
  }

  // The price is set here, from the route. A client that sends a different amount is refused, not trusted.
  const due = amountDue(check.officialFare);
  if (Math.abs(b.amount - due) > 0.001) {
    res.status(400).json({ error: "Amount does not match the fare for this trip", amountDue: due });
    return;
  }

  let passengerId = b.passengerId;
  if (passengerId === undefined) passengerId = await guestUserId(b.deviceId!, "passenger");
  else if (!(await userExists(passengerId))) {
    res.status(404).json({ error: "Passenger not found" });
    return;
  }

  // One live charge per ride: if this passenger already has a pending payment for the same vehicle and stop, hand that
  // one back instead of asking their wallet for a second payment (a double tap, a retry, or a buggy client).
  const [duplicate] = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.passengerId, passengerId), eq(paymentsTable.vehicleCode, found.vehicle.shortCode), eq(paymentsTable.alightingStop, found.route.stopsJson[check.to]!.name), eq(paymentsTable.status, "PENDING"), gt(paymentsTable.createdAt, new Date(Date.now() - PENDING_EXPIRY_MS))));
  if (duplicate) {
    const body: InitiatePaymentResponse = { referenceId: duplicate.referenceId, tripId: duplicate.tripRef, status: duplicate.status, simulator: isSimulator() };
    res.json(body);
    return;
  }

  const referenceId = newReferenceId();
  const stops = found.route.stopsJson;
  try {
    // Record first (PENDING), then ask MTN, so a webhook or poll that arrives instantly finds the row.
    await db.insert(paymentsTable).values({
      referenceId,
      tripRef: b.tripId,
      passengerId,
      vehicleCode: found.vehicle.shortCode,
      boardingStop: stops[check.from]!.name,
      alightingStop: stops[check.to]!.name,
      amount: b.amount.toFixed(2),
      currency: momoCurrency(),
      payerPhone: b.payerPhone ?? null,
    });
    await requestToPay({
      referenceId,
      amount: b.amount,
      payerPhone: b.payerPhone,
      note: `TrotroLink ${found.vehicle.shortCode} to ${stops[check.to]!.name}`,
      externalId: b.tripId,
    });
  } catch (err) {
    logger.error({ err, referenceId }, "MoMo requestToPay failed");
    await settleFailure(referenceId, "Could not reach MTN MoMo. Try again.", { error: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ error: "Could not start the MoMo payment. Try again." });
    return;
  }

  const body: InitiatePaymentResponse = { referenceId, tripId: b.tripId, status: "PENDING", simulator: isSimulator() };
  res.json(body);
});

/** The payment's state. On the first SUCCESSFUL answer the trip is created; polling again is harmless. */
router.get("/payments/status/:referenceId", async (req, res): Promise<void> => {
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.referenceId, String(req.params["referenceId"])));
  if (!p) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  try {
    res.json(statusBody(await refresh(p)));
  } catch (err) {
    // MTN unreachable: report PENDING so the client keeps polling instead of failing a payment that may have gone through.
    logger.error({ err, referenceId: p.referenceId }, "Payment status check failed");
    res.json(statusBody(p));
  }
});

function secretMatches(given: unknown): boolean {
  const secret = process.env.MTN_MOMO_WEBHOOK_SECRET;
  if (!secret || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * MTN's callback. MTN does not sign callbacks, so we do two things instead of trusting the body:
 * (1) the callback URL carries a secret (`?token=`, MTN_MOMO_WEBHOOK_SECRET) that must match, and
 * (2) the body is only a nudge: the payment's outcome is re-fetched from MTN by reference id.
 */
router.post("/payments/webhook", async (req, res): Promise<void> => {
  if (!isSimulator() && !secretMatches(req.query["token"] ?? req.header("x-webhook-token"))) {
    res.status(401).json({ error: "Invalid webhook token" });
    return;
  }
  const referenceId = typeof req.body?.referenceId === "string" ? req.body.referenceId : typeof req.body?.externalId === "string" ? undefined : undefined;
  const ref = referenceId ?? (typeof req.header("x-reference-id") === "string" ? req.header("x-reference-id") : undefined);
  if (!ref) {
    res.status(400).json({ error: "Missing reference id" });
    return;
  }
  const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.referenceId, ref));
  if (!p) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  try {
    await refresh(p);
  } catch (err) {
    logger.error({ err, referenceId: ref }, "Webhook could not confirm the payment");
    res.status(500).json({ error: "Could not confirm payment" });
    return;
  }
  res.json({ ok: true });
});

const AUTO_EXTEND_AFTER_MS = 60_000;

/**
 * Charges a passenger the difference between what they paid and the fare to `toStop` (their trip ran past their
 * declared stop). Returns the payment, or null when nothing is owed. Never charges twice for the same extension.
 */
export async function initiateExtension(tripRef: string, toStop: string): Promise<Payment | null> {
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, tripRef));
  if (!t) return null;
  const [veh] = await db.select().from(paymentsTable).where(eq(paymentsTable.tripRef, tripRef));
  if (!veh) return null;
  const found = await vehicleWithRoute(veh.vehicleCode);
  if (!found) return null;
  const stops = found.route.stopsJson;
  const from = stopIndex(stops, t.boardingStop ?? stops[0]!.name);
  const to = stopIndex(stops, toStop);
  if (to < 0 || to <= stopIndex(stops, t.alightingStop)) return null;
  const extra = amountDue(round2(stops[to]!.fare - stops[from]!.fare)) - Number(t.amountPaid);
  if (extra <= 0) return null;

  // One live extension per trip and stop: a retry or the auto timer reuses it.
  const [pending] = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.extendsTripRef, tripRef), eq(paymentsTable.alightingStop, stops[to]!.name), eq(paymentsTable.status, "PENDING")));
  if (pending) return pending;

  const referenceId = newReferenceId();
  const [row] = await db
    .insert(paymentsTable)
    .values({
      referenceId,
      tripRef: `${tripRef}-X${referenceId.slice(0, 4)}`,
      extendsTripRef: tripRef,
      passengerId: t.passengerId,
      vehicleCode: veh.vehicleCode,
      boardingStop: t.alightingStop,
      alightingStop: stops[to]!.name,
      amount: extra.toFixed(2),
      currency: momoCurrency(),
      payerPhone: veh.payerPhone,
    })
    .returning();
  try {
    await requestToPay({ referenceId, amount: extra, payerPhone: veh.payerPhone, note: `TrotroLink extension to ${stops[to]!.name}`, externalId: row!.tripRef });
  } catch (err) {
    logger.error({ err, referenceId }, "MoMo requestToPay failed for an extension");
    await settleFailure(referenceId, "Could not reach MTN MoMo.", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
  return row!;
}

/** Trips whose passenger ignored the overstay prompt for 60 s are charged automatically to the stop the vehicle reached. */
export async function processOverstays(): Promise<void> {
  const due = await db
    .select()
    .from(activeTripsTable)
    .innerJoin(transactionsTable, eq(activeTripsTable.transactionId, transactionsTable.id))
    .where(and(isNotNull(activeTripsTable.overstayStop), isNull(activeTripsTable.autoExtendedAt), lt(activeTripsTable.overstayAt, new Date(Date.now() - AUTO_EXTEND_AFTER_MS))));
  for (const { active_trips: a, transactions: t } of due) {
    await db.update(activeTripsTable).set({ autoExtendedAt: new Date() }).where(eq(activeTripsTable.id, a.id));
    if (t.tripRef && a.overstayStop) await initiateExtension(t.tripRef, a.overstayStop);
  }
  // Settle charges nobody is polling (the passenger's app is closed): ask MTN, and apply the answer.
  const pending = await db.select().from(paymentsTable).where(and(eq(paymentsTable.status, "PENDING"), isNotNull(paymentsTable.extendsTripRef)));
  for (const p of pending) await refresh(p).catch((err) => logger.error({ err, referenceId: p.referenceId }, "Could not settle a pending extension"));
}

export default router;
