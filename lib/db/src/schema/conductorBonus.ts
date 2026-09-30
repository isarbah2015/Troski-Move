import { pgTable, serial, integer, date, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

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

export const insertConductorBonusSchema = createInsertSchema(conductorBonusTable).omit({ id: true });
export type InsertConductorBonus = z.infer<typeof insertConductorBonusSchema>;
export type ConductorBonus = typeof conductorBonusTable.$inferSelect;
