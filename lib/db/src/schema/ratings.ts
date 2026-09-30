import { pgTable, serial, text, integer, smallint, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { transactionsTable } from "./transactions";
import { vehiclesTable } from "./vehicles";

export const ratingsTable = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id").notNull().unique().references(() => transactionsTable.id),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    driverRating: smallint("driver_rating").notNull(),
    conductorRating: smallint("conductor_rating").notNull(),
    comment: text("comment"),
  },
  (t) => [
    check("ratings_driver_range", sql`${t.driverRating} between 1 and 5`),
    check("ratings_conductor_range", sql`${t.conductorRating} between 1 and 5`),
  ],
);

export const insertRatingSchema = createInsertSchema(ratingsTable).omit({ id: true });
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratingsTable.$inferSelect;
