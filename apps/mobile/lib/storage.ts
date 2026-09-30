import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveTrip } from '@trotrolink/shared';

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
