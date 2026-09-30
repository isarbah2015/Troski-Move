import { DriverRatingsResponse, HealthResponse, LeaderboardResponse, parseScannedCode, ResolvedVehicle } from '@trotrolink/shared';

export class VehicleNotFoundError extends Error {}

/** Typed fetch client shared by mobile and web. Endpoints are added as the API grows. */
export function createApiClient(baseUrl: string) {
  return {
    async health() {
      const res = await fetch(`${baseUrl}/api/healthz`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return HealthResponse.parse(await res.json());
    },

    /** Resolves a short code or scanned QR payload to a vehicle and its route. */
    async resolveVehicle(code: string) {
      const res = await fetch(`${baseUrl}/api/vehicles/resolve?code=${encodeURIComponent(parseScannedCode(code))}`);
      if (res.status === 404) throw new VehicleNotFoundError();
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return ResolvedVehicle.parse(await res.json());
    },

    /** Top 5 drivers of the last 24 hours. `forVehicle` adds that vehicle's own standing. */
    async dailyLeaderboard(opts: { forVehicle?: string; mock?: 'off' } = {}) {
      const q = new URLSearchParams();
      if (opts.forVehicle) q.set('vehicle', opts.forVehicle);
      if (opts.mock) q.set('mock', opts.mock);
      const res = await fetch(`${baseUrl}/api/leaderboard/daily?${q.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return LeaderboardResponse.parse(await res.json());
    },

    /** The last 10 ratings behind one vehicle's standing. */
    async driverRatings(shortCode: string, opts: { mock?: 'off' } = {}) {
      const q = opts.mock ? `?mock=${opts.mock}` : '';
      const res = await fetch(`${baseUrl}/api/leaderboard/${encodeURIComponent(shortCode)}/ratings${q}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return DriverRatingsResponse.parse(await res.json());
    },
  };
}
