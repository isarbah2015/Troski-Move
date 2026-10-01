import type { RouteStop } from './types';

/** Alighting counts as "at the stop" within this distance. GPS on cheap phones drifts, so it is a data point, never a gate. */
export const ALIGHT_RADIUS_M = 200;

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const hasCoords = (s: RouteStop | undefined): s is RouteStop & LatLng => !!s && s.lat !== undefined && s.lng !== undefined;

/** How far along the leg `from → to` a position is (0 at `from`, 1 at `to`), by projecting it onto the straight line between them. */
export function legProgress(from: LatLng, to: LatLng, pos: LatLng): number {
  // Equirectangular projection: accurate enough over a few kilometres.
  const kx = Math.cos(((from.lat + to.lat) / 2) * (Math.PI / 180));
  const vx = (to.lng - from.lng) * kx;
  const vy = to.lat - from.lat;
  const wx = (pos.lng - from.lng) * kx;
  const wy = pos.lat - from.lat;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return 0;
  return Math.min(1, Math.max(0, (wx * vx + wy * vy) / len2));
}

/**
 * Minutes until the passenger's stop. Between two anchors the ETA is interpolated: by the phone's GPS position
 * along the current leg when it is known, otherwise by the time since the conductor last marked a stop.
 * (Anchors, not stations: the vehicle is rarely exactly at one.)
 */
export function interpolatedEta(
  stops: RouteStop[],
  currentIdx: number,
  alightIdx: number,
  opts: { position?: LatLng | null; lastMarkAt?: number | null; now?: number } = {},
): number {
  if (currentIdx < 0 || alightIdx <= currentIdx) return 0;
  const leg = stops[currentIdx + 1]?.etaMinutes ?? 0;
  const rest = stops.slice(currentIdx + 2, alightIdx + 1).reduce((sum, s) => sum + s.etaMinutes, 0);

  let done = 0;
  const from = stops[currentIdx];
  const to = stops[currentIdx + 1];
  if (opts.position && hasCoords(from) && hasCoords(to)) {
    done = legProgress(from, to, opts.position);
  } else if (opts.lastMarkAt && leg > 0) {
    const elapsedMin = ((opts.now ?? Date.now()) - opts.lastMarkAt) / 60_000;
    done = Math.min(0.9, Math.max(0, elapsedMin / leg)); // never claim arrival before the conductor marks it
  }
  return Math.max(0, Math.round(leg * (1 - done) + rest));
}

/** Result of comparing where the passenger was when they confirmed alighting with their declared stop. */
export function alightCheck(stop: RouteStop | undefined, pos: LatLng | null | undefined): { distanceM: number; status: 'near' | 'far' } | null {
  if (!pos || !hasCoords(stop)) return null;
  const distanceM = Math.round(haversineM(stop, pos));
  return { distanceM, status: distanceM <= ALIGHT_RADIUS_M ? 'near' : 'far' };
}

/** The listed stop nearest a position, if it is within `maxM` metres. Stops with no coordinates are ignored. */
export function nearestStop(stops: RouteStop[], pos: LatLng, maxM: number): { index: number; stop: RouteStop; distanceM: number } | null {
  let best: { index: number; stop: RouteStop; distanceM: number } | null = null;
  stops.forEach((s, index) => {
    if (!hasCoords(s)) return;
    const distanceM = Math.round(haversineM(s, pos));
    if (distanceM <= maxM && (!best || distanceM < best.distanceM)) best = { index, stop: s, distanceM };
  });
  return best;
}

/** How close the phone must be to a stop for the app to treat it as "at the stop" while riding. */
export const AT_STOP_RADIUS_M = 150;
/** How close a passenger must be to a stop for the app to suggest it as "where you are getting on". */
export const BOARDING_RADIUS_M = 400;
