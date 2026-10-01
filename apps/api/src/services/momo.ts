import { randomUUID } from "node:crypto";
import { logger } from "../logger";

/**
 * MTN MoMo Collections client (request-to-pay).
 *
 * Simulator mode: when MTN_MOMO_API_KEY is unset there are no credentials to call MTN with, so a payment
 * "approves itself" SIMULATOR_APPROVE_MS after it was created. It is logged loudly and reported to clients
 * (`simulator: true`) so it can never be mistaken for a real charge.
 */

/** Dev knob: MOMO_SIMULATOR_APPROVE_MS lengthens the delay to test the pending and timeout screens. */
export const SIMULATOR_APPROVE_MS = Number(process.env.MOMO_SIMULATOR_APPROVE_MS ?? 3000);

export type MomoStatus = "PENDING" | "SUCCESSFUL" | "FAILED";
export type MomoResult = { status: MomoStatus; reason?: string; raw?: unknown };

type Config = {
  baseUrl: string;
  subscriptionKey: string;
  apiUser: string;
  apiKey: string;
  targetEnv: string;
  callbackUrl: string | undefined;
  currency: string;
  sandboxPayer: string;
};

function config(): Config | null {
  const apiKey = process.env.MTN_MOMO_API_KEY;
  if (!apiKey) return null;
  const targetEnv = process.env.MTN_MOMO_TARGET_ENV ?? "sandbox";
  const missing = ["MTN_MOMO_SUBSCRIPTION_KEY", "MTN_MOMO_API_USER"].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`MoMo is configured (MTN_MOMO_API_KEY set) but ${missing.join(", ")} is missing`);
  return {
    baseUrl: (process.env.MTN_MOMO_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com").replace(/\/$/, ""),
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY!,
    apiUser: process.env.MTN_MOMO_API_USER!,
    apiKey,
    targetEnv,
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
    // MTN's sandbox only accepts EUR; production Ghana collections are GHS.
    currency: process.env.MTN_MOMO_CURRENCY ?? (targetEnv === "sandbox" ? "EUR" : "GHS"),
    // A sandbox "payer" that always approves (MTN's published test MSISDN).
    sandboxPayer: process.env.MTN_MOMO_SANDBOX_PAYER ?? "46733123450",
  };
}

export function isSimulator(): boolean {
  return !process.env.MTN_MOMO_API_KEY;
}

/** Live (non-sandbox) charges need the payer's own MoMo number; sandbox and the simulator do not. */
export function payerPhoneRequired(): boolean {
  return !isSimulator() && (process.env.MTN_MOMO_TARGET_ENV ?? "sandbox") !== "sandbox";
}

export function momoCurrency(): string {
  return config()?.currency ?? "GHS";
}

if (isSimulator()) {
  logger.warn("MOMO_SIMULATOR_MODE: MTN_MOMO_API_KEY is not set. Payments auto-approve after 3 seconds and no money moves.");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(c: Config): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) return cachedToken.value;
  const res = await fetch(`${c.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.apiUser}:${c.apiKey}`).toString("base64")}`,
      "Ocp-Apim-Subscription-Key": c.subscriptionKey,
    },
  });
  if (!res.ok) throw new Error(`MoMo token request failed (${res.status})`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

function headers(c: Config, token: string, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, "X-Target-Environment": c.targetEnv, "Ocp-Apim-Subscription-Key": c.subscriptionKey, ...extra };
}

/** Asks the payer's wallet to approve a charge. Resolves once MTN accepted the request (HTTP 202). */
export async function requestToPay(p: { referenceId: string; amount: number; payerPhone?: string | null; note: string; externalId: string }): Promise<void> {
  const c = config();
  if (!c) return; // simulator: nothing to send
  const token = await accessToken(c);
  const msisdn = (c.targetEnv === "sandbox" ? c.sandboxPayer : (p.payerPhone ?? "")).replace(/^\+/, "");
  if (!msisdn) throw new Error("A MoMo number is required to pay");
  const res = await fetch(`${c.baseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: headers(c, token, {
      "X-Reference-Id": p.referenceId,
      "Content-Type": "application/json",
      ...(c.callbackUrl ? { "X-Callback-Url": c.callbackUrl } : {}),
    }),
    body: JSON.stringify({
      amount: p.amount.toFixed(2),
      currency: c.currency,
      externalId: p.externalId,
      payer: { partyIdType: "MSISDN", partyId: msisdn },
      payerMessage: p.note,
      payeeNote: p.note,
    }),
  });
  if (res.status !== 202) throw new Error(`MoMo requesttopay failed (${res.status})`);
}

/** The authoritative state of a payment. Webhooks never decide this; they only prompt us to ask MTN. */
export async function getPaymentStatus(referenceId: string, createdAt: Date): Promise<MomoResult> {
  const c = config();
  if (!c) {
    const approved = Date.now() - createdAt.getTime() >= SIMULATOR_APPROVE_MS;
    return { status: approved ? "SUCCESSFUL" : "PENDING", raw: { simulator: true } };
  }
  const token = await accessToken(c);
  const res = await fetch(`${c.baseUrl}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`, { headers: headers(c, token) });
  if (!res.ok) throw new Error(`MoMo status request failed (${res.status})`);
  const raw = (await res.json()) as { status?: string; reason?: string | { code?: string; message?: string } };
  const status = raw.status === "SUCCESSFUL" ? "SUCCESSFUL" : raw.status === "FAILED" ? "FAILED" : "PENDING";
  const reason = typeof raw.reason === "string" ? raw.reason : raw.reason?.message ?? raw.reason?.code;
  return { status, reason, raw };
}

export const newReferenceId = () => randomUUID();
