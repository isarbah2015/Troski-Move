import { Router, type IRouter } from "express";
import healthRouter from "./health";
import commuterRouter from "./commuter";

const router: IRouter = Router();

router.use(healthRouter);
router.use(commuterRouter);

export default router;
