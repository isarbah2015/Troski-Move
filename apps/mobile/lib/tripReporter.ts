import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/identity';
import { getPosition } from '@/lib/location';
import { getActiveTrip } from '@/lib/storage';

const EVERY_MS = 10_000;

/**
 * While a paid trip is on, tells the server where the phone is, every ten seconds. That is how the trip follows the road
 * with nobody tapping: the stop moves on, "your stop is next" arrives, and "you have arrived" appears. Location is
 * optional: if it is off or weak the trip still works (the timetable ETA counts down, and "I got off" is always there).
 * It never asks for permission by itself; the permission is asked once, at scan.
 */
export function useTripReporter(): void {
  const busy = useRef(false);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (busy.current || stop) return;
      busy.current = true;
      try {
        const trip = await getActiveTrip();
        if (!trip) return;
        const pos = await getPosition({ timeoutMs: 4000 });
        if (!pos || stop) return;
        await api.reportPosition({ tripId: trip.tripId, deviceId: await getDeviceId(), lat: pos.lat, lng: pos.lng, ...(pos.accuracy !== undefined ? { accuracy: pos.accuracy } : {}) });
      } catch {
        // Offline or no trip on the server yet: try again in ten seconds.
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), EVERY_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, []);
}
