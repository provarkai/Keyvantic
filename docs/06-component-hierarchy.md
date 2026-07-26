# Component Hierarchy

## 1. Next.js App Router — Route Tree (apps/web)

```
app/
├── layout.tsx                          # Root layout: theme provider, font, global providers
├── globals.css
│
├── (auth)/                             # Public, unauthenticated route group
│   ├── layout.tsx                      # Minimal centered layout, no Sidebar/TopBar
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
└── (dashboard)/                        # Authenticated app shell route group
    ├── layout.tsx                      # AppShell: Sidebar + TopBar + content slot
    │
    ├── page.tsx                        # Dashboard (home)
    │
    ├── library/
    │   ├── layout.tsx                  # Tree + list two/three-pane layout
    │   ├── page.tsx                    # Root of Master Library (top-level categories)
    │   ├── [categoryId]/page.tsx        # Category-scoped document list
    │   └── documents/
    │       ├── new/page.tsx             # New document form
    │       └── [documentId]/
    │           ├── page.tsx             # Document Detail (Content tab default)
    │           ├── edit/page.tsx        # Document Editor
    │           ├── versions/page.tsx    # Version History / Diff
    │           ├── comments/page.tsx    # Comments tab (or intercepted route/modal)
    │           └── relationships/page.tsx
    │
    ├── search/
    │   └── page.tsx                     # Search results (full-text + semantic toggle)
    │
    ├── graph/
    │   └── page.tsx                     # Graph View canvas
    │
    ├── assistant/
    │   ├── page.tsx                     # AI Assistant chat (new conversation)
    │   └── [conversationId]/page.tsx
    │
    ├── clients/
    │   ├── page.tsx                     # Clients directory
    │   ├── new/page.tsx
    │   └── [clientId]/page.tsx           # Client overview + sub-tree shortcut
    │
    ├── notifications/
    │   └── page.tsx                     # Full notifications inbox (bell links here)
    │
    └── admin/                           # Gated by RoleGuard (ADMINISTRATOR, PARTNER)
        ├── layout.tsx
        ├── users/page.tsx
        ├── roles/page.tsx                # Permission matrix editor
        ├── categories/page.tsx           # Category tree manager
        └── audit/page.tsx
```

**Future module route groups** (see `07-development-roadmap.md`) are added as new top-level siblings under `(dashboard)/`, e.g. `(dashboard)/crm/`, `(dashboard)/projects/`, `(dashboard)/portal/`, `(dashboard)/lms/`, `(dashboard)/dashboards/` — each with its own `layout.tsx` reusing the shared `AppShell`, without modifying `library/`, `search/`, `graph/`, etc.

## 2. Shared Component Library (apps/web/components)

```
components/
├── layout/
│   ├── AppShell.tsx              # Composes Sidebar + TopBar + <main>
│   ├── Sidebar.tsx                # Primary nav, role-aware (hides Admin for non-admins)
│   ├── TopBar.tsx                 # Logo, CommandPalette trigger, NotificationBell, AccountMenu
│   └── ThemeToggle.tsx
│
├── navigation/
│   ├── CommandPalette.tsx         # ⌘K search-everything (documents, clients, actions)
│   ├── Breadcrumb.tsx
│   └── TabBar.tsx
│
├── document/
│   ├── DocumentCard.tsx           # Grid/list card: title, code, status, author, updatedAt
│   ├── DocumentListRow.tsx
│   ├── StatusBadge.tsx            # DRAFT / INTERNAL_REVIEW / APPROVED / ARCHIVED chip
│   ├── ConfidentialityBadge.tsx
│   ├── MetadataPanel.tsx          # Right-rail metadata block on Document Detail
│   ├── RelationshipList.tsx
│   ├── ApprovalStatusList.tsx
│   └── FavoriteToggle.tsx
│
├── editor/
│   ├── RichEditor.tsx             # Tiptap wrapper (extensions: tables, images, diagram,
│   │                              #   video embed, PDF embed, footnotes — see roadmap for v1 scope)
│   ├── EditorToolbar.tsx
│   ├── TagInput.tsx
│   └── CategoryPicker.tsx
│
├── versions/
│   ├── VersionTimeline.tsx        # Selectable rail of DocumentVersion entries
│   └── DiffViewer.tsx             # Renders structured diff from /versions/compare
│
├── graph/
│   ├── GraphCanvas.tsx            # Force-directed rendering (nodes/edges), pan/zoom
│   ├── GraphControls.tsx          # Root/depth/relation-type filters
│   └── GraphNodeInfoPanel.tsx
│
├── search/
│   ├── SearchInput.tsx
│   ├── FacetPanel.tsx
│   └── SearchResultCard.tsx
│
├── assistant/
│   ├── ChatMessageBubble.tsx
│   ├── CitationChip.tsx
│   └── ConversationHistoryList.tsx
│
├── comments/
│   ├── CommentThread.tsx
│   └── CommentComposer.tsx        # @mention-aware
│
├── notifications/
│   ├── NotificationBell.tsx       # Badge + dropdown preview
│   └── NotificationListItem.tsx
│
├── admin/
│   ├── PermissionMatrixTable.tsx
│   ├── UserTable.tsx
│   └── CategoryTreeManager.tsx
│
└── ui/                            # Design-system primitives (Tailwind-based)
    ├── Button.tsx, Input.tsx, Select.tsx, Dialog.tsx, Tooltip.tsx,
    ├── Table.tsx, Tabs.tsx, Toast.tsx, Skeleton.tsx, Avatar.tsx
```

