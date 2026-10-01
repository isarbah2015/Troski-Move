import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { parseScannedCode } from "@trotrolink/shared";
import { db } from "../db";
import { routesTable, vehiclesTable } from "../db/schema";

const router: IRouter = Router();

/** Passengers pay whole cedis: the official fare rounded up. Free (origin) stops stay 0. */
export function roundUpFare(fare: number): number {
  return Math.ceil(fare - 1e-9);
}

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

  res.json({
    vehicle: {
      id: row.vehicle.id,
      shortCode: row.vehicle.shortCode,
      driverName: row.vehicle.driverName,
      conductorName: row.vehicle.conductorName,
    },
    route: {
      routeId: row.route.routeId,
      name: row.route.routeName,
      origin: row.route.origin,
      destination: row.route.destination,
      stops: row.route.stopsJson.map((s) => ({
        name: s.name,
        etaMinutes: s.etaMinutes,
        officialFare: s.fare,
        amountToPay: roundUpFare(s.fare),
        ...(s.lat !== undefined && s.lng !== undefined ? { lat: s.lat, lng: s.lng } : {}),
      })),
    },
  });
});

export default router;
