import type { TripRecord } from '@trotrolink/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, DEMO_MODE } from '@/lib/api';
import { seedTrip } from '@/lib/demoServer';
import { getDeviceId } from '@/lib/identity';
import { appendTripRecord, getActiveTrip, saveActiveTrip, saveTripHistory, saveUser } from '@/lib/storage';
import { buildTrip, buildTripRecord, newTripId } from '@/lib/trip';

const SEEDED_KEY = 'demoTripSeeded';

const STOPS = [
  { name: 'Circle', officialFare: 0, etaMinutes: 0 },
  { name: 'Kaneshie', officialFare: 1.5, etaMinutes: 8 },
  { name: 'Odorkor', officialFare: 3.5, etaMinutes: 10 },
  { name: 'Mallam', officialFare: 6.0, etaMinutes: 12 },
  { name: 'Kasoa', officialFare: 10.0, etaMinutes: 20 },
];

/** Dev-only: fills the Profile with a demo user and 12 trips. */
export async function loadDemoProfile() {
  await saveUser({ name: 'Kwame Asante', phone: '+233244567889', verified: true });
  const ratings = [4, 5, null, 4, 5, 3, 5, 4, 5, 4, null, 5];
  const legs: Array<[number, number]> = [[0, 2], [1, 3], [0, 4], [2, 4], [0, 1], [1, 2], [0, 3], [0, 2], [2, 3], [0, 4], [1, 4], [0, 2]];
  const now = Date.now();
  const trips: TripRecord[] = legs.map(([from, to], i) => {
    const official = STOPS[to]!.officialFare - STOPS[from]!.officialFare;
    return {
      tripId: `TRX-DEMO-${String(i + 1).padStart(3, '0')}`,
      vehicleShortCode: `CIR0${(i % 3) + 1}`,
      routeName: 'Circle → Kasoa via Kaneshie',
      boardingStop: STOPS[from]!.name,
      alightingStop: STOPS[to]!.name,
      startedAt: new Date(now - i * 26 * 3_600_000).toISOString(),
      officialFare: official,
      amountPaid: Math.ceil(official - 1e-9),
      rating: ratings[i] ?? null,
      driverName: 'Kwame Mensah',
      conductorName: 'Yaw Boateng',
      arrivedAt: new Date(now - i * 26 * 3_600_000 + 25 * 60_000).toISOString(),
      stops: STOPS,
    };
  });
  await saveTripHistory(trips);
}

/**
 * Demo mode only, once per install: starts the story with a passenger already riding. A paid trip on CIR01 from
 * Circle to Mallam, the trotro now at Kaneshie, so the Trip tab opens on the live interface instead of an empty state.
 * The conductor role (Profile) can then mark Odorkor and Mallam to bring the trip to its arrival and rating.
 */
export async function seedDemoActiveTrip() {
  if (!DEMO_MODE) return;
  try {
    if ((await AsyncStorage.getItem(SEEDED_KEY)) || (await getActiveTrip())) return;
    await AsyncStorage.setItem(SEEDED_KEY, '1');
    const tripId = newTripId();
    const resolved = await api.resolveVehicle('CIR01');
    const mallam = resolved.route.stops.find((s) => s.name === 'Mallam');
    if (!mallam) return;
    await seedTrip({ tripId, deviceId: await getDeviceId(), vehicleCode: 'CIR01', alighting: 'Mallam', current: 'Kaneshie', minutesAgo: 6 });
    const base = buildTrip(resolved, mallam, tripId, undefined, new Date(Date.now() - 6 * 60_000));
    const names = base.stops.map((s) => s.name);
    const at = names.indexOf('Kaneshie');
    const trip = {
      ...base,
      currentStop: 'Kaneshie',
      stopsRemaining: names.indexOf('Mallam') - at,
      etaMinutes: resolved.route.stops.slice(at + 1, names.indexOf('Mallam') + 1).reduce((a, s) => a + s.etaMinutes, 0),
      stops: base.stops.map((s, i) => ({ ...s, status: i < at ? ('passed' as const) : i === at ? ('current' as const) : ('upcoming' as const) })),
    };
    await saveActiveTrip(trip);
    await appendTripRecord(buildTripRecord(resolved, mallam, trip));
  } catch {
    // The demo still works without the sample trip.
  }
}
