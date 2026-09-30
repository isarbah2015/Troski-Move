import { pgTable, serial, integer, date, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vehiclesTable } from "./vehicles";

export const dailySplitsTable = pgTable(
  "daily_splits",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull().references(() => vehiclesTable.id),
    date: date("date").notNull(),
    ownerDrop: numeric("owner_drop", { precision: 10, scale: 2 }).notNull().default("0"),
    conductorWage: numeric("conductor_wage", { precision: 10, scale: 2 }).notNull().default("0"),
    fuelCost: numeric("fuel_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    driverNet: numeric("driver_net", { precision: 10, scale: 2 }).notNull().default("0"),
  },
  (t) => [unique("daily_splits_vehicle_date_uq").on(t.vehicleId, t.date)],
);

export const insertDailySplitSchema = createInsertSchema(dailySplitsTable).omit({ id: true });
export type InsertDailySplit = z.infer<typeof insertDailySplitSchema>;
export type DailySplit = typeof dailySplitsTable.$inferSelect;
