import { createApiClient } from '@trotrolink/api-client';
import { clearSession, getAuthToken } from '@/lib/conductorSession';

export { VehicleNotFoundError } from '@trotrolink/api-client';

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', {
  getToken: getAuthToken,
  // The API rejected our conductor token: end the local session so the login screen comes back.
  onUnauthorized: () => void clearSession(),
});

export function formatCedis(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}
