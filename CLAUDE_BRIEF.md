# TrotroLink — Project Structure & Environment Brief (single source of truth)

**Rule:** before starting any task, read this file. If a task conflicts with it, flag the conflict before coding.

TrotroLink is a **trotro payment + live tracking app for Ghana** (not a bus-booking app).

## 1. We are not using Replit
No Replit artifacts, proxy (`/api` same-origin trick), monorepo conventions, `EXPO_PUBLIC_DOMAIN` pointing at Replit, or Replit AI Integrations proxy. Standard local development + GitHub + our own infrastructure.

## 2. Stack (locked)
| Layer | Choice | Notes |
|---|---|---|
| Package manager | pnpm | workspaces, monorepo |
| Backend | Node.js 20 LTS + Express 5 + TypeScript | |
| ORM | Drizzle ORM | |
| Database | PostgreSQL 16 | local via Docker; prod on Neon or Supabase |
| Mobile | React Native + Expo (TypeScript) | Expo Router, file-based |
| Web (Union dashboard) | Next.js (TypeScript) | App Router |
| Auth | Phone OTP | SMS via Hubtel or Africa's Talking |
| Payments | MTN MoMo API (sandbox for dev) | server-side only |
| Push | Firebase Cloud Messaging | |
| Maps | Mapbox | Directions + Static Images |
| GTFS | GhanaAPI (free) + Trufi Accra GTFS | |
| Local cache (mobile) | SQLite (expo-sqlite) | offline-first |
| Local state | AsyncStorage / MMKV | |
| Haptics | expo-haptics | |
| Icons | Feather | no other icon sets |

## 3. Monorepo layout (final)
```
trotrolink/
├── package.json, pnpm-workspace.yaml, .env.example, README.md, CLAUDE_BRIEF.md
├── apps/
│   ├── api/      Express 5 + Drizzle: src/{index.ts, routes/, db/{schema,seed,index}.ts, services/, middleware/}
│   ├── mobile/   Expo Router: app/{(auth),(passenger),(conductor)}/, components/, lib/
│   └── web/      Next.js union dashboard ONLY
├── packages/
│   ├── shared/      types, Zod schemas, constants, design tokens
│   ├── api-client/  typed fetch client for mobile + web
│   └── config/      shared tsconfig (eslint/prettier later)
└── infra/        docker-compose.yml (Postgres 16 + pgAdmin), sql/init.sql
```
Planned API routes: auth, vehicles, payments, trips, ratings, leaderboard, splits, disputes. Planned services: momo, ussd, eta, rating, gtfs.

## 4. Why this layout
- Single source of truth for types → `packages/shared`; the API contract is Zod schemas consumed by api, mobile and web.
- Mobile serves two roles: `(passenger)` and `(conductor)` route groups, switched in Profile. **No separate conductor app in v1.**
- Web serves only the union. Backend is one Express API for all three.
- Local DB via Docker Compose. No Replit, no Vercel-only, no serverless-first.

## 5. Cross-platform
Passenger (Android + iOS): Expo. Conductor (Android only): same Expo app, `(conductor)` group. Union: Next.js on laptops. Backend: Express 5.

## 6. Environment files
Root `.env` (see `.env.example`): DB, JWT, MTN MoMo, Hubtel, Africa's Talking (USSD), Mapbox, Firebase, GTFS URL, `API_URL=http://localhost:4000`.
`apps/api` reads the root `.env`; `apps/mobile/.env` holds only `EXPO_PUBLIC_API_URL`; `apps/web/.env` holds only `NEXT_PUBLIC_API_URL`.

## 7. Local dev workflow
```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @trotrolink/api db:push
pnpm --filter @trotrolink/api db:seed
pnpm dev   # api :4000, web :3000, mobile via Expo Go
```

## 8. Deployment (later, plan now)
Database: Neon or Supabase. API: Fly.io or Railway. Web: Vercel. Mobile: Expo EAS → Play Store + App Store. Push: Firebase. Maps: Mapbox (free tier 200K req/month).

