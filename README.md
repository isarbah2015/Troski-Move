# TrotroLink

Trotro payment + live tracking for Ghana. Passengers scan the conductor's QR sticker and pay the official stage fare via MTN MoMo; conductors run their day from the same Expo app; the union gets a web dashboard.

Read [CLAUDE_BRIEF.md](./CLAUDE_BRIEF.md) for structure, stack, product spec and design tokens.

## Layout
`apps/api` (Express 5 + Drizzle) · `apps/mobile` (Expo) · `apps/web` (Next.js, union) · `packages/{shared,api-client,config}` · `infra` (Docker Postgres 16 + pgAdmin)

## Quick start
```bash
cp .env.example .env
pnpm install
pnpm db:up                                   # Postgres :5432, pgAdmin :5050
pnpm --filter @trotrolink/api db:push        # create tables
pnpm --filter @trotrolink/api db:seed        # Circle → Kasoa + CIR01–CIR03
pnpm --filter @trotrolink/api dev            # http://localhost:4000/api/healthz
```
Requires Node 20+ and pnpm. Mobile: `pnpm --filter @trotrolink/mobile dev`.
