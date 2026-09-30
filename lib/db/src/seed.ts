import { randomUUID } from "node:crypto";
import { db, pool, routesTable, vehiclesTable, type RouteStop } from "./index";

/** Official GHS fare is cumulative from the origin; etaMinutes is the leg time from the previous stop. */
const CIRCLE_KASOA_STOPS: RouteStop[] = [
  { name: "Circle", fare: 0, etaMinutes: 0 },
  { name: "Kaneshie", fare: 1.5, etaMinutes: 8 },
  { name: "Odorkor", fare: 3.5, etaMinutes: 10 },
  { name: "Mallam", fare: 6.0, etaMinutes: 12 },
  { name: "Kasoa", fare: 10.0, etaMinutes: 20 },
];

const VEHICLES = [
  { shortCode: "CIR01", driverName: "Kwame Mensah", conductorName: "Yaw Boateng" },
  { shortCode: "CIR02", driverName: "Kofi Asante", conductorName: "Kojo Owusu" },
  { shortCode: "CIR03", driverName: "Nii Armah", conductorName: "Ebo Quaye" },
];

async function main() {
  await db
    .insert(routesTable)
    .values({
      routeId: "CIR-KSA-01",
      origin: "Circle",
      destination: "Kasoa",
      routeName: "Circle → Kasoa via Kaneshie",
      stopsJson: CIRCLE_KASOA_STOPS,
      distanceKm: "35.0",
    })
    .onConflictDoNothing({ target: routesTable.routeId });

  const route = await db.query.routesTable.findFirst({
    where: (t, { eq }) => eq(t.routeId, "CIR-KSA-01"),
  });
  if (!route) throw new Error("Seed route missing");

  // Re-running is safe: existing short codes (and their QR ids) are left untouched.
  await db
    .insert(vehiclesTable)
    .values(VEHICLES.map((v) => ({ ...v, routeId: route.id, qrCodeId: `trl_${randomUUID()}` })))
    .onConflictDoNothing({ target: vehiclesTable.shortCode });

  console.log("Seeded route CIR-KSA-01 and vehicles", VEHICLES.map((v) => v.shortCode).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
