const round2 = (n: number) => Math.round(n * 100) / 100;

/** The fare steps GPRTU can round a passenger's price up to. Whole cedis is the original rule. */
export const ROUNDING_STEPS = [1, 0.5, 0.1, 0.05] as const;

/** Key for a stop-to-stop fare override: `Odorkor|Mallam`. Looked up in either direction. */
export const pairKey = (from: string, to: string) => `${from}|${to}`;

type FareStop = { name: string; fare: number };

/**
 * The official fare between two stops of a route. A specific stop-to-stop price set by the union (a short hop that
 * does not follow the usual difference) wins; otherwise it is the difference between the two stops' fares from the
 * origin. Returns null when either stop is not on the route or the trip does not run forward.
 */
export function tripFare(stops: FareStop[], pairs: Record<string, number> | undefined, from: string, to: string): number | null {
  const f = stops.findIndex((s) => s.name.toLowerCase() === from.trim().toLowerCase());
  const t = stops.findIndex((s) => s.name.toLowerCase() === to.trim().toLowerCase());
  if (f < 0 || t < 0 || t <= f) return null;
  const a = stops[f]!.name;
  const b = stops[t]!.name;
  const override = pairs?.[pairKey(a, b)] ?? pairs?.[pairKey(b, a)];
  return override !== undefined ? round2(override) : round2(stops[t]!.fare - stops[f]!.fare);
}

/** What the passenger pays: the official fare rounded up to the step (whole cedis by default). */
export function payAmount(official: number, step = 1): number {
  if (official <= 0) return 0;
  const s = step > 0 ? step : 1;
  return round2(Math.ceil(official / s - 1e-9) * s);
}
