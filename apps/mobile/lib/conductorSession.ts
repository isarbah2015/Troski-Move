import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConductorLoginResponse } from '@trotrolink/shared';

const KEY = 'conductorSession';
const VEHICLE_KEY = 'conductorVehicle';

export type ConductorSession = Pick<ConductorLoginResponse, 'token' | 'expiresAt' | 'vehicleCode' | 'conductorName' | 'conductorId'>;

const listeners = new Set<(s: ConductorSession | null) => void>();
let cached: ConductorSession | null | undefined;

function live(s: ConductorSession | null): ConductorSession | null {
  return s && new Date(s.expiresAt) > new Date() ? s : null;
}

export async function getSession(): Promise<ConductorSession | null> {
  if (cached === undefined) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cached = raw ? (JSON.parse(raw) as ConductorSession) : null;
    } catch {
      cached = null;
    }
  }
  return live(cached ?? null);
}

export async function saveSession(session: ConductorSession): Promise<void> {
  cached = session;
  await AsyncStorage.multiSet([[KEY, JSON.stringify(session)], [VEHICLE_KEY, session.vehicleCode]]);
  listeners.forEach((l) => l(session));
}

/** Ends the local session (expired, rejected by the API, or signed out). Queued conductor actions wait for the next login. */
export async function clearSession(): Promise<void> {
  cached = null;
  await AsyncStorage.removeItem(KEY);
  listeners.forEach((l) => l(null));
}

/** The token the API client attaches to every request. */
export async function getAuthToken(): Promise<string | null> {
  return (await getSession())?.token ?? null;
}

/** `undefined` while loading, `null` when signed out. */
export function useConductorSession(): ConductorSession | null | undefined {
  const [session, setSession] = useState<ConductorSession | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void getSession().then((s) => active && setSession(s));
    listeners.add(setSession);
    // Sessions last 12 hours: drop an expired one without waiting for the API to say no.
    const timer = setInterval(() => void getSession().then((s) => active && setSession((prev) => (prev && !s ? null : prev))), 60_000);
    return () => {
      active = false;
      listeners.delete(setSession);
      clearInterval(timer);
    };
  }, []);
  return session;
}
