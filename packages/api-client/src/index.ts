import { HealthResponse } from '@trotrolink/shared';

/** Typed fetch client shared by mobile and web. Endpoints are added as the API grows. */
export function createApiClient(baseUrl: string) {
  return {
    async health() {
      const res = await fetch(`${baseUrl}/api/healthz`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return HealthResponse.parse(await res.json());
    },
  };
}
