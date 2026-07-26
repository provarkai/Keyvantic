# System Architecture

## 1. Overview

Keyvantic KOS is a multi-service web application built as a pnpm workspaces monorepo. It separates concerns into a Next.js web client, a NestJS API service, and a set of managed/self-hosted infrastructure services (PostgreSQL, Redis, Meilisearch, S3/R2-compatible object storage, and the OpenAI API). Authentication is JWT-based (access + refresh tokens, httpOnly cookies) with a design compatible with Auth.js/Clerk session semantics, so it can be swapped for either without changing application code.

```mermaid
graph TB
    subgraph Client
        Browser["Browser (Desktop / Tablet / Mobile)"]
    end

    subgraph Vercel["Vercel (apps/web)"]
        Web["Next.js 14 App Router\nReact Server + Client Components\nTailwind CSS"]
    end

    subgraph Compute["Railway / AWS Fargate (apps/api)"]
        API["NestJS API\nControllers / Services / Guards"]
        Worker["Background Workers\n(indexing, notifications, embeddings)"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL\n(Prisma ORM)")]
        Redis[("Redis\n(cache, queues, sessions)")]
        Meili[("Meilisearch\n(full-text index)")]
        Storage[("S3 / R2\n(document files, versions, exports)")]
    end

    subgraph External["External Services"]
        OpenAI["OpenAI API\n(embeddings + chat completion)"]
    end

    Browser -- "HTTPS" --> Web
    Web -- "REST/JSON (fetch)\nAuthorization: Bearer <JWT>" --> API
    Web -. "httpOnly cookies\n(access_token, refresh_token)" .- Browser

    API --> PG
    API --> Redis
    API --> Meili
    API --> Storage
    API --> OpenAI
    API --> Worker
    Worker --> PG
    Worker --> Meili
    Worker --> OpenAI
    Worker --> Redis

    classDef ext fill:#f5f5f5,stroke:#999,color:#333;
    class OpenAI ext;
```

## 2. Service Responsibilities

| Service | Responsibility |
|---|---|
| **apps/web (Next.js 14)** | Server-rendered UI, route groups per feature area, client-side interactivity (editor, graph, chat), calls the API via a typed fetch client, holds no direct DB/storage access. |
| **apps/api (NestJS)** | All business logic: auth, RBAC enforcement, document lifecycle, versioning, search indexing triggers, AI retrieval orchestration, notifications, audit logging. Exposes a REST API consumed by `apps/web` (and, later, other clients). |
| **PostgreSQL** | System of record for all relational data — users, documents, versions, categories, relationships, comments, approvals, audit log, etc. Accessed exclusively through Prisma in `apps/api`. |
| **Redis** | Session/token blacklist cache, rate-limiting counters, BullMQ-style job queues (indexing, embedding generation, notification fan-out), short-lived response caches. |
| **Meilisearch** | Full-text and faceted search index over documents (title, body text, tags, category, metadata). Kept eventually-consistent with Postgres via an indexing worker triggered on document write/approve/archive. |
| **S3/R2-compatible storage** | Binary storage for uploaded files, generated exports (PDF/DOCX), and rendered attachments referenced by documents and versions. Accessed via signed URLs; never exposed directly to the browser without going through the API's authorization checks. |
| **OpenAI API** | Embeddings for semantic search and RAG, and chat completions for the AI Assistant. Only ever called from the API layer / workers — never from the browser — so retrieval scoping (approved-only, confidentiality-aware) is enforced server-side. |

## 3. Monorepo Layout

```
Keyvantic/
├── apps/
│   ├── web/                     # Next.js 14 App Router, TypeScript, Tailwind
│   │   ├── app/
│   │   │   ├── (auth)/          # sign-in, sign-up, forgot-password
│   │   │   ├── (dashboard)/     # authenticated app shell
│   │   │   │   ├── library/     # Master Library browser + documents
│   │   │   │   ├── search/
│   │   │   │   ├── graph/
│   │   │   │   ├── assistant/   # AI Assistant chat
│   │   │   │   ├── clients/
│   │   │   │   └── admin/       # roles, permissions, settings
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   ├── lib/                 # api client, auth helpers, hooks
│   │   └── styles/
│   ├── api/                      # NestJS, Prisma, PostgreSQL
│   │   ├── src/
│   │   │   ├── modules/         # one folder per domain module (see below)
│   │   │   ├── common/          # guards, interceptors, filters, decorators
│   │   │   └── main.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── (future) worker/          # optional standalone worker process, shares NestJS providers
├── packages/
│   └── types/                    # shared TypeScript types/DTOs/enums, published as an internal package
├── docs/                         # this documentation
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

`packages/types` is the contract boundary between `apps/web` and `apps/api`: request/response DTOs, enums (`DocumentStatus`, `Role`, `RelationType`, `ConfidentialityLevel`), and shared Zod schemas live here so both apps compile against the same shapes and a breaking API change surfaces as a type error at build time rather than a runtime bug.

## 4. Auth Flow (JWT, Auth.js/Clerk-compatible design)

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as Next.js (apps/web)
    participant A as NestJS API
    participant R as Redis

    B->>W: POST /login (email, password)
    W->>A: POST /api/auth/login
    A->>A: verify credentials (bcrypt/argon2)
    A->>A: sign access_token (short TTL, ~15m)\nsign refresh_token (long TTL, ~30d)
    A->>R: store refresh_token id (rotation/blacklist tracking)
    A-->>W: Set-Cookie: access_token, refresh_token (httpOnly, Secure, SameSite=Lax)
    W-->>B: redirect to /dashboard

    Note over B,A: Subsequent requests
    B->>W: navigate / fetch
    W->>A: request with cookie or Authorization: Bearer <access_token>
    A->>A: JwtAuthGuard validates signature + expiry
    A-->>W: 200 + data (or 401 if expired)

    Note over W,A: On 401
    W->>A: POST /api/auth/refresh (refresh_token cookie)
    A->>R: validate refresh_token not revoked
    A->>A: rotate: issue new access+refresh tokens
    A-->>W: new Set-Cookie pair
    W->>A: retry original request
```

