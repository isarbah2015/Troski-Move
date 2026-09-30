export const USER_ROLES = ['passenger', 'conductor', 'driver', 'union_admin'] as const;
export const DISPUTE_STATUSES = ['open', 'investigating', 'resolved', 'rejected'] as const;
export const DISPUTE_TYPES = ['overcharge', 'wrong_stop', 'payment_failed', 'other'] as const;

/** Conductor daily bonus: this many scans at this average rating earns the bonus (GHS). */
export const CONDUCTOR_BONUS = { scans: 200, minAvgRating: 4.0, amountGhs: 10 } as const;
