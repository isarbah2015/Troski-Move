import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import type { FaresResponse } from "@trotrolink/shared";
import { db } from "../db";
import { routesTable } from "../db/schema";
import { activeFareTable, getRoundingStep, overlayFares, upcomingFareTable } from "../services/fares";

const router: IRouter = Router();

/** Official fares in force now. Public and read-only: the same numbers the union dashboard shows. */
router.get("/fares", async (_req, res): Promise<void> => {
  const table = await activeFareTable();
  const upcoming = await upcomingFareTable();
  const routes = await db.select().from(routesTable).orderBy(asc(routesTable.routeName));
  const body: FaresResponse = {
    table: table ? { label: table.label, effectiveFrom: table.effectiveFrom.toISOString() } : null,
    upcoming: upcoming ? { label: upcoming.label, effectiveFrom: upcoming.effectiveFrom.toISOString() } : null,
    roundingStep: getRoundingStep(),
    routes: routes.map((r) => ({
      routeId: r.routeId,
      name: r.routeName,
      origin: r.origin,
      destination: r.destination,
      stops: overlayFares(r.routeId, r.stopsJson, table).map((s) => ({ name: s.name, fare: s.fare })),
      pairs: table?.pairs?.[r.routeId] ?? {},
    })),
  };
  res.set("Cache-Control", "public, max-age=30").json(body);
});

export default router;
