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

## PROJECT STATUS

### Completed
- Monorepo restructure (apps/ + packages/)
- Drizzle schema + seed (Circle→Kasoa, Madina, Tema)
- Shared design tokens
- API health endpoint and `GET /api/vehicles/resolve`
- Scan tab (QR, short code, stop select, fare)
- Trip tab (active trip, empty state, report sheet)
- Profile tab (user card, stats, role switcher, trip history + detail, payment method, settings, sign out)
- Conductor route group stubs (4 tabs)

### In Progress
- Nothing (awaiting sign-off before the full conductor build)

### Not Started
- Conductor tabs, full build (Today, My QR, Leaderboard, Earnings)
- Union web dashboard (Next.js)
- MoMo integration (Pay is a stub)
- Push notifications (FCM)
- USSD fallback
- Ratings + leaderboard backend
- GTFS import from GhanaAPI
- Phone OTP auth and an `(auth)/login` screen

### Formulas (locked)
- `stopsAway = index(alightingStop) - index(currentStop)`
- `progress = stopsCovered / totalStopsOnRide`
- Tier from lifetime trips: Bronze < 10, Silver 10–49, Gold 50+

### Local storage keys (AsyncStorage)
`activeTrip`, `user`, `tripHistory` (newest first, capped at 200), `role`, `language`, `notifications`. Sign-out clears everything.

### Known Issues
- Status bar: fixed via `userInterfaceStyle: dark` (**verify on a real device before launch**)
- Light mode: deferred to v1.1
- MAD05 / TEM03 fares are placeholders (replace with real GPRTU fares when union data is available)
- Camera path untested (the simulator has no camera)
- A trip is added to history at payment time; there is no arrival step, so history ratings stay "Not rated" until the rating sheet exists
- Sign out has no `(auth)/login` to go to, so it clears local data and returns to Scan
- Language choice is saved but the UI is English only; the Privacy page is a placeholder
- "Load demo data", "Clear history" (Profile) and "Clear trip" (Trip) are `__DEV__`-only

### Deviations
- `(passenger)/index.tsx` is the Scan screen (route groups don't add URL segments)
- Trip tab uses a vertical timeline (not horizontal)
- Conductor stubs include a "Switch to Passenger" button (there is no Profile tab in the conductor group)
- "Ride again" opens the Scan short-code sheet pre-filled (it does not auto-resolve)
- API uses tsx in dev; add tsup before deploy
- `apps/web` is a placeholder
