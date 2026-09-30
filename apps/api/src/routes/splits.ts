import { Router, type IRouter } from "express";
import { SplitBody } from "@trotrolink/shared";
import { db } from "../db";
import { dailySplitsTable } from "../db/schema";
import { round2, vehicleWithRoute } from "../lib";

const router: IRouter = Router();

/** The conductor closes the day: upserts that vehicle's split and returns what the driver keeps. */
router.post("/splits", async (req, res): Promise<void> => {
  const parsed = SplitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const found = await vehicleWithRoute(b.vehicleCode);
  if (!found) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  // The table's `driver_net` holds what is left of the day's fares after owner drop, conductor wage and fuel.
  const driverNet = round2(b.totalFares - (b.ownerDrop + b.conductorWage + b.fuelCost));
  const values = {
    vehicleId: found.vehicle.id,
    date: b.date,
    totalFares: b.totalFares.toFixed(2),
    ownerDrop: b.ownerDrop.toFixed(2),
    conductorWage: b.conductorWage.toFixed(2),
    fuelCost: b.fuelCost.toFixed(2),
    driverNet: driverNet.toFixed(2),
  };
  await db
    .insert(dailySplitsTable)
    .values(values)
    .onConflictDoUpdate({ target: [dailySplitsTable.vehicleId, dailySplitsTable.date], set: values });
  res.json({ ok: true, driverNet });
});

export default router;
