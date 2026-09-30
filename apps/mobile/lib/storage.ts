import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { ActiveTrip, APP_LANGUAGES, LocalUser, TripRecord, type AppLanguage } from '@trotrolink/shared';

const ACTIVE_TRIP_KEY = 'activeTrip';

/** Returns the stored trip, or null when there is none or the stored value is unreadable. */
export async function getActiveTrip(): Promise<ActiveTrip | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
    if (!raw) return null;
    const parsed = ActiveTrip.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveActiveTrip(trip: ActiveTrip): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip));
}

export async function clearActiveTrip(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
}

// ---- Profile data -------------------------------------------------------------------------------

const KEYS = { user: 'user', history: 'tripHistory', role: 'role', language: 'language', notifications: 'notifications' } as const;
const HISTORY_CAP = 200;

async function readJson<T>(key: string, parse: (v: unknown) => T | null): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<LocalUser | null> {
  return readJson(KEYS.user, (v) => {
    const r = LocalUser.safeParse(v);
    return r.success ? r.data : null;
  });
}

export async function saveUser(user: LocalUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.user, JSON.stringify(user));
}

/** Newest first. */
export async function getTripHistory(): Promise<TripRecord[]> {
  const list = await readJson(KEYS.history, (v) => {
    const r = z.array(TripRecord).safeParse(v);
    return r.success ? r.data : null;
  });
  return (list ?? []).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function appendTripRecord(record: TripRecord): Promise<void> {
  const existing = await getTripHistory();
  const next = [record, ...existing.filter((t) => t.tripId !== record.tripId)].slice(0, HISTORY_CAP);
  await AsyncStorage.setItem(KEYS.history, JSON.stringify(next));
}

export async function saveTripHistory(list: TripRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.history, JSON.stringify(list));
}

export async function clearTripHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.history);
}

export type Role = 'passenger' | 'conductor';

export async function getRole(): Promise<Role> {
  return (await AsyncStorage.getItem(KEYS.role)) === 'conductor' ? 'conductor' : 'passenger';
}

export async function setRole(role: Role): Promise<void> {
  await AsyncStorage.setItem(KEYS.role, role);
}

export async function getLanguage(): Promise<AppLanguage> {
  const v = await AsyncStorage.getItem(KEYS.language);
  return (APP_LANGUAGES as readonly string[]).includes(v ?? '') ? (v as AppLanguage) : 'English';
}

export async function setLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(KEYS.language, language);
}

export async function getNotifications(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.notifications)) !== 'off';
}

export async function setNotifications(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.notifications, on ? 'on' : 'off');
}

/** Sign out: wipes every key this app stores. */
export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.clear();
}

// ---- Conductor ----------------------------------------------------------------------------------

const CONDUCTOR_VEHICLE_KEY = 'conductorVehicle';
const CONDUCTOR_QR_KEY = 'conductorQr';

/** The vehicle short code this conductor works on; CIR01 until conductor sign-in exists. */
export async function getConductorVehicleCode(): Promise<string> {
  return (await AsyncStorage.getItem(CONDUCTOR_VEHICLE_KEY)) ?? 'CIR01';
}

export type QrState = { version: number; printedAt: string | null };

export async function getQrState(): Promise<QrState> {
  try {
    const raw = await AsyncStorage.getItem(CONDUCTOR_QR_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<QrState>) : {};
    return { version: typeof v.version === 'number' ? v.version : 1, printedAt: typeof v.printedAt === 'string' ? v.printedAt : null };
  } catch {
    return { version: 1, printedAt: null };
  }
}

export async function saveQrState(state: QrState): Promise<void> {
  await AsyncStorage.setItem(CONDUCTOR_QR_KEY, JSON.stringify(state));
}

// ---- Daily splits ---------------------------------------------------------------------------------

export type DailySplitRecord = {
  date: string;
  total: number;
  ownerDrop: number;
  conductorWage: number;
  fuelCost: number;
  net: number;
  savedAt: string;
};

const DAILY_SPLITS_KEY = 'dailySplits';

/** `dailySplits` is one object keyed by local YYYY-MM-DD. */
export async function getDailySplits(): Promise<Record<string, DailySplitRecord>> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_SPLITS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, DailySplitRecord>) : {};
  } catch {
    return {};
  }
}

export async function saveDailySplit(record: DailySplitRecord): Promise<void> {
  const all = await getDailySplits();
  all[record.date] = record;
  await AsyncStorage.setItem(DAILY_SPLITS_KEY, JSON.stringify(all));
}
