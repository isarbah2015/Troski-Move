import { Router, type IRouter } from "express";
import { HealthResponse } from "@trotrolink/shared";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json(HealthResponse.parse({ status: "ok" }));
});

export default router;
