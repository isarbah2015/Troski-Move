import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leaderboardRouter from "./leaderboard";
import ratingsRouter from "./ratings";
import splitsRouter from "./splits";
import tripsRouter from "./trips";
import vehiclesRouter from "./vehicles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vehiclesRouter);
router.use(leaderboardRouter);
router.use(ratingsRouter);
router.use(tripsRouter);
router.use(splitsRouter);

export default router;