`CategoryTree.tsx` (recursive tree renderer) lives in `components/document/` or a `components/library/` folder alongside `DocumentListRow`, shared between the Master Library browser and the `CategoryPicker` used in the editor.

## 3. NestJS Module Hierarchy (apps/api)

```
src/
├── main.ts
├── app.module.ts                        # Root module — imports every domain module
│
├── common/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts               # reads @Roles(...) metadata
│   │   └── document-access.guard.ts     # confidentiality + role + ownership check
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── audit-log.interceptor.ts     # writes AuditLog on mutating requests
│   │   └── response-envelope.interceptor.ts  # wraps list responses in {data, meta}
│   ├── filters/
│   │   └── http-exception.filter.ts     # normalizes error envelope
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   └── events/
│       └── domain-events.module.ts      # EventEmitter2 + Redis pub/sub bridge
│
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts              # login, refresh, token signing/rotation
│   │   └── strategies/jwt.strategy.ts
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   └── users.service.ts
│   │
│   ├── roles/
│   │   ├── roles.module.ts
│   │   ├── roles.controller.ts
│   │   ├── permissions.controller.ts
│   │   └── roles.service.ts             # exposes hasPermission(role, resource, action)
│   │
│   ├── categories/
│   │   ├── categories.module.ts
│   │   ├── categories.controller.ts
│   │   └── categories.service.ts        # tree read/write, code assignment helpers
│   │
│   ├── documents/
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts         # CRUD + status-transition state machine
│   │   ├── documents-code.service.ts    # KV-<code>-### sequence generation
│   │   └── documents-export.service.ts  # PDF/DOCX generation
│   │
│   ├── versions/
│   │   ├── versions.module.ts
│   │   ├── versions.controller.ts
│   │   ├── versions.service.ts          # create/restore
│   │   └── diff.service.ts              # compare algorithm
│   │
│   ├── tags/
│   │   ├── tags.module.ts
│   │   ├── tags.controller.ts
│   │   └── tags.service.ts
│   │
│   ├── relationships/
│   │   ├── relationships.module.ts
│   │   ├── relationships.controller.ts
│   │   ├── relationships.service.ts
│   │   └── graph.controller.ts          # /graph traversal endpoint
│   │
│   ├── comments/
│   │   ├── comments.module.ts
│   │   ├── comments.controller.ts
│   │   └── comments.service.ts          # mention parsing → notification events
│   │
│   ├── approvals/
│   │   ├── approvals.module.ts
│   │   ├── approvals.controller.ts
│   │   └── approvals.service.ts
│   │
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   └── notification-subscribers.ts  # @OnEvent listeners for document.*, comment.*, etc.
│   │
│   ├── search/
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── meilisearch.service.ts       # index sync + full-text query
│   │   └── indexing.consumer.ts         # BullMQ worker: reindex on document.approved etc.
│   │
│   ├── ai-assistant/
│   │   ├── ai-assistant.module.ts
│   │   ├── ai-assistant.controller.ts
│   │   ├── rag.service.ts               # retrieval scoping + prompt construction
│   │   ├── embeddings.service.ts        # OpenAI embeddings, vector store writes
│   │   └── openai.client.ts
│   │
│   ├── clients/
│   │   ├── clients.module.ts
│   │   ├── clients.controller.ts
│   │   └── clients.service.ts           # onboarding transaction (client + sub-tree)
│   │
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit.controller.ts
│   │   └── audit.service.ts
│   │
│   └── storage/
│       ├── storage.module.ts
│       └── storage.service.ts           # S3/R2 client, signed URL generation
│
└── prisma/
    ├── prisma.module.ts
    └── prisma.service.ts                 # PrismaClient lifecycle (onModuleInit/Destroy)
```

**Guard/Interceptor pipeline** (applied per request): `JwtAuthGuard` → `RolesGuard` → `DocumentAccessGuard` (resource-specific, only on document-scoped routes) → controller handler → `AuditLogInterceptor` (on mutating verbs) → `ResponseEnvelopeInterceptor` (on list endpoints) → `HttpExceptionFilter` (on error).

**Cross-module access pattern**: modules import each other's `*.module.ts` and depend only on the exported `*.service.ts` (e.g. `RelationshipsService` depends on `DocumentsService.findById`, never on `DocumentsModule`'s Prisma repository directly). This is the seam future modules (CRM, Project Management, etc.) plug into, alongside subscribing to `DomainEventsModule` events — consistent with the extensibility model in `01-system-architecture.md` §5.
