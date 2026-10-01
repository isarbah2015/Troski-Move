import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { parseScannedCode } from "@trotrolink/shared";
import { db } from "../db";
import { routesTable, vehiclesTable } from "../db/schema";
import { desc, and, gt } from "drizzle-orm";
import { applyDirection, amountDue, isSuspended } from "../lib";
import { getRoundingStep, pairFaresFor } from "../services/fares";
import { routeChangesTable, tripEventsTable } from "../db/schema";
import { fareNotice, withFares } from "../services/fares";

const router: IRouter = Router();

/** Passengers pay whole cedis: the official fare rounded up. Free (origin) stops stay 0. */
router.get("/vehicles/resolve", async (req, res): Promise<void> => {
  const raw = typeof req.query["code"] === "string" ? req.query["code"] : "";
  const code = parseScannedCode(raw);
  if (!code) {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  const [row] = await db
    .select({ vehicle: vehiclesTable, route: routesTable })
    .from(vehiclesTable)
    .innerJoin(routesTable, eq(vehiclesTable.routeId, routesTable.id))
    .where(or(eq(vehiclesTable.shortCode, code.toUpperCase()), eq(vehiclesTable.qrCodeId, code)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  const route = applyDirection(await withFares(row.route), row.vehicle.direction);
  const pairFares = await pairFaresFor(row.route.routeId);

  // Where the trotro is now: the conductor's latest stop mark on this route and direction, so a passenger boarding
  // mid-route starts there. A route or direction change resets it to the origin.
  const [lastEvent] = await db.select().from(tripEventsTable).where(and(eq(tripEventsTable.vehicleId, row.vehicle.id), eq(tripEventsTable.eventType, "stop_reached"), gt(tripEventsTable.createdAt, new Date(Date.now() - 6 * 3_600_000)))).orderBy(desc(tripEventsTable.createdAt)).limit(1);
  const [lastChange] = await db.select().from(routeChangesTable).where(eq(routeChangesTable.vehicleId, row.vehicle.id)).orderBy(desc(routeChangesTable.createdAt)).limit(1);
  const fresh = lastEvent && (!lastChange || lastEvent.createdAt > lastChange.createdAt) && route.stopsJson.some((s) => s.name === lastEvent.stopName);
  const step = getRoundingStep();
  res.json({
    vehicle: {
      id: row.vehicle.id,
      shortCode: row.vehicle.shortCode,
      driverName: row.vehicle.driverName,
      conductorName: row.vehicle.conductorName,
      // Everything on the register is GPRTU Verified; an unknown code is a 404 and the app offers "Report unregistered".
      verified: true,
      suspended: isSuspended(row.vehicle),
    },
    fareNotice: await fareNotice(),
    currentStop: fresh ? lastEvent!.stopName : route.stopsJson[0]!.name,
    roundingStep: step,
    pairFares,
    route: {
      routeId: route.routeId,
      name: route.routeName,
      origin: route.origin,
      destination: route.destination,
      stops: route.stopsJson.map((s) => ({
        name: s.name,
        etaMinutes: s.etaMinutes,
        officialFare: s.fare,
        amountToPay: amountDue(s.fare, step),
        ...(s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : {}),
      })),
    },
  });
});

export default router;
