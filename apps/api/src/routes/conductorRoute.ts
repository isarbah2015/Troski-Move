import { Router, type IRouter } from "express";
import { count, eq } from "drizzle-orm";
import { SetRouteBody } from "@trotrolink/shared";
import { conductorOf, requireConductor } from "../auth";
import { db } from "../db";
import { activeTripsTable, routeChangesTable, routesTable, vehiclesTable } from "../db/schema";
import { applyDirection } from "../lib";

const router: IRouter = Router();
router.use("/conductor/route", requireConductor);
router.use("/conductor/direction", requireConductor);

async function snapshot(vehicleCode: string) {
  const [row] = await db.select({ v: vehiclesTable, r: routesTable }).from(vehiclesTable).innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id)).where(eq(vehiclesTable.shortCode, vehicleCode));
  if (!row) return null;
  const routes = await db.select().from(routesTable).orderBy(routesTable.routeId);
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(activeTripsTable).where(eq(activeTripsTable.vehicleId, row.v.id));
  const shown = applyDirection(row.r, row.v.direction);
  return {
    vehicle: row.v,
    route: row.r,
    body: {
      current: { routeId: row.r.routeId, name: shown.routeName, origin: shown.origin, destination: shown.destination, direction: row.v.direction },
      routes: routes.map((r) => ({ routeId: r.routeId, name: r.routeName, origin: r.origin, destination: r.destination })),
      onBoard: n,
    },
  };
}

const BLOCKED = (n: number) => `${n} paid passenger${n === 1 ? " is" : "s are"} still on board. Change direction or route once everyone has got off.`;

router.get("/conductor/route", async (_req, res): Promise<void> => {
  const snap = await snapshot(conductorOf(res).vehicleCode);
  if (!snap) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  res.json(snap.body);
});

/** Turn the vehicle round: the stops, fares and names run the other way from the next scan. Logged for the union. */
router.post("/conductor/direction", async (_req, res): Promise<void> => {
  const code = conductorOf(res).vehicleCode;
  const snap = await snapshot(code);
  if (!snap) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  if (snap.body.onBoard > 0) {
    res.status(409).json({ error: BLOCKED(snap.body.onBoard), onBoard: snap.body.onBoard });
    return;
  }
  const next = snap.vehicle.direction === "outbound" ? "inbound" : "outbound";
  await db.update(vehiclesTable).set({ direction: next }).where(eq(vehiclesTable.id, snap.vehicle.id));
  await db.insert(routeChangesTable).values({ vehicleId: snap.vehicle.id, kind: "direction", fromRoute: snap.route.routeId, toRoute: snap.route.routeId, fromDirection: snap.vehicle.direction, toDirection: next });
  res.json((await snapshot(code))!.body);
});

/** Move the vehicle to another route (it starts outbound). Logged for the union, who can see unusual changes. */
router.post("/conductor/route", async (req, res): Promise<void> => {
  const parsed = SetRouteBody.safeParse(req.body);
  const code = conductorOf(res).vehicleCode;
  const snap = await snapshot(code);
  if (!parsed.success || !snap) {
    res.status(parsed.success ? 404 : 400).json({ error: parsed.success ? "Vehicle not found" : "Choose a route" });
    return;
  }
  if (snap.body.onBoard > 0) {
    res.status(409).json({ error: BLOCKED(snap.body.onBoard), onBoard: snap.body.onBoard });
    return;
  }
  const [target] = await db.select().from(routesTable).where(eq(routesTable.routeId, parsed.data.routeId));
  if (!target) {
    res.status(404).json({ error: "Unknown route" });
    return;
  }
  if (target.id !== snap.vehicle.routeId || snap.vehicle.direction !== "outbound") {
    await db.update(vehiclesTable).set({ routeId: target.id, direction: "outbound" }).where(eq(vehiclesTable.id, snap.vehicle.id));
    await db.insert(routeChangesTable).values({ vehicleId: snap.vehicle.id, kind: "route", fromRoute: snap.route.routeId, toRoute: target.routeId, fromDirection: snap.vehicle.direction, toDirection: "outbound" });
  }
  res.json((await snapshot(code))!.body);
});

export default router;
