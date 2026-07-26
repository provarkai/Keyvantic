# Deployment Guide

## 1. Local Development (Docker Compose)

The actual `docker-compose.yml` at the repo root defines four services: `postgres` (16-alpine), `redis` (7-alpine), `meilisearch` (v1.10), `api`, and `web` — `api` and `web` build from `apps/api/Dockerfile` / `apps/web/Dockerfile` with the repo root as build context (so they can pull in the `packages/types` workspace package), and all services share a single root `.env` (copied from `.env.example`).

**Typical local workflow** (matches the root `package.json` scripts):

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis meilisearch   # infra only; api/web run on the host for fast iteration
pnpm run db:migrate      # prisma migrate dev (apps/api)
pnpm run db:seed         # seeds roles, permission matrix, full Master Library tree, sample docs
pnpm run dev             # builds @keyvantic/types, then runs api (:4000) + web (:3000) in parallel
```

`api` and `web` can also run fully containerized via `docker compose up -d` (all five services) for an environment closer to production.

## 2. Environment Variables

### Root `.env` (shared by `docker-compose.yml`; see `.env.example` for the authoritative list)

```bash
# Database
DATABASE_URL=postgresql://kos:kos@localhost:5432/keyvantic_kos?schema=public

# Redis (sessions, rate limiting, job queues)
REDIS_URL=redis://localhost:6379

# Meilisearch
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=dev_meili_master_key_change_me

# Auth (JWT, access + refresh, httpOnly cookies)
JWT_ACCESS_SECRET=dev_access_secret_change_me
JWT_REFRESH_SECRET=dev_refresh_secret_change_me
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Object storage (S3 / Cloudflare R2 compatible)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=auto
STORAGE_BUCKET=keyvantic-kos-dev
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_URL=http://localhost:9000/keyvantic-kos-dev

# AI Assistant (OpenAI) — optional in dev; unset falls back to extractive answers
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# API service
API_PORT=4000
API_CORS_ORIGIN=http://localhost:3000
COOKIE_DOMAIN=localhost

# Web app
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_NAME=Keyvantic KOS
```

Secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`, `STORAGE_SECRET_ACCESS_KEY`) must never be committed; `.env` is gitignored and only `.env.example` (placeholder values) is tracked. Production values are injected via the hosting platform's secret store (see §4).

## 3. Database Migrations & Seeding

- Schema changes go through Prisma migrations: `pnpm --filter api exec prisma migrate dev --name <change>` locally, `prisma migrate deploy` in CI/production (never `migrate dev` against production).
- Seed script (`apps/api/prisma/seed.ts`) creates: all 8 roles with the default permission matrix (§ see `08-security-architecture.md`), the full 01–09 Master Library folder tree, one demo user per role (password `Keyvantic!2026`), a handful of sample documents wired into the Brand Strategy → Consulting Methodology → KEYSHIFT Framework → Proposal Template → Client Deliverable relationship chain, and one sample client (Acme Federal Logistics) with its full client sub-tree.

## 4. Production Deployment

### Web → Vercel

