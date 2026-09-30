import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { routesTable } from "./routes";

export const vehiclesTable = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  qrCodeId: text("qr_code_id").notNull().unique(),
  shortCode: text("short_code").notNull().unique(),
  routeId: integer("route_id").notNull().references(() => routesTable.id),
  driverName: text("driver_name").notNull(),
  conductorName: text("conductor_name").notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;
