import type { ServerTrip } from '@trotrolink/shared';

export type Board = {
  current: string | null;
  /** The stop after the current one, or null at the end of the line. */
  next: string | null;
  /** Getting off at the stop the trotro is at right now. */
  here: ServerTrip[];
  /** Getting off at the next stop. */
  nextPax: ServerTrip[];
  /** Getting off further on, grouped by stop in route order. */
  later: Array<{ stop: string; pax: ServerTrip[] }>;
  /** Still on board after their stop (the server flags these). */
  past: ServerTrip[];
  /** Every paid passenger on board. */
  total: number;
};

/** Sorts the paid passengers into "who is getting off when", the way a conductor reads the vehicle. */
export function buildBoard(stopNames: string[], current: string | null, pax: ServerTrip[]): Board {
  const ci = current ? stopNames.indexOf(current) : -1;
  const next = ci >= 0 && ci + 1 < stopNames.length ? stopNames[ci + 1]! : null;
  const past = pax.filter((p) => p.overstay);
  const rest = pax.filter((p) => !p.overstay);
  const here = rest.filter((p) => current !== null && p.alightingStop === current);
  const nextPax = rest.filter((p) => next !== null && p.alightingStop === next);
  const others = rest.filter((p) => p.alightingStop !== current && p.alightingStop !== next);
  const groups = new Map<string, ServerTrip[]>();
  for (const p of others) groups.set(p.alightingStop, [...(groups.get(p.alightingStop) ?? []), p]);
  const later = [...groups.entries()]
    .sort((a, b) => stopNames.indexOf(a[0]) - stopNames.indexOf(b[0]))
    .map(([stop, list]) => ({ stop, pax: list }));
  return { current, next, here, nextPax, later, past, total: pax.length };
}

/** A short, readable label for a passenger. Passengers are anonymous guests, so the last characters of the trip reference tell them apart. */
export const paxLabel = (tripId: string) => `Passenger · ${tripId.slice(-4)}`;

/** The sentence read aloud on approaching a stop. */
export function announcement(b: Board): string {
  if (!b.next) return 'End of the line.';
  const n = b.nextPax.length;
  const who = n === 0 ? 'Nobody is getting off' : n === 1 ? 'One passenger getting off' : `${n} passengers getting off`;
  const pastNote = b.past.length ? ` ${b.past.length} passenger${b.past.length === 1 ? ' is' : 's are'} past their stop.` : '';
  return `Next stop: ${b.next}. ${who}. All paid.${pastNote}`;
}

/** What a scanned or typed passenger code points at: a full trip reference, or its last few characters. */
export function normaliseCode(raw: string): string {
  const last = raw.trim().split('/').pop() ?? '';
  return last.replace(/\s+/g, '').toUpperCase();
}

export function findPassenger(pax: ServerTrip[], raw: string): ServerTrip | null {
  const code = normaliseCode(raw);
  if (code.length < 4) return null;
  return pax.find((p) => p.tripId.toUpperCase() === code) ?? pax.find((p) => p.tripId.toUpperCase().endsWith(code)) ?? null;
}
