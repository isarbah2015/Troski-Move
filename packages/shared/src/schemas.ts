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

/** The signed-in user as cached on-device (real auth arrives with phone OTP). */
export const LocalUser = z.object({
  name: z.string(),
  phone: z.string(),
  verified: z.boolean(),
});
export type LocalUser = z.infer<typeof LocalUser>;

/** A completed-payment trip kept in on-device history. */
export const TripRecord = z.object({
  tripId: z.string(),
  vehicleShortCode: z.string(),
  routeName: z.string(),
  boardingStop: z.string(),
  alightingStop: z.string(),
  startedAt: z.string(),
  officialFare: z.number(),
  amountPaid: z.number(),
  /** 1–5, or null until the passenger rates the trip. */
  rating: z.number().min(1).max(5).nullable(),
  stops: z.array(z.object({ name: z.string(), officialFare: z.number(), etaMinutes: z.number() })),
});
export type TripRecord = z.infer<typeof TripRecord>;

export const APP_LANGUAGES = ['English', 'Twi', 'Ewe'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