## 9. Product spec
**Passenger — exactly 3 tabs:** SCAN (camera-first QR viewfinder + "Enter short code", e.g. CIR01) · TRIP (current stop, stops away, ETA, progress bar, report button) · PROFILE (user card, trip history, ratings, MTN MoMo method, settings).

**Conductor tabs (locked): Today · My QR · Leaderboard · Earnings · Profile** (Profile holds the role switcher; file `(conductor)/conductor-profile.tsx` to avoid a `/profile` route collision): TODAY (stop buttons, daily scan counter, bonus progress: 200 scans + avg ≥ 4.0 = GHS 10) · MY QR (QR + short code, download/print, regenerate) · LEADERBOARD (Driver of the Day: top 5 vehicles by avg rating, past 24 h, min 3 ratings) · EARNINGS (owner drop + conductor wage + fuel → driver net).

**Union web dashboard:** transactions table, disputes, ratings analytics, overcharge reports.

**Core payment flow (build first):** Scan → scan QR / short code → resolve vehicle + route → pick alighting stop → official fare → rounded-up amount → pay via MTN MoMo (sandbox) → trip goes live, land on Trip tab → conductor gets SMS confirmation.

**Order of work:** 1 rename ✅ · 2 Drizzle/Postgres ✅ · 3 tables + seed ✅ · 4 passenger tabs (Scan → Trip → Profile) · 5 conductor tabs · 6 MoMo sandbox · 7 rating sheet · 8 leaderboard · 9 union dashboard · 10 USSD (`*123#` + short code) last.

**Ignore:** old Bookings/Wallet/Safety/Routes/Home screens, the "Troski-Move" branding, anything Replit, "mockup-sandbox".

## 10. Design tokens (locked) — `packages/shared/src/design.ts`
Dark default, light auto. Background `#0B1220` · Surface `#121A2B` · Primary navy `#0B1F3A` · Accent emerald `#10B981` · Highlight gold `#D4A437` · Text `#FFFFFF` / secondary `#94A3B8` · Border `#1E293B` · Error `#EF4444`.
Font Inter 400/500/600/700 only. Radii: card 16, modal 24, pill 999. Feather icons. Haptics on every payment, scan and rating. One primary action per screen. Passenger pays in ≤ 3 taps; conductor marks a stop in 1 tap.

## 11. First task (scaffold only — no product features)
Monorepo scaffold per §3 · `pnpm-workspace.yaml` (`apps/*`, `packages/*`) · `packages/shared` with design tokens · `packages/config` base tsconfig · `apps/api` skeleton (Express 5 + Drizzle + health) · `infra/docker-compose.yml` · this brief.

## Stops are anchors, not stations

Real trotros don't stop at fixed stations: passengers hail and alight anywhere. Do **not** try to pre-load every possible stop.

1. **Anchors.** Pre-load named landmarks as fare anchors (from GTFS + GhanaAPI). Example Circle–Madina corridor: Circle, Kanda, GBC, Sankara, Flagstaff, 37, DVLA, Opeibea, Airport, Shangrila, Spanner, Shiashie, Okponglo, Legon, UPS, PRESEC, Madina Zongo Junction, Madina.
2. **Passenger picks the nearest anchor** to where they are actually going.
3. **Conductor marks anchors as passed** to update ETAs. They can skip anchors: they just tap the one they are at.
4. **Custom alighting** for stops between anchors: the passenger types a short note (e.g. "near Melcom"); the fare uses the nearest anchor behind it; the trip record is flagged so the stop can be suggested as a future anchor.

**Import rules.** Import landmark stops only (no vendor stalls or unmarked crossings). 18 anchors on a route is plenty. Between anchors, ETA is interpolated by distance.

**Do not:** require passengers to pick from a 50-item dropdown; force the conductor to tap every anchor; build a "complete stop database" for Ghana; or block payment when the passenger's stop is not in the anchor list.

