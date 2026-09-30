import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { RatingSubmission } from "@trotrolink/shared";
import { db } from "../db";
import { ratingsTable, transactionsTable } from "../db/schema";
import { endTrip } from "./trips";
import { invalidateLeaderboardCache } from "./leaderboard";

const router: IRouter = Router();

/**
 * Stores a passenger's rating of a trip (one per trip; re-sending updates it). Rating also means the
 * passenger arrived, so the trip is ended and `arrived_at` stamped. The vehicle comes from the trip.
 */
router.post("/ratings", async (req, res): Promise<void> => {
  const parsed = RatingSubmission.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rating", issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const [t] = await db.select().from(transactionsTable).where(eq(transactionsTable.tripRef, b.tripId));
  if (!t) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const values = {
    transactionId: t.id,
    vehicleId: t.vehicleId,
    driverRating: b.driverRating,
    conductorRating: b.conductorRating,
    comment: b.comment ?? null,
  };
  await db
    .insert(ratingsTable)
    .values(values)
    .onConflictDoUpdate({ target: ratingsTable.transactionId, set: { driverRating: values.driverRating, conductorRating: values.conductorRating, comment: values.comment, ratedAt: new Date() } });
  await endTrip(t.id, t.vehicleId, t.alightingStop);
  invalidateLeaderboardCache();
  res.json({ ok: true });
});

export default router;
