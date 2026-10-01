import {
  ActiveTripsResponse,
  ConductorLoginResponse,
  DriverRatingsResponse,
  GuestResponse,
  HealthResponse,
  HistoryResponse,
  InitiatePaymentResponse,
  LeaderboardResponse,
  PaymentStatusResponse,
  parseScannedCode,
  ResolvedVehicle,
  SplitResponse,
  StartTripResponse,
  StopMarkResponse,
  type AlightBody,
  type ConductorLoginBody,
  type ConductorSetupBody,
  type DisputeBody,
  DisputeResponse,
  type UnpaidDisputeBody,
  type InitiatePaymentBody,
  type RatingSubmission,
  type SplitBody,
  type StartTripBody,
  type StopMarkBody,
  UnregisteredReportBody,
  UnregisteredReportResponse,
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
    // 401: the conductor's session ended; the action waits in the queue until they sign in again.
    return this.status >= 500 || this.status === 408 || this.status === 429 || this.status === 401;
  }
}

/** Typed fetch client shared by mobile and web. Endpoints are added as the API grows. */
export type ApiClientOptions = {
  /** Called for every request; a conductor's session token goes out as `Authorization: Bearer`. */
  getToken?: () => Promise<string | null>;
  /** Called when the API answers 401 on a request that carried a token (the session expired or was ended). */
  onUnauthorized?: () => void;
  /** Replaces `fetch`: the app's offline demo mode serves the API from inside the app. */
  fetch?: typeof fetch;
};

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}) {
  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await options.getToken?.();
    const res = await (options.fetch ?? fetch)(`${baseUrl}/api${path}`, token ? { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } } : init);
    if (res.status === 401 && token) options.onUnauthorized?.();
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

    /** Registers this phone for push notifications (the closed-app alerts). */
    async registerPushToken(deviceId: string, token: string) {
      await post('/users/push-token', { deviceId, token });
    },

    /** Erases the passenger's personal data on the server. */
    async deleteAccount(deviceId: string) {
      await post('/account/delete', { deviceId });
    },

    /** Erases the conductor's account and frees the vehicle. */
    async deleteConductorAccount() {
      await post('/conductor/delete', {});
    },

    /** First launch: choose a PIN for a vehicle (once). */
    async conductorSetup(body: ConductorSetupBody) {
      await post('/conductor/setup', body);
    },

    async conductorLogin(body: ConductorLoginBody) {
      return ConductorLoginResponse.parse(await post('/conductor/login', body));
    },

    async conductorLogout() {
      await post('/conductor/logout', {});
    },

    /** Passenger paid: records the transaction and starts the active trip. Retrying with the same `tripId` is safe. */
    async startTrip(body: StartTripBody) {
      return StartTripResponse.parse(await post('/trips/start', body));
    },

    /** Starts a MoMo request-to-pay; the passenger approves it on their phone. Retrying with the same `tripId` is safe. */
    async initiatePayment(body: InitiatePaymentBody) {
      return InitiatePaymentResponse.parse(await post('/payments/initiate', body));
    },

    /** Where a payment stands. When it returns SUCCESSFUL the trip already exists on the server. */
    async paymentStatus(referenceId: string) {
      return PaymentStatusResponse.parse(await request(`/payments/status/${encodeURIComponent(referenceId)}`));
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

    /** The passenger pays the difference to the stop the vehicle has reached; returns a payment to poll like any other. */
    async extendTrip(tripId: string) {
      return InitiatePaymentResponse.parse(await post('/trips/extend', { tripId }));
    },

    /** "Get off now": ends the trip at the passenger's declared stop. */
    async getOff(tripId: string) {
      await post('/trips/getoff', { tripId });
    },

    /** Conductor: this overstaying passenger is getting off here. Closes the trip. */
    async confirmAlight(tripId: string) {
      await post('/trips/confirm-alight', { tripId });
    },

    /** Passenger reports a trip; the server attaches the evidence. */
    async reportTrip(body: DisputeBody) {
      return DisputeResponse.parse(await post('/disputes', body));
    },

    /** Passenger reports a vehicle that is not on the GPRTU register (no sticker, or a code that does not exist). */
    async reportUnregistered(body: UnregisteredReportBody) {
      return UnregisteredReportResponse.parse(await post('/reports/unregistered', body));
    },

    /** Conductor reports a passenger on board who did not pay. */
    async reportUnpaid(body: UnpaidDisputeBody) {
      return DisputeResponse.parse(await post('/disputes/unpaid', body));
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
