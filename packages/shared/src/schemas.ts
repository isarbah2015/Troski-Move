import { z } from 'zod';
import { USER_ROLES } from './constants';

export const HealthResponse = z.object({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponse>;

export const UserRole = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRole>;

export const Stop = z.object({
  name: z.string(),
  etaMinutes: z.number(),
  officialFare: z.number(),
  amountToPay: z.number(),
});
export type Stop = z.infer<typeof Stop>;

export const ResolvedVehicle = z.object({
  vehicle: z.object({
    id: z.number(),
    shortCode: z.string(),
    driverName: z.string(),
    conductorName: z.string(),
  }),
  route: z.object({
    routeId: z.string(),
    name: z.string(),
    origin: z.string(),
    destination: z.string(),
    stops: z.array(Stop),
  }),
});
export type ResolvedVehicle = z.infer<typeof ResolvedVehicle>;
