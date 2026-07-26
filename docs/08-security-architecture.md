# Security Architecture

## 1. Authentication

- **Mechanism**: JWT access tokens (short-lived, ~15 minutes) + refresh tokens (long-lived, ~30 days), issued by `apps/api`'s auth module.
- **Storage**: both tokens are set as `httpOnly`, `Secure`, `SameSite=Lax` cookies — never exposed to client-side JavaScript, mitigating token theft via XSS. A Bearer-token mode is also supported for non-browser clients (e.g. CI scripts, future mobile clients) via `Authorization: Bearer <token>`.
- **Refresh rotation**: each refresh consumes the current refresh token and issues a new access+refresh pair; the old refresh token id is recorded as spent in Redis. Reuse of a spent refresh token immediately revokes the entire token family for that user (theft-detection heuristic).
- **Password storage**: argon2id (or bcrypt with a strong cost factor) hashing; no plaintext or reversible storage.
- **Design compatibility**: the cookie-based session shape and `/auth/session` endpoint mirror what NextAuth/Auth.js and Clerk expose, so either can be substituted later as the token issuer without changing how `apps/web` consumes session state.

## 2. Authorization — RBAC Permission Matrix

Permissions are `(role, resource, action)` triples stored in the `Permission` table (see `02-database-schema.md`) and are **configurable at runtime** by an ADMINISTRATOR via `PUT /permissions/:roleId` — the matrix below is the default seed, not a hardcoded constant.

| Resource / Action | ADMINISTRATOR | PARTNER | CONSULTANT | RESEARCHER | DESIGNER | SALES | MARKETING | GUEST |
|---|---|---|---|---|---|---|---|---|
| Document: Read (within clearance) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (PUBLIC only) |
| Document: Create | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| Document: Edit own draft | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| Document: Submit for review | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| Document: Approve/Publish | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Document: Archive | ✔ | ✔ | ✔ (own) | ✘ | ✘ | ✘ | ✘ | ✘ |
| Document: Delete (hard) | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Document: Export | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| Category: Create/Edit tree | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Client: Create | ✔ | ✔ | ✘ | ✘ | ✘ | ✔ (lead intake) | ✘ | ✘ |
| Client: Read | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ | ✘ | ✘ |
| User: Manage roles | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Approval: Decide | ✔ | ✔ | ✘ (unless explicitly assigned) | ✘ | ✘ | ✘ | ✘ | ✘ |
| Audit Log: Read | ✔ | ✔ (own team scope) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| AI Assistant: Query | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (PUBLIC scope) |

Enforcement points: `RolesGuard` (coarse resource/action check via `@Roles()`/permission lookup) and `DocumentAccessGuard` (fine-grained per-record check combining role, ownership, and confidentiality — see §3) on every document-scoped route.

## 3. Confidentiality Levels

Every `Document` carries a `confidentialityLevel`: `PUBLIC < INTERNAL < CONFIDENTIAL < RESTRICTED`.

| Level | Typical Use | Visibility |
|---|---|---|
| `PUBLIC` | Marketing collateral, published research | All authenticated users and GUEST role |
| `INTERNAL` | Standard firm knowledge, playbooks | All authenticated employees (all roles except GUEST) |
| `CONFIDENTIAL` | Client deliverables, discovery notes, pricing | Roles with document access **and** an explicit relationship to the document (author, category-level grant, or client-team membership) |
| `RESTRICTED` | Sensitive client/financial/legal material | Named individuals or roles explicitly granted (ADMINISTRATOR, PARTNER, and any user explicitly added to a document-level access grant) |

**Enforcement is server-side and centralized**, not left to the UI:

