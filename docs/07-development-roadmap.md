# Development Roadmap

## Guiding Principle

Phase 0 establishes the Master Library as a solid, trustworthy system of record (structure, versioning, approvals, basic search). Phases 1-3 deepen collaboration, retrieval intelligence, and relationship insight on top of that foundation. Phase 4+ extends KOS into a broader firm operating system by adding modules — never by reworking the core. Each phase should ship independently usable value; later phases should not require re-architecting earlier ones.

## Phase 0 — Foundation (this build)

**Goal**: a working Master Library with lifecycle, versioning, and RBAC — the substrate everything else builds on.

- Monorepo scaffold: `apps/web`, `apps/api`, `packages/types`, Docker Compose for local dev.
- Auth: JWT access/refresh, httpOnly cookies, `JwtAuthGuard`/`RolesGuard`.
- Core data model: Users, Roles, Permissions, Categories (Master Library tree seeded with the 9 top-level folders), Documents, DocumentVersions, Tags, Clients (with sub-tree onboarding), Favorites, RecentlyViewed, AuditLog.
- Document lifecycle: `DRAFT → INTERNAL_REVIEW → APPROVED → ARCHIVED`, Approvals model, basic Comments (flat or single-level threading acceptable for v1).
- Rich Editor v1 (Tiptap) — see "Rich Editor Feature Scope" below for exactly what ships now vs. later.
- Version history + basic diff (text-level) + restore.
- Full-text search via Meilisearch (index synced on document write/approve/archive).
- Notifications: in-app only (bell + inbox), event-driven from `document.*`/`comment.*` events.
- Dashboard, Master Library browser, Document Detail/Editor, Search Results, Admin (users, roles/permissions, categories) screens per `05-ui-ux-wireframes.md`.
- CI: lint, typecheck, unit tests, build (see `09-deployment-guide.md`).

**Exit criteria**: a consultant can create a document, submit it for review, get it approved, see it in search, and an admin can manage roles/permissions and the category tree.

## Phase 1 — Collaboration & Approvals Polish

**Depends on**: Phase 0 data model and lifecycle.

- Multi-approver workflows (parallel/sequential approval chains, not just single-reviewer).
- Threaded comments with @mentions and resolution state.
- Review-due scheduling (`dueForReviewAt`) + cron worker + `REVIEW_DUE` notifications.
- Dependency-change notifications (`DEPENDENCY_CHANGED`) when a linked document's status changes.
- Notification preferences (per-user opt-in/out per notification type) and an email digest worker (reuses the same event subscribers as in-app notifications).
- Document relationships/edges UI (create/remove typed relationships from Document Detail) as a precursor to the full Graph View.
- Export improvements: PDF/DOCX export fidelity, watermarking for `CONFIDENTIAL`/`RESTRICTED` exports.

## Phase 2 — Semantic Search & AI Copilot Depth

**Depends on**: Phase 0 approved-document corpus large enough to be useful; Phase 1 relationship/comment data optional but improves grounding context.

