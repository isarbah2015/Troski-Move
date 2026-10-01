import type { ActiveTrip, ResolvedVehicle, ServerTrip, Stop, TripRecord } from '@trotrolink/shared';

/** A short public reference, e.g. TRX-260930-K7Q2. The client makes it so a retried `start` request is idempotent. */
export function newTripId(now = new Date()): string {
  const yymmdd = now.toISOString().slice(2, 10).replace(/-/g, '');
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `TRX-${yymmdd}-${tail}`;
}

/**
 * Builds the trip that starts after payment. Boarding is the route origin and the vehicle starts
 * there; from now on the conductor's stop marks (via the API) move it forward.
 */
export function buildTrip(resolved: ResolvedVehicle, alighting: Stop, tripId: string, now = new Date()): ActiveTrip {
  const names = resolved.route.stops.map((s) => s.name);
  const alightIdx = Math.max(names.indexOf(alighting.name), 1);
  const currentIdx = 0;
  const eta = resolved.route.stops
    .slice(currentIdx + 1, alightIdx + 1)
    .reduce((sum, s) => sum + s.etaMinutes, 0);

  return {
    tripId,
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

/** Applies the server's view of a trip (current stop, stops away, ETA) onto the locally stored one. */
export function applyServerTrip(trip: ActiveTrip, server: ServerTrip): ActiveTrip {
  const names = trip.stops.map((s) => s.name);
  const currentIdx = names.indexOf(server.currentStop);
  if (currentIdx < 0) return trip;
  return {
    ...trip,
    alightingStop: server.alightingStop,
    amountPaid: server.amountPaid,
    currentStop: server.currentStop,
    stopsRemaining: server.stopsRemaining,
    etaMinutes: server.etaMinutes,
    stops: trip.stops.map((s, i) => ({ ...s, status: i < currentIdx ? 'passed' : i === currentIdx ? 'current' : 'upcoming' })),
  };
}
