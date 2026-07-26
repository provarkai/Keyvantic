# API Design

## 1. Conventions

- **Base URL**: `https://api.keyvantic.com/v1` (production), `http://localhost:4000/v1` (local).
- **Format**: JSON request/response bodies, `Content-Type: application/json` except file uploads (`multipart/form-data`) and exports (binary with appropriate `Content-Type`/`Content-Disposition`).
- **Auth**: Bearer JWT access token (`Authorization: Bearer <token>`) or httpOnly session cookie, interchangeably — see `08-security-architecture.md`. Every endpoint below is authenticated unless marked **Public**.
- **Roles**: enforced by a `RolesGuard` reading a `@Roles(...)` decorator per route; "Any authenticated" means no specific role beyond a valid session and, where applicable, resource-level ownership/confidentiality checks.
- **Pagination**: cursor-agnostic offset pagination via query params `?page=1&pageSize=25` (default `pageSize=25`, max `100`). List responses use the envelope:
  ```json
  { "data": [ ... ], "meta": { "page": 1, "pageSize": 25, "total": 342, "totalPages": 14 } }
  ```
- **Filtering & sorting**: list endpoints accept `?filter[field]=value` style query params documented per-resource below, plus `?sort=field` / `?sort=-field` for descending.
- **Errors**: a consistent envelope on all non-2xx responses:
  ```json
  {
    "error": {
      "code": "DOCUMENT_NOT_FOUND",
      "message": "Document KV-BS-999 does not exist.",
      "statusCode": 404,
      "details": null
    }
  }
  ```
  Validation errors (400) populate `details` as an array of `{ field, message }`. Standard codes: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 UNPROCESSABLE_ENTITY`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`.
- **Idempotency**: mutating endpoints that create side effects across services (e.g. status transitions triggering notifications/indexing) accept an optional `Idempotency-Key` header.

## 2. Resource Summary

| Resource | Base Path |
|---|---|
| Auth | `/auth` |
| Users | `/users` |
| Roles & Permissions | `/roles`, `/permissions` |
| Categories (Master Library tree) | `/categories` |
| Documents | `/documents` |
| Document Versions | `/documents/:documentId/versions` |
| Tags | `/tags` |
| Relationships / Graph | `/documents/:documentId/relationships`, `/graph` |
| Comments | `/documents/:documentId/comments` |
| Approvals | `/documents/:documentId/approvals` |
| Notifications | `/notifications` |
| Search | `/search` |
| AI Assistant | `/ai-assistant` |
| Clients | `/clients` |
| Audit | `/audit` |

## 3. Auth

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | Public | `{ email, password }` → sets access/refresh cookies, returns user profile. |
| POST | `/auth/logout` | Any | Revokes refresh token, clears cookies. |
| POST | `/auth/refresh` | Refresh cookie | Rotates access+refresh tokens. |
| GET | `/auth/session` | Any | Returns current user + role + permission summary (used by web app on load). |
| POST | `/auth/forgot-password` | Public | Sends reset email. |
| POST | `/auth/reset-password` | Public (token) | `{ token, newPassword }`. |
| POST | `/auth/invite` | ADMINISTRATOR, PARTNER | Invites a new user by email with a preset role. |

## 4. Users

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users` | ADMINISTRATOR, PARTNER | Filters: `?filter[role]=`, `?filter[isActive]=`, `?search=`. |
| GET | `/users/:id` | Any (self) or ADMINISTRATOR, PARTNER | |
| PATCH | `/users/:id` | Self (limited fields) or ADMINISTRATOR | Role changes restricted to ADMINISTRATOR. |
| PATCH | `/users/:id/deactivate` | ADMINISTRATOR | Soft-deactivate, does not delete authored content. |
| GET | `/users/me/favorites` | Any | |
| GET | `/users/me/recently-viewed` | Any | |

## 5. Roles & Permissions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/roles` | Any | Returns the 8 roles. |
| GET | `/permissions` | ADMINISTRATOR | Full matrix (role × resource × action). |
| PUT | `/permissions/:roleId` | ADMINISTRATOR | Replaces the permission set for a role (configurable matrix). |

