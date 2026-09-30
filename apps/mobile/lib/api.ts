import { createApiClient } from '@trotrolink/api-client';

export { VehicleNotFoundError } from '@trotrolink/api-client';

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000');

export function formatCedis(amount: number): string {
  return `GHS ${amount.toFixed(2)}`;
}
