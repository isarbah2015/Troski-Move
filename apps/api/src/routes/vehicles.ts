import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { routesTable, vehiclesTable } from "../db/schema";

const router: IRouter = Router();

/** Accepts a short code (`CIR01`), a raw QR id, or a scanned `trotrolink://v/<qr id>` payload. */
function parseCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^trotrolink:\/\/v\/(.+)$/i);
  return match ? match[1]! : trimmed;
}

/** Passengers pay whole cedis: the official fare rounded up. Free (origin) stops stay 0. */
export function roundUpFare(fare: number): number {
  return Math.ceil(fare - 1e-9);
}

router.get("/vehicles/resolve", async (req, res): Promise<void> => {
  const raw = typeof req.query["code"] === "string" ? req.query["code"] : "";
  const code = parseCode(raw);
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
      })),
    },
  });
});

export default router;
