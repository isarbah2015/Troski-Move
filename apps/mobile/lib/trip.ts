import type { ActiveTrip, ResolvedVehicle, Stop, TripRecord } from '@trotrolink/shared';

/**
 * Builds the trip that starts after payment. Boarding is the route origin and live tracking does not
 * exist yet, so the vehicle is placed one stop past the origin. Replace with conductor-driven
 * current-stop updates from the API.
 */
export function buildTrip(resolved: ResolvedVehicle, alighting: Stop, now = new Date()): ActiveTrip {
  const names = resolved.route.stops.map((s) => s.name);
  const alightIdx = Math.max(names.indexOf(alighting.name), 1);
  const currentIdx = alightIdx > 1 ? 1 : 0;
  const eta = resolved.route.stops
    .slice(currentIdx + 1, alightIdx + 1)
    .reduce((sum, s) => sum + s.etaMinutes, 0);
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 900) + 100);

  return {
    tripId: `TRX-${yymmdd}-${seq}`,
    vehicleShortCode: resolved.vehicle.shortCode,
    driverName: resolved.vehicle.driverName,
    routeName: resolved.route.name,
    boardingStop: names[0]!,
    alightingStop: alighting.name,
    currentStop: names[currentIdx]!,
    stopsRemaining: alightIdx - currentIdx,
    etaMinutes: eta,
    amountPaid: alighting.amountToPay,
    startedAt: now.toISOString(),
    stops: names.map((name, i) => ({
      name,
      status: i < currentIdx ? 'passed' : i === currentIdx ? 'current' : 'upcoming',
      etaMinutes: resolved.route.stops[i]!.etaMinutes,
    })),
    vehicleId: resolved.vehicle.id,
    conductorName: resolved.vehicle.conductorName,
  };
}

/** 0–1 share of the ride (boarding → alighting) already covered. */
export function tripProgress(trip: ActiveTrip): number {
  const names = trip.stops.map((s) => s.name);
  const total = names.indexOf(trip.alightingStop) - names.indexOf(trip.boardingStop);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - trip.stopsRemaining / total));
}

export function buildTripRecord(resolved: ResolvedVehicle, alighting: Stop, trip: ActiveTrip): TripRecord {
  return {
    tripId: trip.tripId,
    vehicleShortCode: trip.vehicleShortCode,
    routeName: trip.routeName,
    boardingStop: trip.boardingStop,
    alightingStop: trip.alightingStop,
    startedAt: trip.startedAt,
    officialFare: alighting.officialFare,
    amountPaid: alighting.amountToPay,
    rating: null,
    vehicleId: trip.vehicleId,
    driverName: trip.driverName,
    conductorName: trip.conductorName,
    stops: resolved.route.stops.map((s) => ({ name: s.name, officialFare: s.officialFare, etaMinutes: s.etaMinutes })),
  };
}

/**
 * Moves the vehicle one stop along the route and recomputes stops away and ETA.
 * Real current-stop updates will come from the conductor's stop marks once backend sync exists;
 * until then this only backs the dev-only "Advance one stop" link.
 */
export function advanceTrip(trip: ActiveTrip): ActiveTrip {
  const names = trip.stops.map((s) => s.name);
  const alightIdx = names.indexOf(trip.alightingStop);
  const currentIdx = names.indexOf(trip.currentStop);
  if (currentIdx < 0 || currentIdx >= alightIdx) return trip;
  const next = currentIdx + 1;
  return {
    ...trip,
    currentStop: names[next]!,
    stopsRemaining: alightIdx - next,
    etaMinutes: trip.stops.slice(next + 1, alightIdx + 1).reduce((sum, s) => sum + (s.etaMinutes ?? 0), 0),
    stops: trip.stops.map((s, i) => ({ ...s, status: i < next ? 'passed' : i === next ? 'current' : 'upcoming' })),
  };
}
