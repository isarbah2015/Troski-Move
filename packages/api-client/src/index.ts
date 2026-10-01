import {
  ActiveTripsResponse,
  DriverRatingsResponse,
  GuestResponse,
  HealthResponse,
  HistoryResponse,
  LeaderboardResponse,
  parseScannedCode,
  ResolvedVehicle,
  SplitResponse,
  StartTripResponse,
  StopMarkResponse,
  type AlightBody,
  type RatingSubmission,
  type SplitBody,
  type StartTripBody,
  type StopMarkBody,
} from '@trotrolink/shared';

export class VehicleNotFoundError extends Error {}

/** A non-2xx answer from the API. `retryable` is false for 4xx (the request itself is wrong). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
  get retryable() {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

/** Typed fetch client shared by mobile and web. Endpoints are added as the API grows. */
export function createApiClient(baseUrl: string) {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetch(`${baseUrl}/api${path}`, init);
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // keep the generic message
      }
      throw new ApiError(res.status, message);
    }
    return res.json();
  }

  const post = (path: string, body: unknown) =>
    request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  return {
    async health() {
      return HealthResponse.parse(await request('/healthz'));
    },

    /** Resolves a short code or scanned QR payload to a vehicle and its route. */
    async resolveVehicle(code: string) {
      try {
        return ResolvedVehicle.parse(await request(`/vehicles/resolve?code=${encodeURIComponent(parseScannedCode(code))}`));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) throw new VehicleNotFoundError();
        throw e;
      }
    },

    /** Anonymous identity for this device until phone OTP accounts exist. */
    async guest(deviceId: string, role: 'passenger' | 'conductor') {
      return GuestResponse.parse(await post('/guests', { deviceId, role }));
    },

    /** Passenger paid: records the transaction and starts the active trip. Retrying with the same `tripId` is safe. */
    async startTrip(body: StartTripBody) {
      return StartTripResponse.parse(await post('/trips/start', body));
    },

    /** Conductor marks the anchor the vehicle is at; passengers' trips move forward. */
    async markStop(body: StopMarkBody) {
      return StopMarkResponse.parse(await post('/trips/stop', body));
    },

    /** Active trips for a vehicle (conductor), a single trip (passenger) or a passenger. */
    async activeTrips(filter: { vehicleCode: string } | { tripId: string } | { passengerId: number }) {
      const q = new URLSearchParams(Object.entries(filter).map(([k, v]) => [k, String(v)]));
      return ActiveTripsResponse.parse(await request(`/trips/active?${q.toString()}`));
    },

    /** Passenger confirmed they got off. */
    async alight(body: AlightBody) {
      await post('/trips/alight', body);
    },

    /** A passenger's last 50 trips with their ratings. */
    async tripHistory(passengerId: number) {
      return HistoryResponse.parse(await request(`/trips/history?passengerId=${passengerId}`));
    },

    async submitRating(body: RatingSubmission) {
      await post('/ratings', body);
    },

    async saveSplit(body: SplitBody) {
      return SplitResponse.parse(await post('/splits', body));
    },

    /** Top 5 drivers of the last 24 hours. `forVehicle` adds that vehicle's own standing. */
    async dailyLeaderboard(opts: { forVehicle?: string; mock?: 'off' } = {}) {
      const q = new URLSearchParams();
      if (opts.forVehicle) q.set('vehicle', opts.forVehicle);
      if (opts.mock) q.set('mock', opts.mock);
      return LeaderboardResponse.parse(await request(`/leaderboard/daily?${q.toString()}`));
    },

    /** The last 10 ratings behind one vehicle's standing. */
    async driverRatings(shortCode: string, opts: { mock?: 'off' } = {}) {
      const q = opts.mock ? `?mock=${opts.mock}` : '';
      return DriverRatingsResponse.parse(await request(`/leaderboard/${encodeURIComponent(shortCode)}/ratings${q}`));
    },
  };
}
