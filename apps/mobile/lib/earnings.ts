/** Local-time YYYY-MM-DD (not UTC), so "today" matches the conductor's calendar day. */
export function localDateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const DEFAULT_SPLITS = { ownerDrop: 60, conductorWage: 30, fuelCost: 25 } as const;

/** What the conductor keeps: fares collected minus owner drop, conductor wage and fuel. */
export function netEarnings(total: number, ownerDrop: number, conductorWage: number, fuelCost: number): number {
  return Math.round((total - (ownerDrop + conductorWage + fuelCost)) * 100) / 100;
}

/** Parses typed input like "12.5" (empty or partial input counts as 0). */
export function parseAmount(text: string): number {
  const n = parseFloat(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Keeps digits and one decimal point, with at most 2 decimals. */
export function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The Monday-to-Sunday week containing `today`, with each day's local date key. */
export function weekDays(today = new Date()) {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return DAY_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, key: localDateKey(d), isToday: localDateKey(d) === localDateKey(today), isFuture: d > today && localDateKey(d) !== localDateKey(today) };
  });
}
