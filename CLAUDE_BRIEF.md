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
Font Plus Jakarta Sans 400–800 (self-hosted in the union dashboard). Radii: card 20, modal 32, pill 999. Surfaces: soft shadows in light, hairline borders in dark; gradient emerald primary button. Feather icons. Haptics on every payment, scan and rating. One primary action per screen. Passenger pays in ≤ 3 taps; conductor marks a stop in 1 tap.

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

## Anti-fraud design (locked, built)

**Principle:** the server decides the price and the trip's state; neither the passenger's app nor the conductor's can change them.

- **Payment-first.** A trip exists only after a successful MoMo payment; `amount` must equal the rounded-up official fare. The passenger's Trip tab shows a live **PAID · TRX-…** badge; the conductor's Today tab lists **paid passengers on board** (stop, amount, reference). Tapping one shows the trip QR (the same as on the passenger's phone) to verify by eye. **Add unpaid passenger** files a dispute.
- **Conductor auth.** First launch: vehicle code + 4-digit PIN (scrypt-hashed). Session token (12 h, stored as a SHA-256). Five wrong PINs lock the account for 15 minutes. Stop marks, splits, a vehicle's passenger list, confirm-alight and unpaid reports need that vehicle's own conductor (401/403 otherwise). Set `CONDUCTOR_SETUP_CODE` in production (setup is refused without it).
- **Overstay (a passenger lies about their drop-off).** When the conductor marks a stop past a passenger's declared stop and their trip is still open, the server records the overstay. The passenger gets "You've passed X. Extend to Y for GHS Z more?" with **[Pay]** / **[Get off now]** and a 60-second countdown. If they do nothing the server charges the extension automatically (a MoMo request to their wallet; the trip extends when it succeeds). The conductor's Today shows "N passengers past stop"; **Confirm they're getting off here** closes the trip and charges the difference.
- **Disputes.** Report issue (Overcharge, Route deviation, Safety concern, Forced early alighting) + optional note → `POST /api/disputes`; the server attaches the trip, vehicle, conductor on duty and the stop/trip events as evidence. History shows a **Reported** tag. `GET /api/disputes` (union; needs `UNION_API_KEY` in production).
- **GPS check at alighting: not built.** It needs stop coordinates, which the seed routes do not have yet. Design when built: optional, never blocking, a data point for disputes; the conductor can override.
- **Real-world limit:** MoMo collections need the wallet owner to approve each request, so an "automatic" overstay charge is still a request the passenger approves on their phone. Truly silent charging would need a pre-authorised mandate (a later product decision).

## PROJECT STATUS

### Completed
- Monorepo + design tokens; Drizzle schema + seed; passenger (Scan, Trip, Profile) and conductor (Today, My QR, Leaderboard, Earnings, Profile) apps; rating sheet; offline queue; floating tab bar
- MTN MoMo sandbox payments with simulator fallback; backend sync verified across two simulators
- **Anti-fraud phases 1–4** (above)
- **Offline demo mode** and a release **APK** (below)

### Themes
Dark (default look) and light, switchable in **Profile → Settings → Appearance** (System / Light / Dark; saved on the device). The palettes are `colors` and `lightColors` in `packages/shared/src/design.ts`; screens read them through `useColors()`. Light text and accents are darkened for contrast (emerald `#047857`, gold `#A16207`). Fixed-colour exceptions live in `apps/mobile/lib/colors.ts`: the camera screen and the navy hero cards stay dark in both themes, scrims are always dark, and QR codes stay black on white so they scan.

### Demo mode (no server, no database)
With `EXPO_PUBLIC_API_URL` unset, the app serves the whole API from inside the phone (`apps/mobile/lib/demoServer.ts`): same rules as the real API (server-set price, payment-first trips, overstay + 60 s auto-charge, conductor PIN sessions, disputes, leaderboard). Data lives in AsyncStorage on the device; Sign out resets it. A "DEMO MODE" badge is shown on Scan and Today, and payments say "Simulator mode · no money moves" (they auto-approve after 3 s). One phone plays both roles: switch in **Profile → Role**. Two phones do NOT share data in demo mode (there is no server); use the real API for that. To use the real API instead, set `EXPO_PUBLIC_API_URL` at build/start time.

### Building the Android APK (demo)
```bash
cd apps/mobile
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk
pnpm exec expo prebuild --platform android --no-install --clean   # EXPO_PUBLIC_API_URL must be unset for demo mode
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```
`plugins/withGradleMemory.js` raises Gradle's metaspace and builds **arm64-v8a only** (modern 64-bit phones; add `armeabi-v7a` in the plugin for older 32-bit phones, needs ~2 GB more disk). The APK is signed with the debug key (fine for sideloading a demo; **use a real keystore for the Play Store**). The package is `app.trotrolink.mobile`.

### Next
- Push notifications (FCM), union web dashboard, USSD fallback, GTFS import, real accounts
- Stop coordinates + optional GPS check; per-wallet MoMo number capture; real keystore + store builds

### Critical pre-launch fixes (MUST FIX)
- Set `CONDUCTOR_SETUP_CODE`, `UNION_API_KEY`, `MTN_MOMO_WEBHOOK_SECRET`; a union-run PIN reset
- Real accounts (replace guest identity); verify the passenger's wallet number
- Live MoMo/server hosting is **GPRTU's** to run; nothing here connects to live MTN or a live server
- Strip all `__DEV__` links (verify they do not render in a release build)
- Watch for a duplicate payment after a hot reload during real-device testing (the server refuses a second live charge for the same ride)

### Known limitations (v1)
- Demo mode is single-device; earnings, scan counts and "total fares" on Today/Earnings are mock numbers
- Passenger history is local; language stored but UI English; light mode built; printed date updates on share-sheet open; QR regenerate is local; status bar to verify on a real device
- Camera scan untested in simulators (use the code chips)
- "Get off now" / GPS: see the anti-fraud notes above

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
- Language choice stored, UI English; light mode built; status bar: verify on a real device
- Printed date updates on share-sheet open; Regenerate QR is local (old QR still resolves)
- **Dev-only links must be stripped/guarded before production** (all `__DEV__`): Load demo data, Clear history (Profile); Clear trip, Advance one stop (Trip); leaderboard real/empty toggle; Load demo week (Earnings). "Advance one stop" now sends a real stop mark through the API.
- Camera scan path untested (simulators have no camera)

### Deviations
- `(passenger)/index.tsx` is Scan; `conductor-profile.tsx` (not `profile.tsx`)
- #1 leaderboard uses the `award` icon; #3 uses muted gold
- Vertical timeline in Trip; trip added at payment, stamped at arrival; rating fallback is a card
- Added `POST /api/trips/alight` and `POST /api/guests` (not in the sync brief); `trip_events.vehicle_id` references the vehicle by id rather than storing the code, and `trip_id` is an integer FK to `transactions` (the public reference is `transactions.trip_ref`)
- API uses tsx in dev; `apps/web` placeholder

## Added after the "Missing" list (built)
- **Custom drop-off**: passenger can pick "Somewhere else" in the stop sheet and type a note (`customStopNote`). Fare is that of the nearest anchor; the note is stored on the payment, trip and transaction, and feeds the union's stop suggestions.
- **GPS check at alighting**: `alightCheck` (`packages/shared/src/geo.ts`), 200 m radius. Optional and never blocking; result stored as `alightDistanceM` / `alightGps` and shown in union transactions.
- **ETA by position**: `interpolatedEta` uses GPS along the leg, else time since the last stop mark, capped at 90 %. Stop lat/lng are approximate.
- **Languages**: English, Twi, Ewe, German, Russian, Dutch, Chinese (`apps/mobile/lib/i18n.ts`, `useT()`). All non-English wording is a first pass for native-speaker review; conductor screens stay English.
- **Currency**: `₵` everywhere. Visitors can view approximate USD/EUR/GBP/NGN (`packages/shared/src/currency.ts`); rates are fixed rough figures, replace with a live source. "Visiting Ghana?" guide is general advice to verify.
- **Notifications**: local notifications (`lib/notify.ts`) work while the app is alive. Server push (`services/push.ts`, Expo push API) needs FCM credentials and `EXPO_PUBLIC_EAS_PROJECT_ID` from GPRTU.
- **USSD**: `POST /api/ussd` (form-encoded, Africa's Talking style). Flow: vehicle code, stop number, confirm, MoMo prompt. Text says "GHS" (GSM 7-bit has no ₵).
- **Union dashboard**: static page at `/union` (`apps/api/public/union.html`) over `/api/union/*`: overview, transactions, disputes (status), ratings, stop suggestions, conductors with PIN reset, USSD tester. Deviation from the original plan (Next.js) because of disk space. Protected by `x-union-key` = `UNION_API_KEY`; open only outside production when unset.
- **Conductor PIN reset**: union clears the PIN and sessions; the conductor sets a new one via "First time? Set up your PIN".

### Env vars added
`UNION_API_KEY`, `CONDUCTOR_SETUP_CODE`, `MTN_MOMO_WEBHOOK_SECRET`, `PUSH_ENABLED`, `EXPO_PUBLIC_EAS_PROJECT_ID`.

### Known limits
Today/Earnings numbers, scan counts and average rating in the conductor app are still mock. Demo mode is single-phone. Tema and Madina routes/fares are placeholders. Live MoMo and closed-app push are GPRTU's to configure.


## GPRTU features (union operations)
- **GPRTU Verified**: `GET /vehicles/resolve` returns `vehicle.verified` and `vehicle.suspended`. Scan shows a "GPRTU Verified" badge; a suspended vehicle shows a block and cannot be paid (`/payments/initiate` and USSD refuse it). Unknown codes offer **Report unregistered** (`POST /reports/unregistered`, also reachable from Scan), listed under Registration on the dashboard.
- **Compliance** (`/union/compliance`, `services/compliance.ts` holds the rules): flags vehicles whose reported asked-fare is over the official fare by more than 5% (from overcharge reports that carry `amountAsked`), driver rating below 3.0 (3+ ratings), overcharge reports, and repeat offenders (2 warnings in 90 days = suspension recommended). Actions: **Issue warning** (SMS via `services/sms.ts`, simulator without Hubtel credentials), **Suspend** (days + reason), **Reinstate**.
- **Fare tables** (`/union/fares`, `services/fares.ts`): seeded fares are the base. A table has a name, an effective time and either a % change or a pasted `route,stop,fare` list. From its effective time every quoted and accepted price comes from it (`vehicleWithRoute` overlays it), so the old fare stops working at once. Publishing can SMS every driver and push every conductor. Passengers see "New GPRTU fares from …" for 14 days.
- **Terminals** (`/union/terminals`): each trip books `TERMINAL_FEE_GHS` (default 0.10) to its route's origin terminal at the rate in force; not charged to passengers.
- **Statements** (`/union/statements`): monthly trips/fares/rating per vehicle, only with the owner's recorded consent (`vehicles.credit_consent`), only from fares collected through TrotroLink. Eligibility thresholds (6 months, 15 active days) are placeholders for the lender to set. CSV download and print from the dashboard.
- Migration: `pnpm --filter api db:push` adds the new columns and tables (`warnings`, `fare_tables`, `unregistered_reports`, vehicle status/phone/consent, `transactions.terminal_fee`, `disputes.amount_asked`). Re-run `db:seed` to put placeholder driver phone numbers on seeded vehicles.
- Not built: bank partnerships and referral fees, real driver phone numbers (placeholders only), FCM credentials.

## Direction and route changes
- A vehicle has a `direction` (`outbound` or `inbound`) and a route. `inbound` is the return leg: `lib.ts` `applyDirection` reverses the stops, recomputes each fare from the new origin (route total minus the old fare, so fares stay symmetric), keeps each leg's time, and flips the route name and ends. Everything that reads a vehicle's route (`vehicleWithRoute`, `/vehicles/resolve`, active trips) goes through it, so scans, prices, stop marking and USSD all follow the direction.
- Conductor (Today tab): **Turn round** (`POST /conductor/direction`) and **Change route** (`GET /conductor/route`, `POST /conductor/route`). Both are refused with 409 while paid passengers are on board, so no trip changes under a passenger.
- Every change is logged in `route_changes` and listed on the union dashboard (Registration tab); more than two route switches in a day is flagged "Unusual".
- The offline demo mirrors all of this (`lib/demoServer.ts`).

## Short hops and boarding mid-route
- **Boarding anywhere:** passengers choose "Getting on at" in the stop sheet (default: where the trotro is now, from the conductor's last stop mark; `GET /vehicles/resolve` returns `currentStop`). Only later stops are offered, priced from the boarding stop. The trip starts at that stop (`buildTrip`), and the ETA route line and stop list begin there. The API already accepted any `boardingStop`.
- **Stop-to-stop fares:** a fare table can carry `pairs` (`{ routeId: { "From|To": fare } }`). A pair wins over the usual difference of two stop fares (`tripFare` in `packages/shared/src/fare.ts`, used by `checkTrip` and the app). Paste lines as `route,From>To,fare` in Fare tables, next to the usual `route,stop,fare`. A percentage change scales pairs too.
- **Rounding step:** each fare table sets what passengers' prices round up to (`roundingStep`: 1, 0.5, 0.1 or 0.05). Whole cedis (1) is the original rule and the default; 0.1 charges exact fares on short hops (a 50 pesewa hop costs ₵0.50, not ₵1). `amountDue` reads the step of the table in force; the app uses `roundingStep` from resolve. The newest published table wins when two share an effective time.
- Overstay extensions still use the usual stop-fare difference, not pairs.