## 6. Categories (Master Library)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/categories` | Any | Returns tree (nested) or flat list via `?format=tree|flat`. Respects visibility (e.g. GUEST may see a restricted subtree). |
| GET | `/categories/:id` | Any | |
| POST | `/categories` | ADMINISTRATOR, PARTNER | Create a category/sub-folder; body includes `parentId`, `name`, `code`. |
| PATCH | `/categories/:id` | ADMINISTRATOR, PARTNER | Rename/reorder/move (change `parentId`). |
| DELETE | `/categories/:id` | ADMINISTRATOR | Blocked (409) if it or descendants contain non-archived documents. |

## 7. Documents

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/documents` | Any (filtered by confidentiality/role) | Filters: `?filter[categoryId]=`, `?filter[status]=`, `?filter[clientId]=`, `?filter[tag]=`, `?filter[authorId]=`, `?search=`. |
| GET | `/documents/:codeOrId` | Any (per confidentiality/role) | Accepts either internal id or human `code` (`KV-BS-001`). 403 (not 404) if it exists but access is denied, to avoid leaking existence via status-code oracle — see `08-security-architecture.md`. |
| POST | `/documents` | CONSULTANT and above (per matrix) | Creates a `DRAFT` doc + initial version 1; server assigns `code` from category. |
| PATCH | `/documents/:id` | Author or ADMINISTRATOR/PARTNER | Metadata edits (title, summary, tags, category) — content edits go through Versions. |
| POST | `/documents/:id/submit-for-review` | Author | Transition `DRAFT → INTERNAL_REVIEW`; creates pending `Approval` rows for assigned reviewers, emits `document.submitted`. |
| POST | `/documents/:id/approve` | PARTNER, ADMINISTRATOR (assigned approver) | Transition `INTERNAL_REVIEW → APPROVED` once all required approvals resolve; emits `document.approved`, triggers search index + embedding update. |
| POST | `/documents/:id/request-changes` | Assigned approver | Records `CHANGES_REQUESTED`, moves doc back to `DRAFT`, notifies author. |
| POST | `/documents/:id/archive` | ADMINISTRATOR, PARTNER, or author | Transition `APPROVED → ARCHIVED` (or any state → `ARCHIVED`). |
| POST | `/documents/:id/restore` | ADMINISTRATOR, PARTNER | Transition `ARCHIVED → APPROVED` (or last known state). |
| DELETE | `/documents/:id` | ADMINISTRATOR | Hard delete — restricted, logged, rarely used (prefer archive). |
| GET | `/documents/:id/export` | Per confidentiality/role | Query `?format=pdf|docx`; streams generated export from current version. |
| POST | `/documents/:id/favorite` / DELETE | Any | Toggle favorite. |

## 8. Document Versions

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/documents/:documentId/versions` | Per document access | List, newest first, paginated. |
| GET | `/documents/:documentId/versions/:versionNumber` | Per document access | |
| POST | `/documents/:documentId/versions` | Author or editor role on doc | Creates new version (`versionNumber = current + 1`), updates `currentVersionId`, resets status to `DRAFT` if it was `APPROVED` (re-review required), emits `document.version_created`. |
| GET | `/documents/:documentId/versions/compare` | Per document access | Query `?from=<versionNumber>&to=<versionNumber>` → structured diff (added/removed/changed blocks) for the Diff Viewer. |
| POST | `/documents/:documentId/versions/:versionNumber/restore` | Author, ADMINISTRATOR, PARTNER | Creates a **new** version with the old version's content (append-only — see schema rationale), does not delete intervening history. |

## 9. Tags

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/tags` | Any | `?search=` for autocomplete. |
| POST | `/tags` | Any authenticated (dedup by name) | |
| POST | `/documents/:id/tags` | Editor on doc | `{ tagIds: [] }` |
| DELETE | `/documents/:id/tags/:tagId` | Editor on doc | |

## 10. Relationships / Graph

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/documents/:id/relationships` | Per document access | Both outgoing and incoming edges. |
| POST | `/documents/:id/relationships` | Editor on doc | `{ targetDocumentId, relationType }`. |
| DELETE | `/documents/:id/relationships/:relationshipId` | Editor on doc or ADMINISTRATOR | |
| GET | `/graph` | Any (filtered) | Query `?rootDocumentId=&depth=2&categoryId=&clientId=` — returns nodes+edges scoped to caller's visibility, for the Graph View canvas. |

