import { Router, type IRouter } from "express";
import { RatingSubmission } from "@trotrolink/shared";
import { logger } from "../logger";

const router: IRouter = Router();

/**
 * Accepts a passenger's rating of a finished trip.
 * TODO: insert into the `ratings` table (link the transaction) and invalidate the leaderboard cache.
 */
router.post("/ratings", (req, res): void => {
  const parsed = RatingSubmission.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid rating", issues: parsed.error.issues });
    return;
  }
  logger.info({ rating: parsed.data }, "Rating received (not stored yet)");
  res.json({ ok: true });
});

export default router;
