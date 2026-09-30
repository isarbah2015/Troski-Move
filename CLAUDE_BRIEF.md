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

**Conductor — exactly 4 tabs:** TODAY (stop buttons, daily scan counter, bonus progress: 200 scans + avg ≥ 4.0 = GHS 10) · MY QR (QR + short code, download/print, regenerate) · LEADERBOARD (Driver of the Day: top 5 vehicles by avg rating, past 24 h, min 3 ratings) · EARNINGS (owner drop + conductor wage + fuel → driver net).

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

## PROJECT STATUS

### Completed
- Monorepo restructure (apps/ + packages/)
- Drizzle schema + seed (Circle→Kasoa, Madina, Tema)
- Shared design tokens
- API health endpoint and `GET /api/vehicles/resolve`
- Passenger: Scan, Trip, Profile
- Conductor: Today (earnings, bonus, stop marking), My QR (display, download, print, regenerate)
- Conductor Leaderboard and Earnings: stubs

### In Progress
- Nothing (awaiting sign-off on Today + My QR)

### Not Started
- Conductor Leaderboard tab (full)
- Conductor Earnings tab (full)
- Conductor Profile tab (with role switcher; move "Switch to Passenger" there)
- Union web dashboard (Next.js)
- MoMo integration (Pay is a stub)
- Push notifications (FCM)
- USSD fallback
- Ratings + leaderboard backend
- Arrival + rating sheet
- Phone OTP auth and an `(auth)/login` screen

### Locked formulas
- `stopsAway = index(alightingStop) - index(currentStop)`
- `progress = stopsCovered / totalStopsOnRide`
- Bonus unlock: 200+ scans AND avg rating ≥ 4.0 (GHS 10)

### Tier cutoffs (locked)
- Bronze: 0–19 trips
- Silver: 20–99 trips
- Gold: 100–499 trips
- Platinum: 500+ trips

### QR sticker payload
JSON `{ vehicleId, shortCode, routeId, version }` (see `packages/shared/src/qr.ts`). `parseScannedCode` also accepts `trotrolink://v/<qr id>`, a raw QR id, or a short code. Resolution is by short code, so an old version keeps working until the server retires it (TODO: `POST /api/vehicles/:id/regenerate-qr`).

### Local storage keys (AsyncStorage)
`activeTrip`, `user`, `tripHistory`, `role`, `language`, `notifications`, `conductorVehicle` (defaults to CIR01), `conductorQr` (`{ version, printedAt }`). Sign-out clears everything.

### Known limitations (v1)
- No real auth (guest state); the conductor is hard-wired to CIR01
- Ratings show "Not rated" until arrival + rating sheet ship
- Language choice stored but the UI stays English (real i18n later)
- Light mode deferred to v1.1
- Status bar: verify on a real device before launch
- Conductor earnings, scans, rating, riders and on-board counts are mock data; the stop marker is local only (TODO: `POST /api/trips/stop`)
- Dev-only links (Load demo data / Clear history / Clear trip) are `__DEV__`-guarded; confirm they do not render in a production build before launch
- Download uses the OS share sheet (Save Image); the last-printed date updates when the sheet or print dialog opens, not when the user confirms saving or printing
- MAD05 / TEM03 fares are placeholders (replace with real GPRTU fares)
- Camera path untested (the simulator has no camera)

### Deviations
- `(passenger)/index.tsx` is Scan
- Vertical timeline in Trip
- The My QR short code uses Inter (the locked font) instead of a monospace face, and sits inside the white sticker so the exported PNG is self-contained
- API uses tsx in dev
- `apps/web` placeholder