## 11. Comments

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/documents/:id/comments` | Per document access | Threaded (nested by `parentCommentId`). |
| POST | `/documents/:id/comments` | Per document access | Supports `@mentions`; emits `comment.created`, notifies mentioned users + doc watchers. |
| PATCH | `/comments/:id` | Author | Edit own comment. |
| DELETE | `/comments/:id` | Author or ADMINISTRATOR | |
| POST | `/comments/:id/resolve` | Doc author, PARTNER, ADMINISTRATOR | |

## 12. Approvals

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/documents/:id/approvals` | Per document access | |
| GET | `/approvals/pending` | Any | "My pending approvals" queue, filters `?assignedToMe=true`. |
| POST | `/documents/:id/approvals` | Author, ADMINISTRATOR, PARTNER | Assign reviewer(s) — creates `PENDING` Approval rows. |
| POST | `/approvals/:id/decide` | Assigned approver | `{ decision, comment }` — see Documents `approve`/`request-changes` for resulting doc-status side effects. |

## 13. Notifications

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/notifications` | Any (self) | `?unreadOnly=true`, paginated. |
| PATCH | `/notifications/:id/read` | Any (self) | |
| PATCH | `/notifications/read-all` | Any (self) | |
| GET | `/notifications/stream` | Any (self) | SSE/WebSocket-friendly endpoint for live badge updates (falls back to polling). |

## 14. Search

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/search` | Any (results filtered) | Full-text via Meilisearch. `?q=`, `?filter[categoryId]=`, `?filter[status]=` (defaults to APPROVED for non-privileged roles), `?filter[tag]=`, `?filter[clientId]=`, pagination as above. Response includes facet counts. |
| GET | `/search/semantic` | Any (results filtered) | `?q=` natural-language query → embeds query, vector-similarity ranks against document embeddings, same access filtering as full-text. |
| GET | `/search/suggest` | Any | Lightweight autocomplete (titles, tags, category names). |

## 15. AI Assistant (RAG)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/ai-assistant/query` | Any | `{ question, conversationId? }`. Server retrieves top-k chunks restricted to `status = APPROVED` **and** `confidentialityLevel` within the caller's clearance **and** category/client scoping the caller can see (see `08-security-architecture.md`), then calls OpenAI chat completion with retrieved context. Returns `{ answer, citations: [{ documentCode, versionNumber, snippet }] }`. |
| GET | `/ai-assistant/conversations` | Any (self) | List past conversations. |
| GET | `/ai-assistant/conversations/:id` | Any (self) | Full message history with citations. |
| DELETE | `/ai-assistant/conversations/:id` | Any (self) | |

## 16. Clients

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/clients` | CONSULTANT and above (per matrix) | `?filter[status]=`, `?search=`. |
| GET | `/clients/:id` | Per client access | |
| POST | `/clients` | PARTNER, ADMINISTRATOR | Creates Client row **and** its Master Library sub-tree (`Company Profile`, `Discovery Notes`, `Deliverables`, `Reports`, `Meeting Notes`, `AI Opportunities`, `Transformation Roadmap`) under `09 Clients` in one transaction; emits `client.created`. |
| PATCH | `/clients/:id` | PARTNER, ADMINISTRATOR | |
| GET | `/clients/:id/documents` | Per client access | Convenience view over `/documents?filter[clientId]=`. |

## 17. Audit

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/audit` | ADMINISTRATOR | `?filter[entityType]=&filter[entityId]=&filter[actorId]=&from=&to=`, paginated. |
| GET | `/audit/documents/:id` | ADMINISTRATOR, PARTNER, or doc author | Convenience: full history for one document (status changes, version creations, approvals, comments). |

## 18. Cross-Cutting Behavior

- **Confidentiality-aware 403 vs 404**: For `GET /documents/:codeOrId`, existence of an out-of-clearance document returns `403 FORBIDDEN`, not `404`, distinguished internally but presented identically enough to avoid confirming a specific restricted document's existence to unauthorized users where the product requires it (configurable per confidentiality level).
- **Optimistic concurrency**: `PATCH` endpoints on Document/Category accept an `If-Match`/`updatedAt` check; a stale write returns `409 CONFLICT`.
- **Event emission**: state-changing endpoints emit domain events (`document.approved`, `client.created`, etc.) consumed by the Notifications module and available to future modules — see `01-system-architecture.md` §5.