**Status:** the anchor model is documented here; the Scan flow does not yet offer the custom-alighting option (only the seeded anchors), and ETA interpolation by distance is not built. Both are still to do.

## Anti-fraud design (proposed, awaiting sign-off)

**Principle:** the server decides the price and the trip's state; neither the passenger's app nor the conductor's can change them.

| Threat | Already in place | Proposed next |
|---|---|---|
| Passenger rides without paying or underpays | A trip only exists after a **successful MoMo payment**; the server sets the price (`amount` must equal the rounded-up official fare) | Conductor's Today shows **paid passengers on board, with each one's stop**, so a headcount mismatch is visible. A live "PAID" badge on the passenger's Trip tab (animated, shows vehicle + time) so a screenshot is not proof. Optional: conductor scans the passenger's **trip QR** (already in trip detail) to verify |
| Conductor overcharges or pockets cash | Fare is fixed server-side and shown to the passenger before paying; payment goes to the platform wallet, never to the conductor | **Report issue → Overcharge** writes a `disputes` row (today it only toasts). Conductor wage comes from the day's split, not from cash |
| **Passenger lies about the drop-off** (pays for Odorkor, rides to Kasoa) | The conductor's stop marks tell the server where the vehicle is; each trip stores the declared stop | **Overstay detection:** when the vehicle is marked at a stop past a passenger's declared stop and their trip is still active, flag it. The passenger gets a **"Extend your trip — pay GHS X more"** MoMo prompt; the conductor's Today lists "alighting here" and "past their stop" passengers. Optional later: GPS check at *Confirm alighting* |
| Passenger pays for far but gets off early | Fare is for the declared stop; no refund | None (not a theft risk) |
| Fake stop marks / stolen identities | Stop marks are logged | **Conductor auth** (MUST FIX before launch), then a vehicle can only be marked by its own conductor |

## PROJECT STATUS

### Completed
- Monorepo + design tokens; Drizzle schema + seed; passenger and conductor apps; shared components
- Rating sheet, backend sync (trips, stops, ratings, splits, offline queue), cross-device sync verified
- Floating card tab bar (inset sliding pill; adapts to the 5-tab conductor bar)
- **MTN MoMo sandbox payments** (see below), with a simulator fallback

### In Progress
- Nothing (awaiting sign-off on MoMo, then the anti-fraud design above)

### Next
- Anti-fraud work (overstay detection and extend-trip payment, disputes, conductor auth) — see the proposed design above
- Push notifications (FCM), union web dashboard, USSD fallback, GTFS import, real accounts

### MoMo payments
- `POST /api/payments/initiate` (validates stops; **the server sets the price: `amount` must equal the rounded-up official fare**; refuses a second live charge for the same passenger, vehicle and stop; idempotent on `tripId`), `GET /api/payments/status/:referenceId` (asks MTN, and on the first SUCCESSFUL answer creates `transactions` + `active_trips` + the `boarded` event exactly once; polling again is harmless), `POST /api/payments/webhook`.
- **The trip exists only after a successful payment.** `POST /api/trips/start` (the unpaid shortcut) is now dev-only and returns 404 in production.
- **Webhook security:** MTN does not sign callbacks, so (1) the callback URL carries a secret `?token=` (`MTN_MOMO_WEBHOOK_SECRET`), checked in constant time, and (2) the body is only a nudge: the outcome is re-fetched from MTN by reference id, so a forged callback cannot mark anything paid. (Deviation from "verify signature".)
- **Simulator mode** (no `MTN_MOMO_API_KEY`): logged as `MOMO_SIMULATOR_MODE`; a payment auto-approves 3 s after creation (`MOMO_SIMULATOR_APPROVE_MS` changes the delay for testing); the app shows a "Simulator mode · no money moves" tag. Pending requests older than 10 minutes are closed as expired.
- **Sandbox vs live:** sandbox charges MTN's test payer (`MTN_MOMO_SANDBOX_PAYER`, currency **EUR**: MTN's sandbox accepts nothing else); live (`MTN_MOMO_TARGET_ENV` other than `sandbox`) uses GHS and needs the passenger's own MoMo number (the app sends the signed-in user's number; guests have none until accounts exist).
- Mobile: Pay → "Sending request…" → "Check your phone for the MoMo prompt and enter your PIN" (polls every 3 s) → success toast and the Trip tab; a 60 s timeout or a decline shows "Try again". Try again re-checks the previous attempt first so a late approval is used, not charged twice. Each attempt uses a fresh trip reference.
- **Verified:** simulator mode in the app (pending, timed-out and success screens; `payments`, `transactions`, `active_trips` populated; one trip per payment). The real MTN client was exercised against a local fake MTN server (token, request-to-pay, polling, decline reason, webhook token check) but **not against MTN's real sandbox: there are no credentials yet**. Needs: `MTN_MOMO_SUBSCRIPTION_KEY`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`, and a public callback URL.

