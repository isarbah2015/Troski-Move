import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@trotrolink/api-client';
import type { AlightBody, DisputeBody, RatingSubmission, SplitBody, StopMarkBody, UnpaidDisputeBody } from '@trotrolink/shared';
import { api } from '@/lib/api';

const QUEUE_KEY = 'offlineQueue';
export const FLUSH_INTERVAL_MS = 30_000;

/** Every write the app makes to the API. Each is idempotent on the server, so a retry can never double-apply. */
export type SyncAction =
  | { type: 'stop'; body: StopMarkBody }
  | { type: 'alight'; body: AlightBody }
  | { type: 'rating'; body: RatingSubmission }
  | { type: 'split'; body: SplitBody }
  | { type: 'dispute'; body: DisputeBody }
  | { type: 'unpaid'; body: UnpaidDisputeBody };

type QueueItem = { id: string; action: SyncAction; queuedAt: string; waitingForSignIn?: boolean };

async function perform(action: SyncAction): Promise<void> {
  // A 'start' action queued by an older build is ignored: trips now begin from a successful MoMo payment.
  switch (action.type as string) {
    case 'stop':
      await api.markStop((action as Extract<SyncAction, { type: 'stop' }>).body);
      return;
    case 'alight':
      await api.alight((action as Extract<SyncAction, { type: 'alight' }>).body);
      return;
    case 'rating':
      await api.submitRating((action as Extract<SyncAction, { type: 'rating' }>).body);
      return;
    case 'split':
      await api.saveSplit((action as Extract<SyncAction, { type: 'split' }>).body);
      return;
    case 'dispute':
      await api.reportTrip((action as Extract<SyncAction, { type: 'dispute' }>).body);
      return;
    case 'unpaid':
      await api.reportUnpaid((action as Extract<SyncAction, { type: 'unpaid' }>).body);
      return;
  }
}

/** Network failures and 5xx/408/429 are worth retrying; any other 4xx means the request itself is wrong. */
function retryable(e: unknown): boolean {
  return e instanceof ApiError ? e.retryable : true;
}

const listeners = new Set<(pending: number) => void>();
let flushing = false;

async function readQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  listeners.forEach((l) => l(queue.length));
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Sends an action now; if the network or server fails it is saved to `offlineQueue` and retried later.
 * If earlier actions are still waiting, this one queues behind them so the server sees them in order.
 */
export async function sendOrQueue(action: SyncAction): Promise<'sent' | 'queued' | 'rejected'> {
  const queue = await readQueue();
  // Only items that are really retrying block new actions; ones waiting for a conductor sign-in do not.
  if (!queue.some((i) => !i.waitingForSignIn)) {
    try {
      await perform(action);
      return 'sent';
    } catch (e) {
      if (!retryable(e)) {
        console.warn('Sync rejected by server', action.type, e instanceof Error ? e.message : e);
        return 'rejected';
      }
    }
  }
  await writeQueue([...queue, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, queuedAt: new Date().toISOString() }]);
  return 'queued';
}

/** True for "your conductor session ended": the action waits for the next sign-in and must not block the rest. */
const needsSignIn = (e: unknown) => e instanceof ApiError && e.status === 401;

/**
 * Retries queued actions in order. Stops at the first transient failure; drops actions the server rejects;
 * keeps (but steps over) actions that are waiting for a conductor to sign in.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const waiting: QueueItem[] = [];
    let queue = await readQueue();
    while (queue.length > 0) {
      const [head, ...rest] = queue;
      try {
        await perform(head!.action);
      } catch (e) {
        if (needsSignIn(e)) waiting.push({ ...head!, waitingForSignIn: true });
        else if (retryable(e)) {
          await writeQueue([...waiting, head!, ...rest]);
          return;
        } else console.warn('Dropping rejected queued action', head!.action.type, e instanceof Error ? e.message : e);
      }
      queue = rest;
      await writeQueue([...waiting, ...queue]);
    }
  } finally {
    flushing = false;
  }
}

/** Live count of actions waiting to sync, for the banner. */
export function usePendingSync(): number {
  const [pending, setPending] = useState(0);
  useEffect(() => {
    void pendingCount().then(setPending);
    listeners.add(setPending);
    return () => {
      listeners.delete(setPending);
    };
  }, []);
  return pending;
}

/** Mount once at the root: flushes on launch, every 30 seconds, and whenever the app returns to the foreground. */
export function useSyncLoop() {
  useEffect(() => {
    void flushQueue();
    const timer = setInterval(() => void flushQueue(), FLUSH_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flushQueue();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}
