import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { transactionsTable } from "./transactions";

export const disputeTypes = ["overcharge", "wrong_stop", "payment_failed", "other"] as const;
export const disputeStatuses = ["open", "investigating", "resolved", "rejected"] as const;

export const disputesTable = pgTable("disputes", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull().references(() => transactionsTable.id),
  disputeType: text("dispute_type").$type<(typeof disputeTypes)[number]>().notNull(),
  status: text("status").$type<(typeof disputeStatuses)[number]>().notNull().default("open"),
});

export const insertDisputeSchema = createInsertSchema(disputesTable).omit({ id: true });
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type Dispute = typeof disputesTable.$inferSelect;
