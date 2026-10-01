import { Router, type IRouter } from "express";
import conductorRouter from "./conductor";
import disputesRouter from "./disputes";
import healthRouter from "./health";
import leaderboardRouter from "./leaderboard";
import paymentsRouter from "./payments";
import ratingsRouter from "./ratings";
import splitsRouter from "./splits";
import tripsRouter from "./trips";
import vehiclesRouter from "./vehicles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conductorRouter);
router.use(disputesRouter);
router.use(vehiclesRouter);
router.use(leaderboardRouter);
router.use(paymentsRouter);
router.use(ratingsRouter);
router.use(tripsRouter);
router.use(splitsRouter);

export default router;
