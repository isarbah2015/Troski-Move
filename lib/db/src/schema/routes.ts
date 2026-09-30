import { pgTable, serial, text, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const insertRouteSchema = createInsertSchema(routesTable).omit({ id: true });
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routesTable.$inferSelect;
