# TrotroLink

Trotro payment + live tracking for Ghana: passengers scan the conductor's QR sticker, pay the official stage fare via MTN MoMo, and follow their trip live. Full product spec: [CLAUDE_BRIEF.md](./CLAUDE_BRIEF.md) — read it before every task.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — seed the Circle → Kasoa route and vehicles CIR01–CIR03 (idempotent)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM · Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) · Build: esbuild (CJS bundle)
- Clients: `artifacts/trotrolink` (web/union dashboard), `artifacts/trotrolink-mobile` (Expo passenger + conductor)

## Where things live

- DB schema (source of truth): `lib/db/src/schema/` · seed: `lib/db/src/seed.ts`
- API contract: `lib/api-spec/openapi.yaml` (still describes the pre-TrotroLink commuter API; to be rewritten)

## Architecture decisions

- All state lives in Postgres via Drizzle; there is no in-memory storage.
- Routes store stops as JSON (`stops_json`): `{ name, fare, etaMinutes }`, fare cumulative from origin in GHS, `etaMinutes` the leg time from the previous stop.
- Web and mobile share one API contract and one data model.

## Gotchas

- Mobile/web UI is still the old 5-tab commuter shell until steps 4–5 of the brief.
