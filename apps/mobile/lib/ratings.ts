import type { RatingResult, RatingTarget } from '@/components/RatingSheet';
import { saveTripRating } from '@/lib/storage';
import { sendOrQueue } from '@/lib/sync';

/**
 * Saves the rating on-device (`tripRatings[tripId]`, the source of truth for now) and tells the API.
 * The API write goes through the offline queue, so a failure never loses the rating.
 */
export async function submitTripRating(target: RatingTarget, result: RatingResult): Promise<void> {
  await saveTripRating(target.tripId, { ...result, ratedAt: new Date().toISOString() });
  await sendOrQueue({ type: 'rating', body: { tripId: target.tripId, vehicleId: target.vehicleId, ...result } });
}

/** A completed trip stays eligible for the "rate your last trip" prompt for 24 hours. */
export const RATING_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;
