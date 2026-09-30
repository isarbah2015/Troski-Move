import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vehiclesTable } from "./vehicles";

export const activeTripsTable = pgTable("active_trips", {
  id: serial("id").primaryKey(),
  passengerId: integer("passenger_id").notNull().references(() => usersTable.id),
  vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
  alightingStop: text("alighting_stop").notNull(),
  currentStop: text("current_stop").notNull(),
  etaMinutes: integer("eta_minutes").notNull(),
});

export const insertActiveTripSchema = createInsertSchema(activeTripsTable).omit({ id: true });
export type InsertActiveTrip = z.infer<typeof insertActiveTripSchema>;
export type ActiveTrip = typeof activeTripsTable.$inferSelect;