### Critical pre-launch fixes (MUST FIX)
- **Conductor auth:** anyone can post a stop mark (TODO in `routes/trips.ts`)
- Real accounts (replace guest identity); strip all `__DEV__` links
- Live MoMo needs the passenger's wallet number captured and verified

### Locked formulas
- `stopsAway = index(alightingStop) - index(currentStop)`
- `progress = stopsCovered / totalStopsOnRide`
- Bonus unlock: 200+ scans AND avg rating ≥ 4.0 (GHS 10)
- Net earnings = total fares − (owner drop + conductor wage + fuel cost)

### Tier cutoffs
- Bronze: 0–19 · Silver: 20–99 · Gold: 100–499 · Platinum: 500+

### Rating flow
Trip tab shows **Confirm alighting** once the vehicle's current stop (set by the conductor) equals the passenger's stop → the rating sheet (driver + conductor stars both required, comment optional) → Submit saves `tripRatings`, queues `POST /api/ratings`, ends the trip. Skip leaves a **Rate trip** chip in history and a 24-hour card on the Trip tab.

### Local storage keys (AsyncStorage)
`activeTrip`, `user`, `tripHistory`, `tripRatings`, `dailySplits`, `role`, `language`, `notifications`, `conductorVehicle`, `conductorQr`, `deviceId`, `offlineQueue`. Sign-out clears everything.

### Known limitations (v1)
- No real auth (guest identities); the conductor is hard-wired to CIR01 and anyone can post a stop mark for a vehicle (needs conductor auth before launch)
- Passenger Trip only updates while the Trip tab is focused; no push yet
- Conductor earnings, scan count, rating and "total fares" on Today/Earnings are still mock numbers (the passenger count is live)
- The leaderboard shows tagged sample data until a vehicle has ≥ 3 ratings in the last 24 h (non-production only)
- Language choice stored, UI English; light mode deferred; status bar: verify on a real device
- Printed date updates on share-sheet open; Regenerate QR is local (old QR still resolves)
- **Dev-only links must be stripped/guarded before production** (all `__DEV__`): Load demo data, Clear history (Profile); Clear trip, Advance one stop (Trip); leaderboard real/empty toggle; Load demo week (Earnings). "Advance one stop" now sends a real stop mark through the API.
- Camera scan path untested (simulators have no camera)

### Deviations
- `(passenger)/index.tsx` is Scan; `conductor-profile.tsx` (not `profile.tsx`)
- #1 leaderboard uses the `award` icon; #3 uses muted gold
- Vertical timeline in Trip; trip added at payment, stamped at arrival; rating fallback is a card
- Added `POST /api/trips/alight` and `POST /api/guests` (not in the sync brief); `trip_events.vehicle_id` references the vehicle by id rather than storing the code, and `trip_id` is an integer FK to `transactions` (the public reference is `transactions.trip_ref`)
- API uses tsx in dev; `apps/web` placeholder
