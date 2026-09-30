import { Router, type IRouter } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { DriverRatingsResponse, LeaderboardEntry, LeaderboardResponse } from "@trotrolink/shared";
import { db } from "../db";
import { ratingsTable, vehiclesTable } from "../db/schema";

const router: IRouter = Router();

const MIN_RATINGS = 3;
const DAY = sql`now() - interval '24 hours'`;
const WEEK = sql`now() - interval '7 days'`;

// Sample standings served until real ratings exist (never in production, or with ?mock=off).
const MOCK_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, shortCode: "TEM03", driverName: "Nii Lamptey", avgRating: 4.9, totalRatings: 12 },
  { rank: 2, shortCode: "MAD05", driverName: "Kwabena Darko", avgRating: 4.7, totalRatings: 8 },
  { rank: 3, shortCode: "CIR01", driverName: "Kwame Mensah", avgRating: 4.5, totalRatings: 15 },
  { rank: 4, shortCode: "KAS12", driverName: "Esi Mansa", avgRating: 4.3, totalRatings: 6 },
  { rank: 5, shortCode: "ACC03", driverName: "Kofi Annan", avgRating: 4.1, totalRatings: 10 },
];
const MOCK_YOU = { rank: 3, shortCode: "CIR01", avgRating: 4.5, ratingsThisWeek: 48 };
const MOCK_COMMENTS = [null, "Smooth driving, arrived early", null, "Polite conductor", null, "Played loud music", "Gave correct change", null, "Very safe driver", null];

function mockAllowed(req: { query: Record<string, unknown> }) {
  return process.env.NODE_ENV !== "production" && req.query["mock"] !== "off";
}

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; ranked: LeaderboardEntry[] } | null = null;

/** A new rating changes the standings, so the cache is dropped on every rating. */
export function invalidateLeaderboardCache() {
  cache = null;
}

/** Every vehicle with at least 3 ratings in the last 24 hours, best first. Cached for 5 minutes. */
async function loadRanked(): Promise<LeaderboardEntry[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ranked;
  const avg = sql<string>`round(avg(${ratingsTable.driverRating})::numeric, 1)`;
  const total = sql<number>`count(${ratingsTable.id})::int`;
  const rows = await db
    .select({ shortCode: vehiclesTable.shortCode, driverName: vehiclesTable.driverName, avg, total })
    .from(ratingsTable)
    .innerJoin(vehiclesTable, eq(ratingsTable.vehicleId, vehiclesTable.id))
    .where(gt(ratingsTable.ratedAt, DAY))
    .groupBy(vehiclesTable.id, vehiclesTable.shortCode, vehiclesTable.driverName)
    .having(sql`count(${ratingsTable.id}) >= ${MIN_RATINGS}`)
    .orderBy(desc(sql`avg(${ratingsTable.driverRating})`), desc(total));
  const ranked = rows.map((r, i) => ({ rank: i + 1, shortCode: r.shortCode, driverName: r.driverName, avgRating: Number(r.avg), totalRatings: r.total }));
  cache = { at: Date.now(), ranked };
  return ranked;
}

/** Top 5 vehicles by average driver rating in the last 24 hours (minimum 3 ratings). */
router.get("/leaderboard/daily", async (req, res): Promise<void> => {
  const ranked = await loadRanked();
  const updatedAt = new Date().toISOString();

  if (ranked.length === 0 && mockAllowed(req)) {
    const body: LeaderboardResponse = { mock: true, updatedAt, entries: MOCK_ENTRIES, you: MOCK_YOU };
    res.json(body);
    return;
  }

  const vehicle = typeof req.query["vehicle"] === "string" ? req.query["vehicle"].toUpperCase() : null;
  const mine = vehicle ? ranked.find((e) => e.shortCode === vehicle) : undefined;
  let you: LeaderboardResponse["you"] = null;
  if (mine) {
    const [week] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(ratingsTable)
      .innerJoin(vehiclesTable, eq(ratingsTable.vehicleId, vehiclesTable.id))
      .where(and(eq(vehiclesTable.shortCode, mine.shortCode), gt(ratingsTable.ratedAt, WEEK)));
    you = { rank: mine.rank, shortCode: mine.shortCode, avgRating: mine.avgRating, ratingsThisWeek: week?.n ?? 0 };
  }

  const body: LeaderboardResponse = { mock: false, updatedAt, entries: ranked.slice(0, 5), you };
  res.json(body);
});

/** The last 10 ratings (with optional comments) behind one vehicle's standing. */
router.get("/leaderboard/:shortCode/ratings", async (req, res): Promise<void> => {
  const shortCode = String(req.params["shortCode"]).toUpperCase();

  const rows = await db
    .select({ rating: ratingsTable.driverRating, comment: ratingsTable.comment, ratedAt: ratingsTable.ratedAt, driverName: vehiclesTable.driverName })
    .from(ratingsTable)
    .innerJoin(vehiclesTable, eq(ratingsTable.vehicleId, vehiclesTable.id))
    .where(and(eq(vehiclesTable.shortCode, shortCode), gt(ratingsTable.ratedAt, DAY)))
    .orderBy(desc(ratingsTable.ratedAt))
    .limit(10);

  if (rows.length === 0) {
    const sample = MOCK_ENTRIES.find((e) => e.shortCode === shortCode);
    if (sample && mockAllowed(req)) {
      const now = Date.now();
      // Deterministic sample ratings whose mean is close to the vehicle's average.
      const entries = Array.from({ length: Math.min(10, sample.totalRatings) }, (_, i) => ({
        rating: Math.max(1, Math.min(5, i % Math.round(1 / Math.max(0.1, 5 - sample.avgRating)) === 0 ? 4 : 5)),
        comment: MOCK_COMMENTS[i % MOCK_COMMENTS.length] ?? null,
        ratedAt: new Date(now - (i + 1) * 47 * 60_000).toISOString(),
      }));
      const body: DriverRatingsResponse = { mock: true, shortCode, driverName: sample.driverName, entries };
      res.json(body);
      return;
    }
  }

  const [v] = await db.select({ driverName: vehiclesTable.driverName }).from(vehiclesTable).where(eq(vehiclesTable.shortCode, shortCode));
  if (!v) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }
  const body: DriverRatingsResponse = {
    mock: false,
    shortCode,
    driverName: v.driverName,
    entries: rows.map((r) => ({ rating: r.rating, comment: r.comment || null, ratedAt: r.ratedAt.toISOString() })),
  };
  res.json(body);
});

export default router;
