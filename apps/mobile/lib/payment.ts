import { ApiError } from '@trotrolink/api-client';
import type { ResolvedVehicle, Stop } from '@trotrolink/shared';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/identity';
import { getUser } from '@/lib/storage';

export const POLL_EVERY_MS = 3_000;
export const PAY_TIMEOUT_MS = 60_000;

export type PayOutcome =
  | { kind: 'success'; tripId: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'timeout'; referenceId: string };

/** A MoMo wallet number from the signed-in user, if it looks real (guests have a masked placeholder). */
async function payerPhone(): Promise<string | undefined> {
  const user = await getUser();
  const digits = user?.phone.replace(/[^\d+]/g, '');
  return digits && /^\+?\d{9,15}$/.test(digits) ? digits : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Charges the passenger via MoMo and waits for the answer. `onPending` fires once the request reached the
 * phone (so the UI can say "check your phone"). Never resolves SUCCESS unless the server confirmed it.
 */
export async function payForTrip(p: {
  resolved: ResolvedVehicle;
  stop: Stop;
  boardingStop: string;
  tripId: string;
  customStopNote?: string;
  onPending: (info: { referenceId: string; simulator: boolean; tripId: string }) => void;
}): Promise<PayOutcome> {
  let referenceId: string;
  let tripId = p.tripId;
  try {
    const started = await api.initiatePayment({
      tripId: p.tripId,
      deviceId: await getDeviceId(),
      vehicleCode: p.resolved.vehicle.shortCode,
      boardingStop: p.boardingStop,
      alightingStop: p.stop.name,
      amount: p.stop.amountToPay,
      ...(p.customStopNote ? { customStopNote: p.customStopNote } : {}),
      payerPhone: await payerPhone(),
    });
    referenceId = started.referenceId;
    tripId = started.tripId; // an identical pending payment may be handed back under its own reference
    if (started.status === 'SUCCESSFUL') return { kind: 'success', tripId };
    if (started.status === 'FAILED') return { kind: 'failed', reason: 'This payment was already declined. Try again.' };
    p.onPending({ referenceId, simulator: started.simulator, tripId });
  } catch (e) {
    return { kind: 'failed', reason: e instanceof ApiError ? e.message : "Couldn't reach the server. Check your connection and try again." };
  }
  return waitForPayment(referenceId, tripId);
}

/** Polls every 3 s for up to 60 s. Network blips while polling are ignored: the payment may still be going through. */
export async function waitForPayment(referenceId: string, tripId: string): Promise<PayOutcome> {
  const deadline = Date.now() + PAY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_EVERY_MS);
    try {
      const s = await api.paymentStatus(referenceId);
      if (s.status === 'SUCCESSFUL') return { kind: 'success', tripId };
      if (s.status === 'FAILED') return { kind: 'failed', reason: s.reason ?? 'The payment was declined.' };
    } catch {
      // keep polling
    }
  }
  return { kind: 'timeout', referenceId };
}
