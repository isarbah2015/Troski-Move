# TrotroLink — Brief (single source of truth)

Read this before every task. TrotroLink is a **trotro payment + live tracking app for Ghana**, not a bus-booking app.

## Structure (final)

**Passenger app — exactly 3 tabs**
1. **SCAN** — camera-first QR viewfinder for the conductor's QR sticker, plus "Enter short code" (e.g. `CIR01`).
2. **TRIP** — live trip: current stop, stops away, ETA, progress bar, report button.
3. **PROFILE** — user card, trip history, ratings, MTN MoMo payment method, settings.

**Conductor app — exactly 4 tabs**
1. **TODAY** — stop buttons (tap to mark current stop), daily scan counter, bonus progress (200 scans + avg rating ≥ 4.0 = GHS 10).
2. **MY QR** — vehicle QR + short code, download/print, regenerate.
3. **LEADERBOARD** — Driver of the Day: top 5 vehicles by avg passenger rating (past 24 h, min 3 ratings).
4. **EARNINGS** — owner drop + conductor wage + fuel → driver net.

**Union web dashboard** — transactions table, disputes, ratings analytics, overcharge reports.

## Core payment flow (build first)
Scan tab → scan QR / enter short code → app resolves vehicle + route → passenger picks alighting stop → app shows official fare → rounded-up amount → pays via MTN MoMo (sandbox) → trip goes live, lands on Trip tab → conductor gets SMS confirmation.

## Design system (locked)
Dark mode default, light mode auto.

| Token | Hex |
|---|---|
| Background | `#0B1220` |
| Surface | `#121A2B` |
| Primary navy | `#0B1F3A` |
| Accent emerald | `#10B981` |
| Highlight gold | `#D4A437` |
| Text primary | `#FFFFFF` |
| Text secondary | `#94A3B8` |
| Border | `#1E293B` |
| Error | `#EF4444` |

Font Inter only (400/500/600/700). Radii: 16px cards, 24px modals, 999px pills. Icons: Feather only. Haptics on every payment, scan and rating action. One primary action per screen. Passenger pays in ≤3 taps; conductor marks a stop in 1 tap.

## Order of work (do not deviate)
1. Rename Troski-Move → TrotroLink everywhere. **(done)**
2. Wire Drizzle to Postgres — kill in-memory storage. **(done)**
3. Create tables + seed sample data. **(done)**
4. Rebuild the 3 passenger tabs (Scan → Trip → Profile).
5. Build the conductor app (4 tabs).
6. Wire MTN MoMo Sandbox.
7. 5-star rating sheet after arrival.
8. Leaderboard.
9. Union web dashboard.
10. USSD fallback (`*123#` + short code) — last.

## Ignore for now
Bookings screen, Wallet tab, Safety tab (→ Trip "Report Issue"), Routes tab (→ Scan flow), generic Home tab.
