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
  stops: z.array(z.object({ name: z.string(), status: TripStopStatus, etaMinutes: z.number().optional() })),
  // Optional so trips saved before these fields existed still load.
  vehicleId: z.number().optional(),
  conductorName: z.string().optional(),
  arrivedAt: z.string().optional(),
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
  vehicleId: z.number().optional(),
  driverName: z.string().optional(),
  conductorName: z.string().optional(),
  arrivedAt: z.string().optional(),
});
export type TripRecord = z.infer<typeof TripRecord>;

export const APP_LANGUAGES = ['English', 'Twi', 'Ewe'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const LeaderboardEntry = z.object({
  rank: z.number().int().positive(),
  shortCode: z.string(),
  driverName: z.string(),
  avgRating: z.number(),
  totalRatings: z.number().int(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardResponse = z.object({
  /** True while ratings do not exist yet and the API is returning sample data. */
  mock: z.boolean(),
  updatedAt: z.string(),
  entries: z.array(LeaderboardEntry),
  /** The asking vehicle's standing, or null if it has fewer than 3 ratings. */
  you: z
    .object({ rank: z.number().int().positive(), shortCode: z.string(), avgRating: z.number(), ratingsThisWeek: z.number().int() })
    .nullable(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

export const DriverRatingsResponse = z.object({
  mock: z.boolean(),
  shortCode: z.string(),
  driverName: z.string(),
  entries: z.array(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().nullable(), ratedAt: z.string() })),
});
export type DriverRatingsResponse = z.infer<typeof DriverRatingsResponse>;

/** A passenger's rating of one trip, kept on-device under `tripRatings[tripId]`. */
export const TripRating = z.object({
  driverRating: z.number().int().min(1).max(5),
  conductorRating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  ratedAt: z.string(),
});
export type TripRating = z.infer<typeof TripRating>;

/** Body of `POST /api/ratings`. */
export const RatingSubmission = z.object({
  tripId: z.string().min(1),
  /** Optional: the server takes the vehicle from the trip itself. */
  vehicleId: z.number().int().optional(),
  driverRating: z.number().int().min(1).max(5),
  conductorRating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});
export type RatingSubmission = z.infer<typeof RatingSubmission>;

// ---- Trip sync ----------------------------------------------------------------------------------

const shortCode = z.string().trim().min(1).max(12).transform((v) => v.toUpperCase());

/** `POST /api/trips/start`. Send `passengerId` or, for a guest with no account yet, `deviceId`. */
export const StartTripBody = z
  .object({
    /** Optional client-made reference (TRX-…) so a retried request from the offline queue is idempotent. */
    tripId: z.string().min(1).max(40).optional(),
    passengerId: z.number().int().optional(),
    deviceId: z.string().min(8).max(64).optional(),
    vehicleCode: shortCode,
    boardingStop: z.string().optional(),
    alightingStop: z.string().min(1),
    amountPaid: z.number().positive(),
  })
  .refine((b) => b.passengerId !== undefined || b.deviceId !== undefined, { message: 'passengerId or deviceId is required' });
export type StartTripBody = z.infer<typeof StartTripBody>;

export const StartTripResponse = z.object({ tripId: z.string(), startedAt: z.string(), passengerId: z.number().int() });
export type StartTripResponse = z.infer<typeof StartTripResponse>;

/** `POST /api/trips/stop`: the conductor marks the anchor the vehicle is at. */
export const StopMarkBody = z.object({
  vehicleCode: shortCode,
  stopName: z.string().min(1),
  conductorId: z.number().int().optional(),
  deviceId: z.string().min(8).max(64).optional(),
});
export type StopMarkBody = z.infer<typeof StopMarkBody>;

export const StopMarkResponse = z.object({ ok: z.literal(true), passengersNotified: z.number().int() });
export type StopMarkResponse = z.infer<typeof StopMarkResponse>;

/** `POST /api/trips/alight`: the passenger confirms they got off (rating is optional). */
export const AlightBody = z.object({ tripId: z.string().min(1) });
export type AlightBody = z.infer<typeof AlightBody>;

export const ServerTrip = z.object({
  tripId: z.string(),
  passengerId: z.number().int(),
  vehicleCode: z.string(),
  boardingStop: z.string(),
  alightingStop: z.string(),
  currentStop: z.string(),
  stopsRemaining: z.number().int(),
  etaMinutes: z.number(),
  startedAt: z.string(),
  lastStopMarkedAt: z.string().nullable(),
});
export type ServerTrip = z.infer<typeof ServerTrip>;

export const ActiveTripsResponse = z.object({ trips: z.array(ServerTrip) });
export type ActiveTripsResponse = z.infer<typeof ActiveTripsResponse>;

/** `POST /api/splits`. */
export const SplitBody = z.object({
  vehicleCode: shortCode,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalFares: z.number().nonnegative(),
  ownerDrop: z.number().nonnegative(),
  conductorWage: z.number().nonnegative(),
  fuelCost: z.number().nonnegative(),
});
export type SplitBody = z.infer<typeof SplitBody>;

export const SplitResponse = z.object({ ok: z.literal(true), driverNet: z.number() });
export type SplitResponse = z.infer<typeof SplitResponse>;

export const HistoryTrip = z.object({
  tripId: z.string(),
  vehicleCode: z.string(),
  routeName: z.string(),
  boardingStop: z.string(),
  alightingStop: z.string(),
  startedAt: z.string(),
  officialFare: z.number(),
  amountPaid: z.number(),
  arrivedAt: z.string().nullable(),
  rating: z.object({ driverRating: z.number().int(), conductorRating: z.number().int(), comment: z.string().nullable() }).nullable(),
});
export type HistoryTrip = z.infer<typeof HistoryTrip>;

export const HistoryResponse = z.object({ trips: z.array(HistoryTrip) });
export type HistoryResponse = z.infer<typeof HistoryResponse>;

export const GuestBody = z.object({ deviceId: z.string().min(8).max(64), role: z.enum(['passenger', 'conductor']).default('passenger') });
export type GuestBody = z.infer<typeof GuestBody>;
export const GuestResponse = z.object({ userId: z.number().int() });
export type GuestResponse = z.infer<typeof GuestResponse>;
