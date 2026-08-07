# Keyvantic Knowledge Operating System (KOS)

Keyvantic is an AI Business Transformation and Advisory firm that helps organisations redesign operations, accelerate growth, and become AI-enabled enterprises.

**Keyvantic KOS** is the internal operating system that holds all of that — the single source of truth for Keyvantic's strategic documents, consulting frameworks, research, methodologies, proposals, templates, SOPs, and client assets. It combines a structured Master Library, full version control and approval workflows, a relationship graph, enterprise search, and an AI assistant that only answers from approved documents.

Full design docs — architecture, database schema, API design, user flows, wireframes, component hierarchy, roadmap, security architecture, and deployment guide — live in [`/docs`](./docs).

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Tiptap |
| Backend | NestJS, PostgreSQL, Prisma ORM, Redis |
| Auth | JWT (access + refresh, httpOnly cookies), RBAC |
| Storage | S3 / Cloudflare R2-compatible client |
| Search | Meilisearch (full-text) + keyword/embedding-based semantic search |
| AI | OpenAI API with retrieval-augmented generation over APPROVED documents only |
| Infra | Docker Compose (local), GitHub Actions CI, Vercel (web) + Railway/AWS (api) |

## Monorepo layout

```
apps/
  api/            NestJS backend (REST API, Prisma schema, seed script)
  web/             Next.js frontend
packages/
  types/           Shared enums, permission matrix, and DTO-shaped types used by both apps
docs/              Architecture & design deliverables
docker-compose.yml Local infra: postgres, redis, meilisearch, api, web
```

## Quickstart (local development)

Requires Node 20+, pnpm, and Docker.

```bash
cp .env.example .env
pnpm install

# Start stateful infra only (fastest iteration — run api/web on the host)
docker compose up -d postgres redis meilisearch

pnpm run db:migrate   # apply Prisma migrations (runs as the owner role)

# One-off: create the unprivileged role the API connects as. Postgres exempts
# superusers from row-level security entirely, so connecting the API as the
# migration user would silently disable tenant isolation.
psql "$ADMIN_DATABASE_URL" -v app_password="'kos_app'" \
  -f apps/api/prisma/provision-app-role.sql

pnpm run db:seed      # seed a tenant, roles, permissions, Master Library, sample docs
pnpm run dev          # builds packages/types, then runs api (:4000) + web (:3000)
```

Then open http://localhost:3000 and sign in with any seeded account (password `Keyvantic!2026`):

| Email | Role |
|---|---|
| admin@keyvantic.com | Administrator |
| partner@keyvantic.com | Partner |
| consultant@keyvantic.com | Consultant |
| researcher@keyvantic.com | Researcher |
| designer@keyvantic.com | Designer |
| sales@keyvantic.com | Sales |
| marketing@keyvantic.com | Marketing |
| guest@keyvantic.com | Guest |

The API is browsable at http://localhost:4000/api/docs (Swagger).

To run everything (including `api`/`web`) inside containers instead: `docker compose up -d --build`.

## Common scripts

```bash
pnpm run build       # build packages/types, then api + web
pnpm run typecheck   # typecheck all workspaces
pnpm run lint        # lint api + web
pnpm run test        # run test suites
pnpm run db:studio   # Prisma Studio against the local database
```

## What's implemented

- **Master Library**: the full 01 Strategy → 09 Clients folder hierarchy, with per-client sub-trees (Company Profile, Discovery Notes, Deliverables, Reports, Meeting Notes, AI Opportunities, Transformation Roadmap) created automatically on client creation.
- **Documents**: unique `KV-<CATEGORY>-<seq>` IDs, status workflow (Draft → Internal Review → Approved → Archived), confidentiality levels, tags, dependencies/relationships, review dates, approval history, audit trail, and export to PDF / Markdown / DOCX / HTML.
- **Rich editor**: Tiptap-based editor with markdown, tables, code blocks, images, callouts, task lists, and a URL-based video/PDF embed node; auto-generated table of contents on read view.
- **Version control**: every save is a new immutable version; compare any two versions (line diff), restore old versions (as a new version, preserving history).
- **Collaboration**: threaded comments, approval workflow with reviewer decisions, in-app notifications (approvals, review due, comments, dependency changes).
- **Search**: full-text + faceted search via Meilisearch with an automatic Postgres fallback; keyword-ranked "semantic" search that upgrades to real embeddings when `OPENAI_API_KEY` is set.
- **Relationship graph**: typed, directed document relationships rendered as a clickable graph view.
- **AI assistant**: RAG-style Q&A restricted to `APPROVED` documents (respecting confidentiality and role), version comparison, and "what changed this month" — with a labeled extractive fallback when no OpenAI key is configured.
- **Vault**: encrypted file storage with a three-tier envelope (deployment master key → per-tenant key → per-file key), so no plaintext key is ever persisted and destroying a tenant's key crypto-shreds their files without touching the audit history. Uploads are versioned append-only, text-extracted (PDF, DOCX, text/markdown) so they are searchable and available to the assistant, checksum-verified on download, and audited on every read. Local disk in development, S3/R2 in deployment.
- **Multi-tenancy**: every tenant-scoped table carries `tenantId` and is protected by a Postgres Row-Level Security policy keyed on a per-request session setting, so a forgotten `where` clause returns zero rows rather than another firm's data. The API refuses to boot in production if it detects a database role that bypasses RLS.
- **Engagements**: the matter/engagement is the confidentiality boundary. Documents filed against one are visible only to its team; an `EngagementMember` row with `DENIED` is an ethical wall that overrides every role permission, including a partner's.
- **RBAC**: 8 roles with a configurable, per-action permission matrix editable from Admin → Roles & Permissions, resolved per tenant. Document visibility runs through a single predicate (`AccessService.documentWhere`) used by every read path — list, get, search, semantic search, export, and AI retrieval.
- **Branding**: light/dark theme, responsive layout, Keyvantic navy/gold visual identity.

See [`docs/07-development-roadmap.md`](./docs/07-development-roadmap.md) for what's intentionally deferred (native diagram/flowchart tooling, upload-based video hosting, embedded PDF viewer, deeper knowledge-graph analytics) and the phased plan for future modules (CRM, Project Management, Proposal Generator, AI Transformation Assessment, Client Portal, LMS, Research Publishing, Executive/Financial Dashboards, Internal AI Copilot).
