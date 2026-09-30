import { HealthResponse, parseScannedCode, ResolvedVehicle } from '@trotrolink/shared';

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
  };
}
