import { randomUUID } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { db, pool } from "./index";
import { SEED_ROUTES } from "@trotrolink/shared";
import { routesTable, vehiclesTable } from "./schema";

/**
 * Official GHS fare is cumulative from the origin; etaMinutes is the leg time from the previous stop.
 * Each route has 5 stops and the first stop is the origin (fare 0, 0 min).
 */
async function main() {
  // Re-running is safe: existing routes and vehicles (and their QR ids) are left untouched.
  for (const r of SEED_ROUTES) {
    await db
      .insert(routesTable)
      .values({
        routeId: r.routeId,
        origin: r.origin,
        destination: r.destination,
        routeName: r.routeName,
        stopsJson: r.stops,
        distanceKm: r.distanceKm,
      })
      // Existing databases get the latest stops (fares, times, coordinates); vehicles and QR ids are never touched.
      .onConflictDoUpdate({ target: routesTable.routeId, set: { stopsJson: r.stops, routeName: r.routeName, distanceKm: r.distanceKm } });

    const [route] = await db.select().from(routesTable).where(eq(routesTable.routeId, r.routeId));
    if (!route) throw new Error(`Seed route ${r.routeId} missing`);

    await db
      .insert(vehiclesTable)
      .values(r.vehicles.map((v) => ({ ...v, routeId: route.id, qrCodeId: `trl_${randomUUID()}` })))
      .onConflictDoNothing({ target: vehiclesTable.shortCode });
  }

  // Placeholder driver numbers so the warning-SMS flow can be shown. Replace with real numbers from the vehicle register.
  const all = await db.select({ id: vehiclesTable.id }).from(vehiclesTable).where(isNull(vehiclesTable.driverPhone));
  for (const v of all) await db.update(vehiclesTable).set({ driverPhone: `+23320000${String(v.id).padStart(4, "0")}` }).where(eq(vehiclesTable.id, v.id));

  console.log("Seeded routes", SEED_ROUTES.map((r) => r.routeId).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
