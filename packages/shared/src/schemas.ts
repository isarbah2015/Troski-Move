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

export const TripStopStatus = z.enum(['passed', 'current', 'upcoming']);
export type TripStopStatus = z.infer<typeof TripStopStatus>;

/** The passenger's live trip, persisted on-device until real tracking and payments land. */
export const ActiveTrip = z.object({
  tripId: z.string(),
  vehicleShortCode: z.string(),
  driverName: z.string(),
  routeName: z.string(),
  boardingStop: z.string(),
  alightingStop: z.string(),
  currentStop: z.string(),
  stopsRemaining: z.number().int().nonnegative(),
  etaMinutes: z.number().nonnegative(),
  amountPaid: z.number(),
  startedAt: z.string(),
  stops: z.array(z.object({ name: z.string(), status: TripStopStatus })),
});
export type ActiveTrip = z.infer<typeof ActiveTrip>;