- Embedding pipeline: generate/refresh embeddings on `document.approved` and on version restore; store vectors (pgvector extension on the existing Postgres instance, or a dedicated vector store if scale demands it later).
- `/search/semantic` endpoint and UI toggle (full-text vs. semantic vs. "Smart" blended ranking).
- AI Assistant conversations with citations, restricted strictly to `APPROVED` + confidentiality-cleared + scope-visible content (already designed in Phase 0's retrieval contract, deepened here with conversation memory and follow-up handling).
- Assistant quality features: citation confidence indicators, "no answer found in approved knowledge base" fallback, feedback (thumbs up/down) on answers to inform future prompt/retrieval tuning.
- Command Palette gains AI-assisted "ask a question" mode inline with keyword search.

## Phase 3 — Graph Analytics

**Depends on**: Phase 1 relationship edges existing in meaningful volume.

- Graph View canvas (force-directed, filters by root/depth/relation type/category/client) per `05-ui-ux-wireframes.md` §8.
- Graph analytics: orphan document detection (no relationships), most-referenced documents, stale-approved-document detection (approved but superseded elsewhere in the graph), category density views.
- Graph-aware AI retrieval: optionally expand RAG context using 1-hop related documents, not just top-k vector matches, for questions that benefit from structural context (e.g. "what does the roadmap depend on").
- Bulk relationship tools (e.g. auto-suggest likely `RELATED_TO` edges from semantic similarity, pending human confirmation).

## Phase 4+ — Future Modules

Each module below is additive: a new NestJS module + new Next.js route group, consuming `packages/types` and the domain event bus, per the extensibility model in `01-system-architecture.md` §5. They are listed in a rough, dependency-aware sequence rather than a strict order — actual sequencing depends on firm priorities at the time.

| Module | Depends On | Rationale for Sequencing |
|---|---|---|
| **Client Portal** | Clients module, Documents, Approvals (Phase 0-1) | Natural next step once client sub-trees and approvals exist — exposes a restricted, client-facing view of their `Deliverables`/`Reports` sub-nodes. Needs its own auth boundary (external users) layered on the existing RBAC model. |
| **CRM** | Clients module (Phase 0) | Extends `Client` with pipeline/opportunity tracking; reuses `Client` entity, adds its own `Opportunity`/`Interaction` models rather than modifying `Client`. |
| **Proposal Generator** ✅ *Built* | Documents, Master Library content (Phase 0), ideally Semantic Search (Phase 2) | Shipped as a v1 ahead of this sequencing — see `docs/10-proposal-generator-spec.md`. Assembles proposals per-section via keyword-ranked RAG scoped to the target client's own sub-tree plus firm-wide approved content; commercial-terms sections are never AI-drafted. Will benefit from Phase 2's retrieval quality once semantic search lands, but didn't need to wait for it. |
| **AI Transformation Assessment** | AI Assistant/RAG groundwork (Phase 2) | A structured questionnaire + scoring tool that can hand off findings into a `09 Clients/.../Transformation Roadmap` document; reuses the RAG service for narrative generation from assessment answers. |
| **Project Management** | Clients, Documents (Phase 0) | Tasks/milestones linked to client engagements and deliverables; emits its own `task.*` events consumable by Notifications without changes to that module. |
| **Research Publishing** | Categories, Documents, Tags (Phase 0) | A curated, possibly externally-shareable view over `04 Research`; mostly a presentation/permissions layer on existing content. |
| **Learning Management System (LMS)** | Documents (Phase 0), Categories | Courses/modules built from existing document content plus new `Course`/`Enrollment`/`Quiz` models; independent enough to build in parallel with other Phase 4 items. |
| **Executive Dashboard** | Event bus (Phase 0), data across Clients/Documents/CRM/PM as they land | Rollup views subscribing to `document.approved`, `client.created`, `task.completed`, etc.; grows richer as more modules emit events, but a first version can already report on document/approval throughput and client activity. |
| **Financial Dashboard** | CRM, Project Management (for engagement/revenue data) | Needs upstream modules' data (opportunities, engagement time) before it has much to show; sequenced later. |
| **Knowledge Graph** (standalone, beyond Phase 3's in-app Graph View) | Phase 3 Graph Analytics, ideally CRM/PM for entity types beyond documents | Generalizes the document relationship graph to include clients, people, and projects as first-class graph nodes, not just documents. |
| **Internal AI Copilot** | AI Assistant/RAG (Phase 2), and ideally most other modules | A firm-wide assistant that can reason across documents, clients, projects, and CRM data (not just the document corpus) — the natural long-term convergence point once enough modules exist to make cross-module retrieval valuable. |

## Rich Editor Feature Scope (Tiptap)

To avoid over-scoping Phase 0, rich-editor capabilities are split into what ships functional in v1 versus what is deferred as polish:

| Feature | v1 (Phase 0) | Deferred Polish |
|---|---|---|
| Text formatting (bold/italic/headings/lists/links) | Ships | — |
| Tables | Ships (basic insert/edit) | Advanced cell merge, column resize drag-handles |
| Images | Ships (upload to S3/R2, inline display) | Captioning, alignment controls, image galleries |
| Diagrams/flowcharts drawing tool | Ships functional v1 — an embeddable diagram block (e.g. a Tiptap node wrapping an Excalidraw-style or Mermaid-source editor) that stores diagram source + rendered SVG | Full freeform drawing toolbar parity with dedicated diagramming apps (shape libraries, advanced styling, real-time co-editing of the diagram itself) |
| Embedded video | Ships functional v1 — paste-a-URL embed (YouTube/Vimeo/S3-hosted MP4) rendered as a responsive player block | Inline video trimming, custom player chrome, transcript generation |
| Footnotes | Ships functional v1 — inline footnote marker + endnote list rendered at document end | Cross-document footnote linking, footnote numbering styles per category |
| PDF embed | Ships functional v1 — embed a PDF (uploaded or from another Document's version) as an inline scrollable viewer block | Inline PDF annotation/highlighting, page-range embedding |
| Real-time multi-user co-editing | Not in v1 (single-editor-at-a-time with autosave + version conflict detection is sufficient for Phase 0-1) | Full operational-transform/CRDT-based live co-editing — candidate for a later phase if concurrent authoring becomes a real bottleneck |

The distinction driving "functional v1" vs. "deferred polish": v1 features must let a consultant actually produce and consume the content type (insert a diagram, embed a video, cite a footnote, embed a PDF) with a reasonable default experience; deferred items are refinements that improve authoring ergonomics but aren't required for the content type to exist and render correctly in a document.
