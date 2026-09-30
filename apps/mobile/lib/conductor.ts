import { useCallback, useEffect, useState } from 'react';
import { CONDUCTOR_BONUS, type ResolvedVehicle } from '@trotrolink/shared';
import { api } from '@/lib/api';
import { getConductorVehicleCode } from '@/lib/storage';

/** Loads the conductor's vehicle and route from the API. */
export function useConductorVehicle() {
  const [data, setData] = useState<ResolvedVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(await api.resolveVehicle(await getConductorVehicleCode()));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}

// Mock figures until scans, payments and ratings are recorded server-side.
export const MOCK_TODAY = { total: 156.5, riders: 42, hoursOnline: 3.33, onBoard: 12 } as const;
export const MOCK_BONUS = { scans: 42, avgRating: 4.7 } as const;

/** Bonus unlocks at 200+ scans AND an average rating of 4.0 or better. */
export function bonusFor(scans: number, avgRating: number) {
  const earned = scans >= CONDUCTOR_BONUS.scans && avgRating >= CONDUCTOR_BONUS.minAvgRating ? CONDUCTOR_BONUS.amountGhs : 0;
  return { earned, target: CONDUCTOR_BONUS.amountGhs, progress: Math.min(1, scans / CONDUCTOR_BONUS.scans) };
}

export function formatOnline(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}
