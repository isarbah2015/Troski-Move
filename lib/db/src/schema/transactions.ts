import { pgTable, serial, text, integer, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vehiclesTable } from "./vehicles";

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
  },
  (t) => [index("transactions_vehicle_ts_idx").on(t.vehicleId, t.timestamp)],
);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, timestamp: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
