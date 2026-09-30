import type { TripRecord } from '@trotrolink/shared';
import { saveTripHistory, saveUser } from '@/lib/storage';

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
      stops: STOPS,
    };
  });
  await saveTripHistory(trips);
}
