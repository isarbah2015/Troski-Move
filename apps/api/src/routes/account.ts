import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { AlightBody } from "@trotrolink/shared";
import { conductorOf, requireConductor } from "../auth";
import { db } from "../db";
import { activeTripsTable, conductorSessionsTable, disputesTable, paymentsTable, ratingsTable, transactionsTable, usersTable } from "../db/schema";

const router: IRouter = Router();

const DeleteBody = AlightBody.pick({ deviceId: true }).required();

/**
 * Erases a user's personal data. Payments and trips already made stay on file as anonymous financial records
 * (accounting and dispute evidence), but nothing links them to a person any more.
 */
async function anonymise(userId: number) {
  await db.transaction(async (tx) => {
    const trips = await tx.select({ id: transactionsTable.id }).from(transactionsTable).where(eq(transactionsTable.passengerId, userId));
    const tripIds = trips.map((t) => t.id);
    await tx.delete(activeTripsTable).where(eq(activeTripsTable.passengerId, userId));
    if (tripIds.length) await tx.update(ratingsTable).set({ comment: null }).where(inArray(ratingsTable.transactionId, tripIds));
    await tx.update(disputesTable).set({ description: null, reporterId: null }).where(eq(disputesTable.reporterId, userId));
    await tx.update(paymentsTable).set({ payerPhone: null }).where(eq(paymentsTable.passengerId, userId));
    await tx.delete(conductorSessionsTable).where(eq(conductorSessionsTable.conductorId, userId));
    await tx
      .update(usersTable)
      .set({ phone: `deleted-${userId}`, name: "Deleted account", conductorPinHash: null, conductorVehicleCode: null, lockedUntil: null })
      .where(eq(usersTable.id, userId));
  });
}

/** A passenger deletes their (guest) account from their own device. */
router.post("/account/delete", async (req, res): Promise<void> => {
  const parsed = DeleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.phone, `guest-${parsed.data.deviceId}-passenger`)));
  if (user) await anonymise(user.id);
  res.json({ ok: true });
});

/** A conductor deletes their account. This also frees the vehicle so another conductor can set it up. */
router.post("/conductor/delete", requireConductor, async (_req, res): Promise<void> => {
  await anonymise(conductorOf(res).id);
  res.json({ ok: true });
});

export default router;
