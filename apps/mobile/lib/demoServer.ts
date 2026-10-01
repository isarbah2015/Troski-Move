/**
 * Offline demo mode: the whole TrotroLink API running inside the app, so a demo needs no server, database or
 * internet. It mirrors the real API's rules (server-set price, payment-first trips, overstay + auto-charge,
 * conductor PIN sessions, disputes). State lives in AsyncStorage on this phone, so the passenger and conductor
 * roles (switched in Profile) see each other's activity. It is used when EXPO_PUBLIC_API_URL is not set.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alightCheck, SEED_ROUTES, parseScannedCode, type RouteStop } from '@trotrolink/shared';

const KEY = 'demoDb';
const APPROVE_MS = 3000;
const AUTO_EXTEND_MS = 60_000;
const SESSION_MS = 12 * 3_600_000;

type Trip = {
  tripId: string; deviceId: string; vehicleCode: string; boarding: string; alighting: string; current: string; paid: number;
  startedAt: number; arrivedAt?: number; active: boolean; lastMarkAt?: number; customStopNote?: string; alightGps?: { status: 'near' | 'far'; distanceM: number };
  overstayStop?: string; overstayAt?: number; autoExtendedAt?: number;
};
type Payment = { ref: string; tripId: string; deviceId: string; vehicleCode: string; boarding: string; alighting: string; amount: number; createdAt: number; status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'; extendsTrip?: string; customStopNote?: string };
type Db = {
  trips: Trip[]; payments: Payment[];
  conductors: Record<string, { pin: string; failed: number; lockedUntil?: number }>;
  sessions: Record<string, { vehicleCode: string; expiresAt: number }>;
  ratings: Array<{ tripId: string; vehicleCode: string; driver: number; conductor: number; comment?: string; at: number }>;
  splits: Array<Record<string, unknown>>; disputes: Array<Record<string, unknown>>; events: Array<Record<string, unknown>>;
};

let db: Db | null = null;
async function load(): Promise<Db> {
  if (db) return db;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    db = raw ? (JSON.parse(raw) as Db) : null;
  } catch {
    db = null;
  }
  db ??= { trips: [], payments: [], conductors: {}, sessions: {}, ratings: [], splits: [], disputes: [], events: [] };
  return db;
}
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(db));

/** Wipes the demo's data (used by Sign out, so a demo can be reset). */
export async function resetDemo() {
  db = null;
  await AsyncStorage.removeItem(KEY);
}

/**
 * Puts a paid, in-progress trip into the demo so the Trip tab has something real to show on first launch: a passenger
 * on CIR01 from Circle to `alighting`, with the vehicle already at the stop after the origin. Idempotent per trip id.
 */
export async function seedTrip(p: { tripId: string; deviceId: string; vehicleCode: string; alighting: string; current: string; minutesAgo: number }) {
  const d = await load();
  if (d.trips.some((t) => t.tripId === p.tripId)) return;
  const v = vehicle(p.vehicleCode)!;
  const stops = v.route.stops;
  const to = idx(stops, p.alighting);
  const paid = due(round2(stops[to]!.fare - stops[0]!.fare));
  const startedAt = Date.now() - p.minutesAgo * 60_000;
  d.payments.push({ ref: `demo-seed-${p.tripId}`, tripId: p.tripId, deviceId: p.deviceId, vehicleCode: v.shortCode, boarding: stops[0]!.name, alighting: stops[to]!.name, amount: paid, createdAt: startedAt, status: 'SUCCESSFUL' });
  d.trips.push({ tripId: p.tripId, deviceId: p.deviceId, vehicleCode: v.shortCode, boarding: stops[0]!.name, alighting: stops[to]!.name, current: p.current, paid, startedAt, active: true, lastMarkAt: Date.now() - 60_000 });
  d.events.push({ vehicle: v.shortCode, type: 'boarded', stop: stops[0]!.name, at: startedAt });
  d.events.push({ vehicle: v.shortCode, type: 'stop_reached', stop: p.current, at: Date.now() - 60_000 });
  await save();
}

