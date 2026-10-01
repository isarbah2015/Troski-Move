import { useEffect, useRef, useState } from 'react';
import { haversineM } from '@trotrolink/shared';

type GpsStop = { name: string; lat?: number; lng?: number };
import { getPosition } from '@/lib/location';

/** The trotro counts as "at" a stop inside this radius. */
export const AUTO_STOP_RADIUS_M = 100;
const POLL_MS = 8000;

export type GpsState = 'off' | 'searching' | 'on';

/**
 * Marks stops automatically from the phone's GPS: when the trotro comes within 100 m of a stop further along the route,
 * `onArrive` fires once for it. No GPS or no permission just reports "searching" and the conductor can tap instead.
 */
export function useAutoStops(p: { stops: GpsStop[]; current: string | null; enabled: boolean; onArrive: (stop: string) => void }): GpsState {
  const [state, setState] = useState<GpsState>('off');
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    if (!p.enabled || p.stops.length === 0) {
      setState('off');
      return;
    }
    let stop = false;
    const tick = async () => {
      const pos = await getPosition({ askPermission: true, timeoutMs: 4000 });
      if (stop) return;
      if (!pos) {
        setState('searching');
        return;
      }
      setState('on');
      const { stops, current, onArrive } = latest.current;
      const ci = current ? stops.findIndex((s) => s.name === current) : -1;
      // Only stops ahead of the current one: the trotro does not drive backwards along its route.
      const hit = stops.findIndex((s, i) => i > ci && s.lat !== undefined && s.lng !== undefined && haversineM({ lat: s.lat, lng: s.lng }, pos) <= AUTO_STOP_RADIUS_M);
      if (hit >= 0) onArrive(stops[hit]!.name);
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [p.enabled, p.stops.length]);

  return state;
}
