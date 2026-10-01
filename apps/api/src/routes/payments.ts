import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { InitiatePaymentBody, type InitiatePaymentResponse, type PaymentStatusResponse } from "@trotrolink/shared";
import { db } from "../db";
import { paymentsTable, transactionsTable, type Payment } from "../db/schema";
import { amountDue, checkTrip, guestUserId, insertTrip, userExists, vehicleWithRoute } from "../lib";
import { logger } from "../logger";
import { getPaymentStatus, isSimulator, momoCurrency, newReferenceId, payerPhoneRequired, requestToPay } from "../services/momo";

const router: IRouter = Router();

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
    const body: InitiatePaymentResponse = { referenceId: existing.referenceId, status: existing.status, simulator: isSimulator() };
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

  const body: InitiatePaymentResponse = { referenceId, status: "PENDING", simulator: isSimulator() };
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

export default router;
