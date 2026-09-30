import type { RatingResult, RatingTarget } from '@/components/RatingSheet';
import { api } from '@/lib/api';
import { saveTripRating } from '@/lib/storage';

/**
 * Saves the rating on-device (`tripRatings[tripId]`, the source of truth for now) and tells the API.
 * The POST is best-effort: the API only logs it today, and a failure must never lose the rating.
 */
export async function submitTripRating(target: RatingTarget, result: RatingResult): Promise<void> {
  await saveTripRating(target.tripId, { ...result, ratedAt: new Date().toISOString() });
  if (target.vehicleId === undefined) return;
  try {
    await api.submitRating({ tripId: target.tripId, vehicleId: target.vehicleId, ...result });
  } catch {
    // TODO: queue and retry once backend sync exists.
  }
}

/** A completed trip stays eligible for the "rate your last trip" prompt for 24 hours. */
export const RATING_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
