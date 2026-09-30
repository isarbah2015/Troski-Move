-- Runs once on first container start. Tables are managed by Drizzle (pnpm --filter @trotrolink/api db:push).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
