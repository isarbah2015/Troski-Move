import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { routesTable, vehiclesTable, type RouteStop } from "./schema";

/**
 * Official GHS fare is cumulative from the origin; etaMinutes is the leg time from the previous stop.
 * Each route has 5 stops and the first stop is the origin (fare 0, 0 min).
 */
// TODO: Replace with real GPRTU fares when union data is provided
const ROUTES: Array<{
  routeId: string;
  origin: string;
  destination: string;
  routeName: string;
  distanceKm: string;
  stops: RouteStop[];
  vehicles: Array<{ shortCode: string; driverName: string; conductorName: string }>;
}> = [
  {
    routeId: "CIR-KSA-01",
    origin: "Circle",
    destination: "Kasoa",
    routeName: "Circle → Kasoa via Kaneshie",
    distanceKm: "35.0",
    stops: [
      { name: "Circle", fare: 0, etaMinutes: 0 },
      { name: "Kaneshie", fare: 1.5, etaMinutes: 8 },
      { name: "Odorkor", fare: 3.5, etaMinutes: 10 },
      { name: "Mallam", fare: 6.0, etaMinutes: 12 },
      { name: "Kasoa", fare: 10.0, etaMinutes: 20 },
    ],
    vehicles: [
      { shortCode: "CIR01", driverName: "Kwame Mensah", conductorName: "Yaw Boateng" },
      { shortCode: "CIR02", driverName: "Kofi Asante", conductorName: "Kojo Owusu" },
      { shortCode: "CIR03", driverName: "Nii Armah", conductorName: "Ebo Quaye" },
    ],
  },
  {
    routeId: "MAD-ACC-01",
    origin: "Madina",
    destination: "Accra Central",
    routeName: "Madina → Accra Central via Legon",
    distanceKm: "17.0",
    stops: [
      { name: "Madina", fare: 0, etaMinutes: 0 },
      { name: "Legon", fare: 2.5, etaMinutes: 12 },
      { name: "Tetteh Quarshie", fare: 4.0, etaMinutes: 8 },
      { name: "Circle", fare: 5.5, etaMinutes: 12 },
      { name: "Accra Central", fare: 7.0, etaMinutes: 15 },
    ],
    vehicles: [{ shortCode: "MAD05", driverName: "Kwabena Darko", conductorName: "Yaw Sarpong" }],
  },
  {
    routeId: "TEM-C1-01",
    origin: "Tema Station",
    destination: "Tema Community 1",
    routeName: "Tema Station → Tema Community 1",
    distanceKm: "8.0",
    stops: [
      { name: "Tema Station", fare: 0, etaMinutes: 0 },
      { name: "Community 4", fare: 1.0, etaMinutes: 5 },
      { name: "Community 3", fare: 1.5, etaMinutes: 4 },
      { name: "Community 2", fare: 2.0, etaMinutes: 5 },
      { name: "Community 1", fare: 2.5, etaMinutes: 5 },
    ],
    vehicles: [{ shortCode: "TEM03", driverName: "Nii Lamptey", conductorName: "Kwesi Appiah" }],
  },
];

async function main() {
  // Re-running is safe: existing routes and vehicles (and their QR ids) are left untouched.
  for (const r of ROUTES) {
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
      .onConflictDoNothing({ target: routesTable.routeId });

    const [route] = await db.select().from(routesTable).where(eq(routesTable.routeId, r.routeId));
    if (!route) throw new Error(`Seed route ${r.routeId} missing`);

    await db
      .insert(vehiclesTable)
      .values(r.vehicles.map((v) => ({ ...v, routeId: route.id, qrCodeId: `trl_${randomUUID()}` })))
      .onConflictDoNothing({ target: vehiclesTable.shortCode });
  }

  console.log("Seeded routes", ROUTES.map((r) => r.routeId).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