- `apps/web` deploys to Vercel as a standard Next.js App Router project (Vercel auto-detects the framework; monorepo support via Vercel's "Root Directory" = `apps/web` and its build treating `packages/types` as a workspace dependency).
- Environment variables (`NEXT_PUBLIC_API_URL`, etc.) set per-environment (Preview/Production) in the Vercel dashboard or via `vercel env`.
- Preview deployments are created automatically per pull request, giving reviewers a live environment pointed at a staging API.

### API → Railway (primary) or AWS ECS/Fargate (alternative)

**Railway**:
- `apps/api` deploys as a Railway service built from its Dockerfile (or Railway's Nixpacks build if a Dockerfile isn't preferred), with Railway-managed PostgreSQL and Redis add-ons (or externally managed equivalents if stricter compliance requirements apply).
- Environment variables set via Railway's project variables UI/CLI; `DATABASE_URL`/`REDIS_URL` auto-injected by Railway's plugin linking when using its managed Postgres/Redis.
- Railway's built-in health checks hit a `/health` endpoint exposed by the API for zero-downtime deploys.

**AWS ECS/Fargate (alternative/scale-out path)**:
- `apps/api` container image built and pushed to ECR by CI.
- ECS Fargate service behind an Application Load Balancer, task definition injecting environment variables from AWS Secrets Manager / SSM Parameter Store.
- RDS for PostgreSQL (managed, automated backups/PITR), ElastiCache for Redis.
- Meilisearch either self-hosted as its own Fargate task + EFS/EBS-backed volume for its index data, or Meilisearch Cloud (see below) to avoid managing persistent storage for search.
- Auto Scaling on the Fargate service based on CPU/memory or request count.

### Database

- Managed PostgreSQL (Railway Postgres, AWS RDS, or equivalent) with automated backups and point-in-time recovery enabled from day one.

### Search — Meilisearch Cloud or Self-Hosted

- **Meilisearch Cloud**: simplest path — managed instance, `MEILI_HOST`/`MEILI_MASTER_KEY` point at the cloud endpoint, no infrastructure to operate.
- **Self-hosted container** (Railway service or Fargate task): requires persistent volume for the index directory; a scheduled or event-triggered reindex job (`meilisearch.service.ts` full reindex) should be runnable on demand since Meilisearch is a derived index, not the source of truth (per `01-system-architecture.md` §6).

### Object Storage

- S3 (AWS) or R2 (Cloudflare) bucket, accessed via the S3-compatible client already used locally; production bucket should have versioning enabled and a lifecycle policy for old export artifacts if desired.

## 5. GitHub Actions CI/CD Pipeline

```mermaid
flowchart LR
    A[Push / PR] --> B[Lint\neslint + prettier check]
    B --> C[Typecheck\ntsc --noEmit across workspaces]
    C --> D[Unit + Integration Tests\njest/vitest, api against ephemeral Postgres]
    D --> E[Build\npnpm --filter api build\npnpm --filter web build]
    E --> F{Branch = main?}
    F -- "No (PR)" --> G[Stop — Vercel Preview\nauto-deploys separately]
    F -- "Yes" --> H[Run DB Migrations\nprisma migrate deploy against production DB]
    H --> I[Deploy API\nRailway/ECS release]
    I --> J[Deploy Web\nVercel production promote]
    J --> K[Post-deploy smoke test\nhit /health + a known-good endpoint]
```

**Stage detail**:

1. **Lint** — `pnpm -r lint` (ESLint + Prettier check) across `apps/web`, `apps/api`, `packages/types`.
2. **Typecheck** — `pnpm -r typecheck` (`tsc --noEmit`), catching contract mismatches against `packages/types` before they ship.
3. **Test** — `pnpm -r test`; the API test job spins up an ephemeral Postgres (GitHub Actions service container) and runs Prisma migrations against it before executing integration tests.
4. **Build** — `pnpm --filter api build` and `pnpm --filter web build`; confirms both apps compile production bundles successfully (Vercel will also build independently for its own deploy, but this stage catches failures earlier and gates the API build).
5. **Migrate** — on merge to `main`, `prisma migrate deploy` runs against the production database as a discrete, logged step before the new API version is released (never run automatically on every PR).
6. **Deploy** — API release triggered via Railway's GitHub integration or an explicit `railway up`/ECS `update-service` CLI call in the workflow; Web deploy is handled by Vercel's own GitHub integration (auto-deploys on push to `main`), with the Actions workflow optionally gating/confirming via the Vercel CLI if stricter ordering (migrate-then-deploy-web) is required.
7. **Post-deploy smoke test** — a lightweight job hits the deployed API's `/health` endpoint and a representative read endpoint to catch a broken deploy immediately.

**Branch protection**: `main` requires the Lint/Typecheck/Test/Build jobs to pass before merge; migrations and deploys only run on `main` after merge, never on arbitrary feature branches.

## 6. Health & Observability in Production

- `GET /health` on the API checks DB connectivity, Redis connectivity, and Meilisearch reachability, returning a composite status used by Railway/ALB health checks and the CI smoke test.
- Structured JSON logging from the API (request id, user id where authenticated, latency) shippable to any log aggregator the hosting platform integrates with.
- The `AuditLog` table (see `02-database-schema.md`, `08-security-architecture.md`) remains the durable business-event record independent of infrastructure logs.