- Every document read (`GET /documents/:id`, list endpoints, search, AI retrieval) passes through the same `DocumentAccessGuard`/query-level filter: `status` visibility rules (non-privileged roles only ever see `APPROVED`, plus their own `DRAFT`/`INTERNAL_REVIEW` documents) **AND** `confidentialityLevel <= caller's clearance for that document`.
- Clearance is computed from role defaults plus any explicit grants (e.g. a CONSULTANT staffed on a client engagement gets `CONFIDENTIAL` clearance scoped to that client's sub-tree only, not firm-wide).
- **Search** (`/search`, `/search/semantic`) applies the identical filter at the Meilisearch/vector-query level — a restricted document never appears in results, snippets, or facet counts for an unauthorized user, not even as a redacted title.
- **AI Assistant retrieval** applies the same filter as a hard `WHERE` clause on the retrieval query (`status = 'APPROVED' AND confidentialityLevel <= clearance AND category/client in scope`) before any content reaches the OpenAI prompt — the model never sees restricted content it could inadvertently leak into an answer. This is enforced in `rag.service.ts`, independent of and prior to prompt construction, so no prompt-injection within a retrieved chunk can widen the retrieval scope (the scope is fixed before retrieval happens, not decided by the LLM).

## 4. Audit Logging

- Every mutating request (create/update/delete/status-transition/permission-change) writes an `AuditLog` row via `AuditLogInterceptor`, capturing actor, action, entity type/id, a before/after metadata diff, IP address, and timestamp.
- `AuditLog` rows are append-only at the application layer (no `PATCH`/`DELETE` endpoints exposed) and should also be protected at the database layer (e.g. a restrictive Postgres role/trigger denying UPDATE/DELETE) or exported to immutable storage (S3 with object-lock/WORM) for compliance-grade retention.
- Sensitive fields (passwords, tokens) are never written into audit metadata.

## 5. Data Protection

| Concern | Approach |
|---|---|
| **Data at rest** | Managed PostgreSQL and Redis instances with provider-managed encryption at rest (Railway/AWS RDS-equivalent, ElastiCache/managed Redis). S3/R2 buckets use server-side encryption (SSE). |
| **Data in transit** | TLS everywhere: browser↔Vercel, Vercel↔API, API↔Postgres/Redis/Meilisearch (TLS-enabled connection strings in production), API↔OpenAI (HTTPS). No plaintext internal traffic in production. |
| **Secrets management** | No secrets committed to the repo. Local dev uses `.env` (gitignored) seeded from `.env.example`. Production secrets live in the hosting platform's secret store (Vercel Environment Variables, Railway/AWS Secrets Manager) and are injected at runtime, never baked into build artifacts. `JWT_SECRET`/`JWT_REFRESH_SECRET` are high-entropy, rotated on a defined schedule, and rotation invalidates all outstanding refresh tokens by design. |
| **Backups** | Managed Postgres automated backups/point-in-time recovery; S3/R2 versioning enabled on the storage bucket as a second line of defense behind the application's own `DocumentVersion` history. |

## 6. Tenant / Document Isolation for the AI Assistant

Because the AI Assistant can synthesize answers across many documents, it is the highest-leverage place for a confidentiality leak, so it gets dedicated controls beyond the general access guard:

1. **Retrieval-time filtering, not prompt-time instruction.** The candidate-chunk query itself excludes non-`APPROVED`, out-of-clearance, and out-of-scope (category/client) content — see §3. The LLM is never given a chance to "decide" not to use restricted content; it never receives it.
2. **Citation-verifiable answers.** Every answer must cite the specific `documentCode`/`versionNumber` it drew from, so a user (or an auditor) can verify the assistant only used documents they could have opened directly.
3. **Per-conversation scope pinning.** If a query originates from within a client context (e.g. asked from inside a client's sub-tree), retrieval is further scoped to that client plus firm-wide `INTERNAL`/`PUBLIC` content, preventing cross-client knowledge bleed (e.g. Client A's discovery notes never surfacing in an answer generated while working in Client B's space).
4. **No training on tenant data.** OpenAI API calls use the standard API (not consumer ChatGPT), which per OpenAI's API data usage policy is not used to train models by default — documented here as a policy dependency, not an application-level control.
5. **Prompt-injection containment.** Retrieved document content is passed to the model as clearly delimited context, with system instructions that content within retrieved chunks is data, not instructions — mitigating a malicious/compromised document attempting to alter assistant behavior via embedded instructions ("ignore previous instructions...").

## 7. Rate Limiting & Input Validation

- **Rate limiting**: per-user and per-IP limits (Redis-backed sliding window) on auth endpoints (`/auth/login`, `/auth/refresh` — brute-force mitigation), AI Assistant queries (cost control against OpenAI usage), and search endpoints. Exceeding a limit returns `429 RATE_LIMITED` with a `Retry-After` header.
- **Input validation**: all request bodies validated via DTOs with `class-validator`/Zod schemas shared through `packages/types`; rejected requests return `400 VALIDATION_ERROR` with field-level details (see `03-api-design.md` §1). File uploads validated for MIME type, size limits, and (where feasible) content-sniffing to reject mismatched extensions.
- **Output encoding**: API never returns raw HTML for rich-text content without the client-side renderer sanitizing it (see OWASP §8 below).

## 8. OWASP Top 10 — Relevant Mitigations

| Risk | Where It Applies in KOS | Mitigation |
|---|---|---|
| **A01 Broken Access Control / IDOR** | Document IDs (`KV-BS-001`) and internal UUIDs are guessable/sequential enough that a naive implementation could let a user fetch a document by ID they shouldn't see. | Every document fetch (by id or code) goes through `DocumentAccessGuard`; unauthorized existence returns `403`, not a bypass. No endpoint trusts a client-supplied ownership/role claim — always re-derived server-side from the authenticated session. |
| **A02 Cryptographic Failures** | JWT signing, password hashing, token storage. | Strong signing algorithm (RS256/HS256 with high-entropy secret), argon2id/bcrypt password hashing, httpOnly+Secure cookies, TLS everywhere (§5). |
| **A03 Injection** | Prisma parameterizes all queries by default (mitigates SQL injection). Rich-text content and comments are user-supplied. | Never construct raw SQL from user input; use Prisma's query builder exclusively. Sanitize rich-text HTML output (see A07/XSS below). Validate/escape any user input used in Meilisearch filter expressions. |
| **A04 Insecure Design** | Confidentiality bypass via search or AI assistant if retrieval filtering were an afterthought. | Confidentiality/status filtering is designed as a single centralized enforcement point reused by document reads, search, and AI retrieval (§3), not re-implemented ad hoc per feature. |
| **A05 Security Misconfiguration** | Default secrets, verbose error messages, open CORS. | `.env.example` ships with placeholder (non-functional) values only; production requires explicit secret injection. CORS restricted to known web origins. Stack traces never returned in API error responses in production (`HttpExceptionFilter` strips internals outside dev). |
| **A06 Vulnerable & Outdated Components** | pnpm-managed dependency tree across two apps. | CI runs dependency audit (`pnpm audit` or equivalent) as a pipeline stage; Dependabot/Renovate-style update PRs recommended. |
| **A07 Identification & Authentication Failures / Stored XSS** | Rich-text document content and comments are stored as user-authored HTML/JSON (Tiptap) and rendered back to other users — classic stored-XSS vector. | Content is stored as Tiptap's structured JSON (not raw HTML) and rendered through a controlled renderer that maps known node/mark types to safe output; any raw-HTML paste/import path is sanitized (allowlist-based, e.g. via `sanitize-html`/DOMPurify equivalent) before persistence **and** again defensively at render time. Video/PDF/diagram embed blocks only accept vetted source patterns (see A10/SSRF below), not arbitrary iframes. |
| **A08 Software & Data Integrity Failures** | CI/CD pipeline, deployment artifacts. | CI pipeline runs from pinned lockfile (`pnpm-lock.yaml`); build artifacts deployed via Vercel/Railway's standard integrity-checked pipelines; no unpinned `curl | sh` steps in CI. |
| **A09 Security Logging & Monitoring Failures** | Needing to detect abuse (e.g. approval workflow tampering, repeated failed logins). | `AuditLog` covers business-level events (§4); infrastructure-level logging (failed auth attempts, rate-limit trips) captured in structured application logs, exportable to a log aggregator. |
| **A10 Server-Side Request Forgery (SSRF)** | Export features (rendering a document to PDF, possibly fetching embedded image/video URLs) and the video/PDF embed editor blocks that store arbitrary URLs. | Export rendering never fetches arbitrary user-supplied URLs server-side without an allowlist (e.g. only fetch from the app's own S3/R2 bucket or a small allowlist of known video providers for oEmbed-style embeds); no generic "fetch this URL and render it" capability is exposed. Embed blocks for video/PDF resolve to a small set of known-safe embed patterns (YouTube/Vimeo iframe embed, internal S3/R2 signed URL) rather than proxying/fetching attacker-controlled endpoints server-side. |

## 9. Session & Device Management

- Users can view active sessions/refresh-token families and revoke them individually (relevant when a device is lost or a user leaves the firm) — surfaced in Account settings.
- Deactivating a user (`PATCH /users/:id/deactivate`) immediately invalidates all outstanding refresh tokens for that user via the Redis-tracked token family, in addition to flipping `isActive`.