class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}
const fail = (status: number, message: string, extra?: Record<string, unknown>): never => {
  throw new HttpError(status, message, extra);
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const due = (fare: number) => Math.ceil(fare - 1e-9);
const guestId = (deviceId: string) => {
  let h = 7;
  for (const c of deviceId) h = (h * 31 + c.charCodeAt(0)) % 1_000_000;
  return h + 1;
};

const VEHICLES = SEED_ROUTES.flatMap((r, ri) => r.vehicles.map((v, vi) => ({ ...v, id: ri * 10 + vi + 1, route: r })));
const vehicle = (code: string) => VEHICLES.find((v) => v.shortCode === code.toUpperCase());
const idx = (stops: RouteStop[], name: string) => stops.findIndex((s) => s.name.toLowerCase() === name.trim().toLowerCase());
const eta = (stops: RouteStop[], from: number, to: number) => stops.slice(from + 1, to + 1).reduce((a, s) => a + s.etaMinutes, 0);

function authed(d: Db, headers: Headers): string {
  const h = headers.get('authorization');
  const token = h?.startsWith('Bearer ') ? h.slice(7) : '';
  const s = d.sessions[token];
  if (!s || s.expiresAt < Date.now()) return fail(401, 'Sign in as a conductor');
  return s.vehicleCode;
}
const ownVehicle = (code: string, wanted: string) => { if (code !== wanted.toUpperCase()) fail(403, 'This is not your vehicle'); };

function settle(d: Db, p: Payment) {
  if (p.status !== 'PENDING') return;
  if (Date.now() - p.createdAt < APPROVE_MS) return;
  p.status = 'SUCCESSFUL';
  const v = vehicle(p.vehicleCode)!;
  const stops = v.route.stops;
  if (p.extendsTrip) {
    const t = d.trips.find((x) => x.tripId === p.extendsTrip);
    if (t) {
      t.alighting = p.alighting; t.current = p.alighting; t.paid = round2(t.paid + p.amount);
      t.overstayStop = undefined; t.overstayAt = undefined;
    }
    return;
  }
  d.trips.push({ tripId: p.tripId, deviceId: p.deviceId, vehicleCode: p.vehicleCode, boarding: p.boarding, alighting: p.alighting, current: p.boarding, paid: p.amount, startedAt: p.createdAt, active: true, customStopNote: p.customStopNote });
  d.events.push({ vehicle: p.vehicleCode, type: 'boarded', stop: stops[idx(stops, p.boarding)]!.name, at: Date.now() });
}

/** Charges passengers who ignored the overstay prompt for 60 seconds, and settles approved payments. */
function tick(d: Db) {
  for (const t of d.trips) {
    if (t.active && t.overstayStop && t.overstayAt && !t.autoExtendedAt && Date.now() - t.overstayAt > AUTO_EXTEND_MS) {
      t.autoExtendedAt = Date.now();
      extension(d, t);
    }
  }
  d.payments.forEach((p) => settle(d, p));
}

function extension(d: Db, t: Trip): Payment | null {
  const stops = vehicle(t.vehicleCode)!.route.stops;
  const to = idx(stops, t.overstayStop ?? '');
  const extra = due(round2(stops[to]!.fare - stops[idx(stops, t.boarding)]!.fare)) - t.paid;
  if (to < 0 || extra <= 0) return null;
  const open = d.payments.find((p) => p.extendsTrip === t.tripId && p.alighting === stops[to]!.name && p.status === 'PENDING');
  if (open) return open;
  const p: Payment = { ref: `demo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, tripId: `${t.tripId}-X${d.payments.length}`, deviceId: t.deviceId, vehicleCode: t.vehicleCode, boarding: t.alighting, alighting: stops[to]!.name, amount: extra, createdAt: Date.now(), status: 'PENDING', extendsTrip: t.tripId };
  d.payments.push(p);
  return p;
}

function serverTrip(t: Trip) {
  const stops = vehicle(t.vehicleCode)!.route.stops;
  let overstay = null;
  if (t.overstayStop && t.overstayAt) {
    const extra = due(round2(stops[idx(stops, t.overstayStop)]!.fare - stops[idx(stops, t.boarding)]!.fare)) - t.paid;
    overstay = { stop: t.overstayStop, extraFare: Math.max(0, extra), deadline: new Date(t.overstayAt + AUTO_EXTEND_MS).toISOString() };
  }
  return {
    tripId: t.tripId, passengerId: guestId(t.deviceId), vehicleCode: t.vehicleCode, boardingStop: t.boarding, alightingStop: t.alighting,
    currentStop: t.current, stopsRemaining: Math.max(0, idx(stops, t.alighting) - idx(stops, t.current)),
    etaMinutes: eta(stops, idx(stops, t.current), idx(stops, t.alighting)), startedAt: new Date(t.startedAt).toISOString(),
    lastStopMarkedAt: t.lastMarkAt ? new Date(t.lastMarkAt).toISOString() : null, amountPaid: t.paid, customStopNote: t.customStopNote ?? null, overstay,
  };
}

const MOCK = [
  { rank: 1, shortCode: 'TEM03', driverName: 'Nii Lamptey', avgRating: 4.9, totalRatings: 12 },
  { rank: 2, shortCode: 'MAD05', driverName: 'Kwabena Darko', avgRating: 4.7, totalRatings: 8 },
  { rank: 3, shortCode: 'CIR01', driverName: 'Kwame Mensah', avgRating: 4.5, totalRatings: 15 },
  { rank: 4, shortCode: 'KAS12', driverName: 'Esi Mansa', avgRating: 4.3, totalRatings: 6 },
  { rank: 5, shortCode: 'ACC03', driverName: 'Kofi Annan', avgRating: 4.1, totalRatings: 10 },
];
const COMMENTS = [null, 'Smooth driving, arrived early', null, 'Polite conductor', null, 'Played loud music', 'Gave correct change', null, 'Very safe driver', null];

function endTrip(d: Db, t: Trip, stop: string) {
  if (!t.active) return;
  t.active = false;
  t.arrivedAt ??= Date.now();
  d.events.push({ vehicle: t.vehicleCode, type: 'alighted', stop, at: Date.now() });
}

async function route(method: string, path: string, query: URLSearchParams, body: any, headers: Headers): Promise<unknown> {
  const d = await load();
  tick(d);
  const post = method === 'POST';
  let m: RegExpMatchArray | null;

  if (path === '/healthz') return { status: 'ok' };

  if (path === '/vehicles/resolve') {
    const v = vehicle(parseScannedCode(query.get('code') ?? ''));
    if (!v) fail(404, 'Vehicle not found');
    return {
      vehicle: { id: v!.id, shortCode: v!.shortCode, driverName: v!.driverName, conductorName: v!.conductorName, verified: true, suspended: false },
      fareNotice: null,
      route: { routeId: v!.route.routeId, name: v!.route.routeName, origin: v!.route.origin, destination: v!.route.destination, stops: v!.route.stops.map((s) => ({ name: s.name, etaMinutes: s.etaMinutes, officialFare: s.fare, amountToPay: due(s.fare), lat: s.lat, lng: s.lng })) },
    };
  }

  if (post && path === '/guests') return { userId: guestId(String(body.deviceId)) };

  if (post && path === '/payments/initiate') {
    const v = vehicle(String(body.vehicleCode)); if (!v) fail(404, 'Vehicle not found');
    const stops = v!.route.stops;
    const from = body.boardingStop ? idx(stops, body.boardingStop) : 0;
    const to = idx(stops, String(body.alightingStop));
    if (from < 0 || to < 0 || to <= from) fail(400, 'Unknown or out-of-order stops for this route');
    const fare = round2(stops[to]!.fare - stops[from]!.fare);
    if (Math.abs(Number(body.amount) - due(fare)) > 0.001) fail(400, 'Amount does not match the fare for this trip', { amountDue: due(fare) });
    const same = d.payments.find((p) => p.tripId === body.tripId) ?? d.payments.find((p) => p.deviceId === body.deviceId && p.vehicleCode === v!.shortCode && p.alighting === stops[to]!.name && p.status === 'PENDING' && !p.extendsTrip);
    if (same) return { referenceId: same.ref, tripId: same.tripId, status: same.status, simulator: true };
    const p: Payment = { ref: `demo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, tripId: String(body.tripId), deviceId: String(body.deviceId), vehicleCode: v!.shortCode, boarding: stops[from]!.name, alighting: stops[to]!.name, amount: due(fare), createdAt: Date.now(), status: 'PENDING', customStopNote: body.customStopNote ? String(body.customStopNote).slice(0, 120) : undefined };
    d.payments.push(p);
    await save();
    return { referenceId: p.ref, tripId: p.tripId, status: 'PENDING', simulator: true };
  }
  if ((m = path.match(/^\/payments\/status\/(.+)$/))) {
    const p = d.payments.find((x) => x.ref === decodeURIComponent(m![1]!)); if (!p) fail(404, 'Payment not found');
    settle(d, p!); await save();
    return { status: p!.status, ...(p!.status === 'SUCCESSFUL' ? { tripId: p!.tripId } : {}) };
  }

  if (post && path === '/conductor/setup') {
    const code = String(body.vehicleCode ?? '').toUpperCase();
    if (!vehicle(code)) fail(404, 'Vehicle not found');
    if (!/^\d{4}$/.test(String(body.pin))) fail(400, 'A vehicle code and a 4-digit PIN are required');
    if (d.conductors[code]) fail(409, 'This vehicle already has a PIN. Log in, or ask the union to reset it.');
    d.conductors[code] = { pin: String(body.pin), failed: 0 };
    await save();
    return { ok: true };
  }
  if (post && path === '/conductor/login') {
    const code = String(body.vehicleCode ?? '').toUpperCase();
    const c = d.conductors[code];
    if (!c) fail(401, 'Wrong vehicle code or PIN');
    if (c!.lockedUntil && c!.lockedUntil > Date.now()) fail(429, `Too many wrong PINs. Try again in ${Math.ceil((c!.lockedUntil - Date.now()) / 60_000)} minutes.`);
    if (c!.pin !== String(body.pin)) {
      c!.failed += 1;
      const lock = c!.failed >= 5;
      if (lock) { c!.failed = 0; c!.lockedUntil = Date.now() + 15 * 60_000; }
      await save();
      fail(lock ? 429 : 401, lock ? 'Too many wrong PINs. Locked for 15 minutes.' : 'Wrong vehicle code or PIN');
    }
    c!.failed = 0;
    const token = `demo${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    d.sessions[token] = { vehicleCode: code, expiresAt: Date.now() + SESSION_MS };
    await save();
    return { token, expiresAt: new Date(Date.now() + SESSION_MS).toISOString(), conductorId: guestId(code), vehicleCode: code, conductorName: vehicle(code)!.conductorName };
  }
  if (post && path === '/conductor/logout') {
    const h = headers.get('authorization'); if (h) delete d.sessions[h.slice(7)];
    await save();
    return { ok: true };
  }

  if (post && path === '/account/delete') {
    d.trips = d.trips.filter((t) => t.deviceId !== body.deviceId);
    d.payments = d.payments.filter((p) => p.deviceId !== body.deviceId);
    await save();
    return { ok: true };
  }
  if (post && path === '/conductor/delete') {
    const own = authed(d, headers);
    delete d.conductors[own];
    for (const [t, sess] of Object.entries(d.sessions)) if (sess.vehicleCode === own) delete d.sessions[t];
    await save();
    return { ok: true };
  }

  if (post && path === '/trips/stop') {
    const own = authed(d, headers); ownVehicle(own, String(body.vehicleCode));
    const v = vehicle(own)!; const stops = v.route.stops;
    const at = idx(stops, String(body.stopName)); if (at < 0) fail(400, 'Unknown stop for this route');
    d.events.push({ vehicle: own, type: 'stop_reached', stop: stops[at]!.name, at: Date.now() });
    let n = 0;
    for (const t of d.trips.filter((x) => x.active && x.vehicleCode === own)) {
      const board = idx(stops, t.boarding), alight = idx(stops, t.alighting), cur = idx(stops, t.current);
      t.lastMarkAt = Date.now();
      if (at > alight) {
        const furthest = t.overstayStop ? Math.max(at, idx(stops, t.overstayStop)) : at;
        t.overstayStop = stops[furthest]!.name; t.overstayAt ??= Date.now(); t.current = stops[alight]!.name; n++; continue;
      }
      const target = Math.min(at, alight);
      if (at < board || target <= cur) continue;
      t.current = stops[target]!.name; n++;
      if (target === alight) d.events.push({ vehicle: own, type: 'arrived', stop: stops[alight]!.name, at: Date.now() });
    }
    await save();
    return { ok: true, passengersNotified: n };
  }
  if (path === '/trips/active') {
    const vc = query.get('vehicleCode')?.toUpperCase(), tid = query.get('tripId');
    let list: Trip[] = [];
    if (vc) { ownVehicle(authed(d, headers), vc); list = d.trips.filter((t) => t.active && t.vehicleCode === vc); }
    else if (tid) list = d.trips.filter((t) => t.active && t.tripId === tid);
    else fail(400, 'Provide vehicleCode, tripId or passengerId');
    await save();
    return { trips: list.map(serverTrip) };
  }
  if (post && (path === '/trips/alight' || path === '/trips/getoff')) {
    const t = d.trips.find((x) => x.tripId === body.tripId); if (!t) fail(404, 'Trip not found');
    // GPS check: informational only, never blocks alighting.
    const stops = vehicle(t!.vehicleCode)!.route.stops;
    const check = typeof body.lat === 'number' && typeof body.lng === 'number' ? alightCheck(stops[idx(stops, t!.alighting)], { lat: body.lat, lng: body.lng }) : null;
    if (check) t!.alightGps = check;
    endTrip(d, t!, t!.alighting); await save(); return { ok: true };
  }
  if (post && path === '/trips/extend') {
    const t = d.trips.find((x) => x.active && x.tripId === body.tripId);
    if (!t?.overstayStop) fail(409, 'This trip has not passed its stop');
    const p = extension(d, t!); if (!p) fail(502, 'Could not start the payment. Try again.');
    t!.autoExtendedAt = Date.now(); await save();
    return { referenceId: p!.ref, tripId: p!.tripId, status: p!.status, simulator: true };
  }
  if (post && path === '/trips/confirm-alight') {
    const t = d.trips.find((x) => x.active && x.tripId === body.tripId); if (!t) fail(404, 'Trip not found');
    ownVehicle(authed(d, headers), t!.vehicleCode);
    if (t!.overstayStop && !t!.autoExtendedAt) extension(d, t!);
    endTrip(d, t!, t!.overstayStop ?? t!.alighting); await save(); return { ok: true };
  }

  if (post && path === '/ratings') {
    const t = d.trips.find((x) => x.tripId === body.tripId); if (!t) fail(404, 'Trip not found');
    const r = d.ratings.find((x) => x.tripId === t!.tripId);
    const row = { tripId: t!.tripId, vehicleCode: t!.vehicleCode, driver: Number(body.driverRating), conductor: Number(body.conductorRating), comment: body.comment, at: Date.now() };
    if (r) Object.assign(r, row); else d.ratings.push(row);
    endTrip(d, t!, t!.alighting); await save(); return { ok: true };
  }
  if (post && path === '/splits') {
    ownVehicle(authed(d, headers), String(body.vehicleCode));
    d.splits.push(body); await save();
    return { ok: true, driverNet: round2(body.totalFares - (body.ownerDrop + body.conductorWage + body.fuelCost)) };
  }

  if (path === '/leaderboard/daily') {
    const since = Date.now() - 24 * 3_600_000;
    const by = new Map<string, number[]>();
    for (const r of d.ratings) if (r.at > since) by.set(r.vehicleCode, [...(by.get(r.vehicleCode) ?? []), r.driver]);
    const ranked = [...by.entries()].filter(([, a]) => a.length >= 3).map(([c, a]) => ({ shortCode: c, driverName: vehicle(c)!.driverName, avgRating: Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10, totalRatings: a.length })).sort((a, b) => b.avgRating - a.avgRating || b.totalRatings - a.totalRatings).map((e, i) => ({ rank: i + 1, ...e }));
    const updatedAt = new Date().toISOString();
    if (ranked.length === 0 && query.get('mock') !== 'off') return { mock: true, updatedAt, entries: MOCK, you: { rank: 3, shortCode: 'CIR01', avgRating: 4.5, ratingsThisWeek: 48 } };
    const mine = ranked.find((e) => e.shortCode === query.get('vehicle')?.toUpperCase());
    return { mock: false, updatedAt, entries: ranked.slice(0, 5), you: mine ? { rank: mine.rank, shortCode: mine.shortCode, avgRating: mine.avgRating, ratingsThisWeek: mine.totalRatings } : null };
  }
  if ((m = path.match(/^\/leaderboard\/([^/]+)\/ratings$/))) {
    const code = decodeURIComponent(m[1]!).toUpperCase();
    const real = d.ratings.filter((r) => r.vehicleCode === code && r.at > Date.now() - 24 * 3_600_000).sort((a, b) => b.at - a.at).slice(0, 10);
    const sample = MOCK.find((e) => e.shortCode === code);
    if (real.length === 0 && sample && query.get('mock') !== 'off') {
      return { mock: true, shortCode: code, driverName: sample.driverName, entries: Array.from({ length: Math.min(10, sample.totalRatings) }, (_, i) => ({ rating: i % 4 === 0 ? 4 : 5, comment: COMMENTS[i % COMMENTS.length], ratedAt: new Date(Date.now() - (i + 1) * 47 * 60_000).toISOString() })) };
    }
    const v = vehicle(code); if (!v) fail(404, 'Vehicle not found');
    return { mock: false, shortCode: code, driverName: v!.driverName, entries: real.map((r) => ({ rating: r.driver, comment: r.comment ?? null, ratedAt: new Date(r.at).toISOString() })) };
  }

  if (path === '/disputes/status') {
    const tid = query.get('tripId'); const dev = query.get('deviceId');
    const t = d.trips.find((x) => x.tripId === tid); if (!t || t!.deviceId !== dev) fail(404, 'Trip not found');
    const mine = d.disputes.filter((x) => x.urgent && (x.trip as { tripId?: string } | undefined)?.tripId === tid).reverse();
    // The demo plays the union: a reply arrives a few seconds after the alert, as it would from the dashboard.
    for (const r of mine) {
      if (!r.reply && Date.now() - Number(r.at) > 7000) {
        r.reply = r.type === 'accident' ? 'GPRTU support: we have your location and are calling the driver now. Help is on the way. Stay where it is safe.' : 'GPRTU support: thank you. We have your location and are speaking to the driver about this now.';
        r.repliedAt = new Date().toISOString(); r.status = 'investigating'; await save();
      }
    }
    return { reports: mine.map((r) => ({ id: r.id, reason: r.type, status: r.status ?? 'open', reply: r.reply ?? null, repliedAt: r.repliedAt ?? null, createdAt: r.filedAt })) };
  }
  if (post && path === '/disputes') {
    const t = d.trips.find((x) => x.tripId === body.tripId); if (!t) fail(404, 'Trip not found');
    if (t!.deviceId !== body.deviceId) fail(403, 'This is not your trip');
    d.disputes.push({ id: d.disputes.length + 1, type: body.reason, description: body.description ?? null, amountAsked: body.amountAsked ?? null, urgent: body.reason === 'accident' || body.reason === 'careless_driving', at: Date.now(), reply: null, status: 'open', lat: body.lat ?? null, lng: body.lng ?? null, trip: { ...t }, events: d.events.filter((e) => e.vehicle === t!.vehicleCode).slice(-40), filedAt: new Date().toISOString() });
    await save(); return { ok: true, disputeId: d.disputes.length };
  }
  if (post && path === '/reports/unregistered') {
    d.disputes.push({ id: d.disputes.length + 1, type: 'unregistered_vehicle', code: body.code ?? null, description: body.note ?? null, filedAt: new Date().toISOString() });
    await save(); return { ok: true, reportId: d.disputes.length };
  }
  if (post && path === '/disputes/unpaid') {
    const own = authed(d, headers);
    d.disputes.push({ id: d.disputes.length + 1, type: 'unpaid_passenger', description: body.description ?? null, vehicle: own, filedAt: new Date().toISOString() });
    await save(); return { ok: true, disputeId: d.disputes.length };
  }

  return fail(404, 'Not found');
}

/** A `fetch` that answers API requests from the in-app demo server. */
export const demoFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : (input as Request).url, 'http://demo.local');
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  let body: unknown = {};
  try { body = init?.body ? JSON.parse(String(init.body)) : {}; } catch { body = {}; }
  try {
    const out = await route((init?.method ?? 'GET').toUpperCase(), url.pathname.replace(/^\/api/, ''), url.searchParams, body, headers);
    return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.message, ...e.extra }), { status: e.status, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ error: 'Demo server error' }), { status: 500 });
  }
};
