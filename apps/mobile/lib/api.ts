import { createApiClient } from '@trotrolink/api-client';
import { clearSession, getAuthToken } from '@/lib/conductorSession';
import { demoFetch } from '@/lib/demoServer';

export { VehicleNotFoundError } from '@trotrolink/api-client';

/**
 * With no EXPO_PUBLIC_API_URL the app runs in offline demo mode: the API is served from inside the app, so the
 * APK needs no server, database or internet. Set EXPO_PUBLIC_API_URL to talk to a real API instead.
 */
export const DEMO_MODE = !process.env.EXPO_PUBLIC_API_URL;

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://demo.local', {
  ...(DEMO_MODE ? { fetch: demoFetch } : {}),
  getToken: getAuthToken,
  // The API rejected our conductor token: end the local session so the login screen comes back.
  onUnauthorized: () => void clearSession(),
});

export function formatCedis(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}
