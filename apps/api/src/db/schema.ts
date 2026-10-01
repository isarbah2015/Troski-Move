import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const userRoles = ["passenger", "conductor", "driver", "union_admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").$type<UserRole>().notNull().default("passenger"),
  languagePref: text("language_pref").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** Conductor sign-in: scrypt hash of the 4-digit PIN, and the one vehicle this conductor works. */
  conductorPinHash: text("conductor_pin_hash"),
  conductorVehicleCode: text("conductor_vehicle_code").unique(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedPinAttempts: integer("failed_pin_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;

/** One stage on a route. `fare` is the official GHS fare from the origin to this stop;
 *  `etaMinutes` is the travel time from the previous stop. */
export type RouteStop = { name: string; fare: number; etaMinutes: number };

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  routeId: text("route_id").notNull().unique(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  routeName: text("route_name").notNull(),
  stopsJson: jsonb("stops_json").$type<RouteStop[]>().notNull(),
  distanceKm: numeric("distance_km", { precision: 6, scale: 1 }).notNull(),
});

export type Route = typeof routesTable.$inferSelect;

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  qrCodeId: text("qr_code_id").notNull().unique(),
  shortCode: text("short_code").notNull().unique(),
  routeId: integer("route_id").notNull().references(() => routesTable.id),
  driverName: text("driver_name").notNull(),
  conductorName: text("conductor_name").notNull(),
});

export type Vehicle = typeof vehiclesTable.$inferSelect;

export const transactionsTable = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
    alightingStop: text("alighting_stop").notNull(),
    officialFare: numeric("official_fare", { precision: 8, scale: 2 }).notNull(),
    amountPaid: numeric("amount_paid", { precision: 8, scale: 2 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    /** Public trip reference (TRX-…). Clients may supply it so retries from the offline queue are idempotent. */
    tripRef: text("trip_ref").unique(),
    boardingStop: text("boarding_stop"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  },
  (t) => [index("transactions_vehicle_ts_idx").on(t.vehicleId, t.timestamp)],
);

export type Transaction = typeof transactionsTable.$inferSelect;

export const activeTripsTable = pgTable(
  "active_trips",
  {
    id: serial("id").primaryKey(),
    passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    alightingStop: text("alighting_stop").notNull(),
    currentStop: text("current_stop").notNull(),
    etaMinutes: integer("eta_minutes").notNull(),
    /** The payment that started this trip; one active row per transaction. */
    transactionId: integer("transaction_id").notNull().unique().references(() => transactionsTable.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastStopMarkedAt: timestamp("last_stop_marked_at", { withTimezone: true }),
    conductorId: integer("conductor_id").references(() => usersTable.id),
  },
  (t) => [index("active_trips_vehicle_idx").on(t.vehicleId)],
);

export type ActiveTrip = typeof activeTripsTable.$inferSelect;

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id").notNull().unique().references(() => transactionsTable.id),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    driverRating: smallint("driver_rating").notNull(),
    conductorRating: smallint("conductor_rating").notNull(),
    comment: text("comment"),
    ratedAt: timestamp("rated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ratings_vehicle_rated_at_idx").on(t.vehicleId, t.ratedAt),
    check("ratings_driver_range", sql`${t.driverRating} between 1 and 5`),
    check("ratings_conductor_range", sql`${t.conductorRating} between 1 and 5`),
  ],
);

export type Rating = typeof ratingsTable.$inferSelect;

export const dailySplitsTable = pgTable(
  "daily_splits",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    date: date("date").notNull(),
    totalFares: numeric("total_fares", { precision: 10, scale: 2 }).notNull().default("0"),
    ownerDrop: numeric("owner_drop", { precision: 10, scale: 2 }).notNull().default("0"),
    conductorWage: numeric("conductor_wage", { precision: 10, scale: 2 }).notNull().default("0"),
    fuelCost: numeric("fuel_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    driverNet: numeric("driver_net", { precision: 10, scale: 2 }).notNull().default("0"),
  },
  (t) => [unique("daily_splits_vehicle_date_uq").on(t.vehicleId, t.date)],
);

export type DailySplit = typeof dailySplitsTable.$inferSelect;

export const conductorBonusTable = pgTable(
  "conductor_bonus",
  {
    id: serial("id").primaryKey(),
    conductorId: integer("conductor_id").notNull().references(() => usersTable.id),
    date: date("date").notNull(),
    totalScans: integer("total_scans").notNull().default(0),
    avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0"),
    bonusAmount: numeric("bonus_amount", { precision: 8, scale: 2 }).notNull().default("0"),
  },
  (t) => [unique("conductor_bonus_conductor_date_uq").on(t.conductorId, t.date)],
);

export type ConductorBonus = typeof conductorBonusTable.$inferSelect;

export const disputeTypes = ["overcharge", "wrong_stop", "payment_failed", "other"] as const;
export const disputeStatuses = ["open", "investigating", "resolved", "rejected"] as const;

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactionsTable.id),
  disputeType: text("dispute_type").$type<(typeof disputeTypes)[number]>().notNull(),
  status: text("status").$type<(typeof disputeStatuses)[number]>().notNull().default("open"),
});

export type Dispute = typeof disputesTable.$inferSelect;

export const tripEventTypes = ["boarded", "stop_reached", "arrived", "alighted"] as const;

/** Append-only log of what happened on a vehicle: the conductor's stop marks and each passenger's trip milestones. */
export const tripEventsTable = pgTable(
  "trip_events",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    tripId: integer("trip_id").references(() => transactionsTable.id),
    eventType: text("event_type").$type<(typeof tripEventTypes)[number]>().notNull(),
    stopName: text("stop_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trip_events_vehicle_created_idx").on(t.vehicleId, t.createdAt.desc()),
    check("trip_events_type_chk", sql`${t.eventType} in ('boarded','stop_reached','arrived','alighted')`),
  ],
);

export type TripEvent = typeof tripEventsTable.$inferSelect;

export const paymentStatuses = ["PENDING", "SUCCESSFUL", "FAILED"] as const;

/** One MTN MoMo request-to-pay. The trip is only created once the payment is SUCCESSFUL. */
export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    /** The MoMo `X-Reference-Id` (a UUID the API generates). */
    referenceId: text("reference_id").notNull().unique(),
    /** Public trip reference the client chose (TRX-…); unique, so a double tap never charges twice. */
    tripRef: text("trip_ref").notNull().unique(),
    passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
    vehicleCode: text("vehicle_code").notNull(),
    boardingStop: text("boarding_stop").notNull(),
    alightingStop: text("alighting_stop").notNull(),
    amount: numeric("amount", { precision: 8, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    payerPhone: text("payer_phone"),
    status: text("status").$type<(typeof paymentStatuses)[number]>().notNull().default("PENDING"),
    failureReason: text("failure_reason"),
    tripId: integer("trip_id").references(() => transactionsTable.id),
    momoResponse: jsonb("momo_response"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [check("payments_status_chk", sql`${t.status} in ('PENDING','SUCCESSFUL','FAILED')`)],
);

export type Payment = typeof paymentsTable.$inferSelect;

/** A conductor's signed-in session. Only a SHA-256 of the token is stored, so a database leak cannot be replayed. */
export const conductorSessionsTable = pgTable("conductor_sessions", {
  id: serial("id").primaryKey(),
  conductorId: integer("conductor_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