Tokens are never stored in `localStorage`; the httpOnly cookie pattern combined with short-lived access tokens and rotated refresh tokens keeps the design swappable with NextAuth/Auth.js or Clerk session adapters later, since the contract (cookie-based session, `/api/auth/session` equivalent) is the same shape.

## 5. Extensibility Model — Adding Future Modules

KOS is designed so that the roadmap's future modules (CRM, Project Management, Proposal Generator, AI Transformation Assessment, Client Portal, LMS, Research Publishing, Executive Dashboard, Financial Dashboard, Knowledge Graph, Internal AI Copilot — see `07-development-roadmap.md`) can be added **without modifying the core document/category/user modules**. Three mechanisms make this possible:

1. **NestJS module boundaries.** Each domain lives in its own module (`DocumentsModule`, `CategoriesModule`, `ClientsModule`, ...). A new module (e.g. `CrmModule`) is registered in `AppModule` alongside existing ones, imports only what it needs (e.g. `ClientsModule` for client references), and exposes its own controllers/services. It does not reach into another module's Prisma repository directly — cross-module reads go through the other module's exported service, keeping a stable seam.

2. **New Next.js route groups.** The web app adds a new route group under `app/(dashboard)/` (e.g. `app/(dashboard)/crm/`, `app/(dashboard)/portal/`) with its own layout, reusing the shared shell (`Sidebar`, `TopBar`, `NotificationBell`) and shared components (`DocumentCard`, `StatusBadge`) from `components/`. Existing routes are untouched.

3. **Shared `packages/types` and domain events.** New modules consume the same enums/DTOs as core (e.g. a Proposal referencing a `Document` by its `KV-XX-###` id uses the shared `DocumentSummary` type). Cross-module side effects (e.g. "notify me when a linked document changes status") are handled through an internal event bus (NestJS `EventEmitter2` / a `DomainEventsModule` backed by Redis pub/sub for multi-instance deployments) rather than direct service calls: core modules **emit** events (`document.approved`, `document.status_changed`, `client.created`, `comment.created`) and any module — present or future — can **subscribe** without core code knowing subscribers exist. This is what already powers the Notifications module in Phase 0, and it is the extension point future modules plug into (e.g. Executive Dashboard subscribes to `document.approved` and `client.created` to update rollups; Knowledge Graph subscribes to `relationship.created`).

```mermaid
graph LR
    subgraph Core["Core Modules (Phase 0)"]
        Docs[DocumentsModule]
        Cats[CategoriesModule]
        Clients[ClientsModule]
        Users[UsersModule]
    end
    Bus{{Domain Event Bus\nEventEmitter2 + Redis pub/sub}}
    subgraph Future["Future Modules (Phase 4+)"]
        Crm[CrmModule]
        PM[ProjectManagementModule]
        Portal[ClientPortalModule]
        Dash[ExecutiveDashboardModule]
        Graph[KnowledgeGraphModule]
    end

    Docs -- "emits document.*" --> Bus
    Clients -- "emits client.*" --> Bus
    Cats -- "emits category.*" --> Bus

    Bus -- "subscribes" --> Crm
    Bus -- "subscribes" --> PM
    Bus -- "subscribes" --> Portal
    Bus -- "subscribes" --> Dash
    Bus -- "subscribes" --> Graph

    Crm -. "reads via exported service, not direct DB access" .-> Clients
```

This keeps the blast radius of adding a module small: new Prisma models live in new schema files/sections with their own migrations, new modules are additive registrations in `AppModule`, and the UI grows by adding sibling route groups rather than editing existing ones.

## 6. Non-Functional Notes

- **Statelessness**: the API is stateless per-request (JWT-based), so it can run as multiple replicas behind a load balancer on Railway/ECS Fargate.
- **Caching**: Redis caches hot reads (category tree, permission matrix, popular documents) with short TTLs and explicit invalidation on writes.
- **Search consistency**: Meilisearch is a derived index, not the source of truth; it can be fully rebuilt from Postgres at any time via a reindex job.
- **Observability**: structured logging from NestJS interceptors, request IDs propagated from `apps/web`, and the `AuditLog` table as the durable record of who-did-what.
