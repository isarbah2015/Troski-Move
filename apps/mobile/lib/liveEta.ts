import { useEffect, useState } from 'react';
import { interpolatedEta, type ActiveTrip, type LatLng } from '@trotrolink/shared';
import { getPosition } from '@/lib/location';

/**
 * The trip's ETA, refreshed every 20 seconds. Between two anchors it is interpolated by the phone's GPS position along
 * the current leg when location is allowed, otherwise by the time since the conductor last marked a stop.
 */
export function useLiveEta(trip: ActiveTrip): number {
  const [pos, setPos] = useState<LatLng | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const p = await getPosition({ askPermission: true, timeoutMs: 4000 });
      if (active) setPos(p);
    };
    void refresh();
    const gps = setInterval(() => void refresh(), 30_000);
    const clock = setInterval(() => tick((n) => n + 1), 20_000);
    return () => {
      active = false;
      clearInterval(gps);
      clearInterval(clock);
    };
  }, []);

  const stops = trip.stops.map((s) => ({ name: s.name, fare: 0, etaMinutes: s.etaMinutes ?? 0, lat: s.lat, lng: s.lng }));
  const names = stops.map((s) => s.name);
  const live = interpolatedEta(stops, names.indexOf(trip.currentStop), names.indexOf(trip.alightingStop), {
    position: pos,
    lastMarkAt: trip.lastStopMarkedAt ? new Date(trip.lastStopMarkedAt).getTime() : null,
  });
  // Before the first stop mark there is nothing to interpolate from; show the server's figure.
  return trip.lastStopMarkedAt || pos ? live : trip.etaMinutes;
}
