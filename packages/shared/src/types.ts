/** One stage on a route. `fare` is the official GHS fare from the origin; `etaMinutes` is the leg time from the previous stop. */
export type RouteStop = { name: string; fare: number; etaMinutes: number; lat?: number; lng?: number };
