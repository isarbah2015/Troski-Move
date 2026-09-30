import type { TripRecord } from '@trotrolink/shared';

export const GUEST_USER = { name: 'Guest', phone: '+233••••••', verified: false } as const;

export type Tier = 'Bronze' | 'Silver' | 'Gold';

/** Loyalty tier from lifetime trips: Bronze < 10, Silver 10–49, Gold 50+. */
export function tierFor(tripCount: number): Tier {
  if (tripCount >= 50) return 'Gold';
  if (tripCount >= 10) return 'Silver';
  return 'Bronze';
}

export function lifetimeStats(trips: TripRecord[]) {
  const spent = trips.reduce((sum, t) => sum + t.amountPaid, 0);
  return { trips: trips.length, spent, tier: tierFor(trips.length) };
}

function ghanaLocal(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
  return null;
}

/** +233 24 ••• ••89 */
export function maskPhone(phone: string): string {
  const local = ghanaLocal(phone);
  return local ? `+233 ${local.slice(0, 2)} ••• ••${local.slice(-2)}` : phone;
}

/** 024 ••• ••89 */
export function maskMomo(phone: string): string | null {
  const local = ghanaLocal(phone);
  return local ? `0${local.slice(0, 2)} ••• ••${local.slice(-2)}` : null;
}

export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86_400_000).toDateString() === d.toDateString();
  if (sameDay) return `Today, ${time}`;
  if (yesterday) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}
