import { Router, type IRouter } from "express";
import accountRouter from "./account";
import conductorRouter from "./conductor";
import conductorRouteRouter from "./conductorRoute";
import disputesRouter from "./disputes";
import healthRouter from "./health";
import leaderboardRouter from "./leaderboard";
import paymentsRouter from "./payments";
import ratingsRouter from "./ratings";
import reportsRouter from "./reports";
import splitsRouter from "./splits";
import unionRouter from "./union";
import unionOpsRouter from "./unionOps";
import ussdRouter from "./ussd";
import tripsRouter from "./trips";
import vehiclesRouter from "./vehicles";
import faresRouter from "./fares";

const router: IRouter = Router();

router.use(healthRouter);
router.use(conductorRouter);
router.use(conductorRouteRouter);
router.use(accountRouter);
router.use(disputesRouter);
router.use(vehiclesRouter);
router.use(faresRouter);
router.use(leaderboardRouter);
router.use(paymentsRouter);
router.use(ratingsRouter);
router.use(tripsRouter);
router.use(splitsRouter);
router.use(ussdRouter);
router.use(unionRouter);
router.use(unionOpsRouter);
router.use(reportsRouter);

export default router;
