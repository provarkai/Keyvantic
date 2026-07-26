# User Flows

## (a) Document Creation → Draft → Internal Review → Approval → Published

```mermaid
flowchart TD
    A["Consultant clicks 'New Document'\nin Master Library"] --> B["Select category (e.g. 03 Advisory)\nSystem previews next code: KV-AD-014"]
    B --> C["Fill title, summary, author content\n(Rich Editor)"]
    C --> D["Save → POST /documents\nStatus = DRAFT, Version 1 created"]
    D --> E{"Author ready\nto submit?"}
    E -- "No, keep editing" --> C
    E -- "Yes" --> F["POST /documents/:id/submit-for-review\nStatus → INTERNAL_REVIEW"]
    F --> G["Assign reviewer(s)\nApproval rows created (PENDING)"]
    G --> H["Notification sent to reviewer(s)\n(APPROVAL_REQUESTED)"]
    H --> I{"Reviewer decision"}
    I -- "Changes Requested" --> J["Status → DRAFT\nAuthor notified with comments"]
    J --> C
    I -- "Approved (all required approvals resolved)" --> K["Status → APPROVED\nemits document.approved"]
    K --> L["Search index updated (Meilisearch)\nEmbeddings generated for AI retrieval"]
    K --> M["Document now visible in\nSearch + AI Assistant results"]
    M --> N["Author + watchers notified\n(DOCUMENT_APPROVED)"]
```

**Notes**: submitting for review pins the reviewed content to the current `DocumentVersion` (via `Approval.versionId`), so if the author edits again before approval completes, a new version resets the review (status returns to `DRAFT`, new `Approval` cycle needed) — this prevents approving content the reviewer never actually saw.

## (b) Version Compare & Restore

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (Version Timeline)
    participant A as API

    U->>W: Open Document Detail → Version History tab
    W->>A: GET /documents/:id/versions
    A-->>W: [v1, v2, v3 ... vN] (metadata, author, date)
    U->>W: Select v2 and v4, click "Compare"
    W->>A: GET /documents/:id/versions/compare?from=2&to=4
    A->>A: Load content of both versions, compute structured diff
    A-->>W: { added: [...], removed: [...], changed: [...] }
    W->>U: Render Diff Viewer (inline additions/deletions)

    U->>W: Click "Restore v2"
    W->>U: Confirm dialog ("This creates a new version with v2's content")
    U->>W: Confirm
    W->>A: POST /documents/:id/versions/2/restore
    A->>A: Create version N+1 with v2's content\nUpdate Document.currentVersionId\nAuditLog entry\nStatus may reset to DRAFT if doc was APPROVED
    A-->>W: New version created
    W->>U: Redirect to updated Document Detail, banner:\n"Restored from Version 2 (now Version N+1)"
```

## (c) Full-Text / Semantic Search

```mermaid
flowchart TD
    A["User types query in\nCommand Palette / Search page"] --> B{"Query type toggle\n(default: Smart)"}
    B -- "Full-text (Meilisearch)" --> C["GET /search?q=...\nfilters: category, status, tag, client"]
    B -- "Semantic (AI-assisted)" --> D["GET /search/semantic?q=...\nEmbed query via OpenAI"]
    C --> E["API applies access filter:\nstatus in caller's allowed set\nAND confidentialityLevel <= caller clearance"]
    D --> E
    E --> F["Meilisearch keyword match\n(C) or vector similarity rank (D)"]
    F --> G["Results returned with\nfacet counts + highlighted snippets"]
    G --> H["User refines with facets\n(category, tag, client, status)"]
    H --> C
    G --> I["User clicks a result →\nDocument Detail View\n(recorded in RecentlyViewed)"]
```

## (d) AI Assistant Q&A Restricted to Approved Documents

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (Assistant Chat)
    participant A as API (ai-assistant module)
    participant M as Meilisearch/Vector store
    participant O as OpenAI API
    participant DB as PostgreSQL

    U->>W: "What's our standard approach to\nAI transformation roadmaps?"
    W->>A: POST /ai-assistant/query { question }
    A->>DB: Resolve caller's role, clearance, visible category/client scope
    A->>M: Vector search top-k chunks\nWHERE status='APPROVED'\nAND confidentialityLevel <= clearance\nAND category/client in scope
    M-->>A: Ranked chunks with documentId, versionNumber, text
    A->>A: Build grounded prompt:\nsystem instructions + retrieved chunks + question
    A->>O: Chat completion request
    O-->>A: Answer text
    A->>DB: Persist conversation turn + citations
    A-->>W: { answer, citations: [{documentCode, versionNumber, snippet}] }
    W->>U: Render answer with clickable citations\nlinking to Document Detail
```

If no approved, in-scope document contains relevant content, the assistant explicitly says so rather than answering from general model knowledge or from `DRAFT`/`ARCHIVED`/out-of-clearance material — this boundary is enforced server-side in the retrieval query, not just by prompt instructions (see `08-security-architecture.md` §6).

## (e) New Client Onboarding — Creating the Client Sub-Tree

```mermaid
flowchart TD
    A["PARTNER/ADMINISTRATOR opens\nClients → New Client"] --> B["Fill client name, industry,\nprimary contact, status=PROSPECT"]
    B --> C["POST /clients"]
    C --> D["Transaction:\n1. Create Client row"]
    D --> E["2. Create Category node\nunder '09 Clients' named after client"]
    E --> F["3. Create 7 fixed sub-nodes:\nCompany Profile, Discovery Notes,\nDeliverables, Reports, Meeting Notes,\nAI Opportunities, Transformation Roadmap"]
    F --> G["4. Link Client.rootCategoryId"]
    G --> H["emit client.created"]
    H --> I["Client now appears in\nMaster Library under 09 Clients\nand in Clients directory"]
    I --> J["Team can immediately create\ndocuments in any sub-node,\ne.g. KV-CL-<seq> under Discovery Notes"]
```

## (f) Notification Delivery — Approval / Review-Due / Comment / Dependency-Change

```mermaid
flowchart TD
    subgraph Triggers
        T1["Document submitted for review"]
        T2["Document.dueForReviewAt reached\n(scheduled job)"]
        T3["Comment created with @mention\nor on a watched document"]
        T4["Linked document's status changes\n(DocumentRelationship exists)"]
    end

    T1 --> E1["emit document.submitted"]
    T2 --> E2["emit document.review_due\n(cron worker scans dueForReviewAt)"]
    T3 --> E3["emit comment.created"]
    T4 --> E4["emit document.status_changed\n(checked against relationship graph)"]

    E1 --> N["Notifications Module\n(event subscriber)"]
    E2 --> N
    E3 --> N
    E4 --> N

    N --> R1["Resolve recipients:\nassigned approver / doc owner /\nmentioned user / watchers of linked doc"]
    R1 --> W1["Write Notification row\n(type, payload, userId)"]
    W1 --> P1["Push to Redis pub/sub channel\nfor the user's active session(s)"]
    P1 --> S1["Web app: SSE/poll updates\nNotificationBell badge count"]
    W1 --> P2["(Future) email digest worker\nreads unread Notifications periodically"]
```

Notification types map directly to the `Notification.type` enum: `APPROVAL_REQUESTED, DOCUMENT_APPROVED, REVIEW_DUE, COMMENT_MENTION, DEPENDENCY_CHANGED, DOCUMENT_ARCHIVED`. Because delivery is event-driven, future modules can add new trigger sources (e.g. a Project Management module emitting `task.assigned`) without changing the Notifications module itself — it already generically fans an event out to resolved recipients.
