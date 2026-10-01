import { Router, type IRouter } from "express";
import { UnregisteredReportBody } from "@trotrolink/shared";
import { db } from "../db";
import { unregisteredReportsTable } from "../db/schema";
import { guestUserId } from "../lib";

const router: IRouter = Router();

/** A passenger reports a vehicle that is not on the GPRTU register (a code that does not exist, or no sticker at all). */
router.post("/reports/unregistered", async (req, res): Promise<void> => {
  const parsed = UnregisteredReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid report", issues: parsed.error.issues });
    return;
  }
  const b = parsed.data;
  const reporterId = await guestUserId(b.deviceId, "passenger");
  const [row] = await db
    .insert(unregisteredReportsTable)
    .values({ reporterId, codeSeen: b.code?.toUpperCase() ?? null, note: b.note ?? null, lat: b.lat?.toFixed(6) ?? null, lng: b.lng?.toFixed(6) ?? null })
    .returning({ id: unregisteredReportsTable.id });
  res.json({ ok: true, reportId: row!.id });
});

export default router;
