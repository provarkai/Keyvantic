# UI / UX Wireframes

## 1. Visual Identity

KOS uses a professional consulting aesthetic: restrained, confident, and quiet, so the content (client work, frameworks, research) is what stands out.

| Token | Light Theme | Dark Theme |
|---|---|---|
| Primary background | `#FFFFFF` | `#0F1419` (near-black charcoal) |
| Secondary background (panels/sidebar) | `#F5F6F8` | `#161B22` |
| Primary text | `#1B2430` (charcoal-navy) | `#E6E9ED` |
| Secondary text | `#5B6472` | `#9AA4B2` |
| Border/divider | `#E2E5EA` | `#262D38` |
| Accent (single accent color) | `#C9A227` (muted gold) | `#D4B84A` (slightly brighter gold for contrast) |
| Alternative accent option | `#1F4E79` (deep navy-blue) | `#4C86C4` |
| Success | `#2E7D5B` | `#4FAE85` |
| Warning | `#B8862B` | `#D9A441` |
| Danger | `#B23B3B` | `#E06565` |
| Status: Draft | Neutral gray chip | Neutral gray chip |
| Status: Internal Review | Amber/gold chip | Amber/gold chip |
| Status: Approved | Success green chip | Success green chip |
| Status: Archived | Muted gray-blue chip | Muted gray-blue chip |

**Typography**: a single clean sans-serif family throughout (e.g. Inter / Söhne-like), with a restrained type scale — one display size for page titles, one heading size, one body size, one small/meta size. No decorative fonts. Generous line-height (1.5+) for document bodies.

**Spacing**: generous whitespace; base spacing unit of 4px scaling to 8/16/24/32/48px gaps between regions. Content max-width capped (~1200-1280px) on wide desktop screens so document reading width stays comfortable regardless of viewport.

**Iconography**: a single consistent icon set (outline style, 1.5-2px stroke), used sparingly — icons support labels, they don't replace them in primary navigation.

**Both themes are first-class** — theme is a user preference (persisted per-user), not just a system-preference mirror, with a toggle in the TopBar/Account menu.

---

## 2. Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar: [Keyvantic KOS logo]   [Command Palette / Search ⌘K]  [🔔] [👤▾] │
├───────────┬────────────────────────────────────────────────────────────┤
│ Sidebar   │  Welcome back, Olumuyiwa            [Theme: ☀/🌙]           │
│           │                                                            │
│ Dashboard │  ┌ Quick Stats ─────────────────────────────────────────┐  │
│ Library   │  │ [My Drafts: 3] [Pending Review: 2] [Approvals Due: 1]│  │
│ Search    │  └───────────────────────────────────────────────────────┘ │
│ Graph     │                                                            │
│ Assistant │  ┌ My Pending Approvals ───────┐ ┌ Recently Viewed ──────┐│
│ Clients   │  │ KV-BS-014  Strategy Deck    │ │ KV-AD-032 Client memo ││
│           │  │ KV-CL-091  Discovery Notes  │ │ KV-RS-008 Research    ││
│ ─────     │  └──────────────────────────────┘ └─────────────────────┘│
│ Admin     │                                                            │
│           │  ┌ Favorites ──────────────────┐ ┌ Activity Feed ────────┐│
│           │  │ [DocumentCard] [DocumentCard]│ │ Partner approved      ││
│           │  │ [DocumentCard]               │ │ KV-BS-011 · 2h ago    ││
│           │  └──────────────────────────────┘ └─────────────────────┘│
└───────────┴────────────────────────────────────────────────────────────┘
```

- **Layout regions**: fixed TopBar (search, notifications, account/theme), collapsible left Sidebar (primary nav + Admin section gated by role), scrollable main content in a responsive grid of cards.
- **Key components**: `StatCard`, `DocumentCard`, `ActivityFeedItem`, `NotificationBell`, `CommandPalette`.
- **Responsive**: tablet collapses stat cards to 2-column, sidebar becomes an overlay drawer; mobile stacks everything single-column, TopBar search collapses to an icon that opens full-screen search.

---

## 3. Master Library Browser (Tree + List)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar                                                                    │
├───────────┬───────────────────┬──────────────────────────────────────────┤
│ Sidebar   │ Category Tree     │ Document List (for selected category)     │
│           │                   │                                            │
│           │ ▾ 01 Strategy     │ [Filter bar: Status ▾ | Tag ▾ | Sort ▾]   │
│           │   ▸ Frameworks    │                                            │
│           │   ▸ Playbooks     │ ┌────────────────────────────────────────┐│
│           │ ▸ 02 Brand        │ │ KV-BS-001  Business Strategy Framework ││
│           │ ▸ 03 Advisory     │ │ [DRAFT]      Author: J. Smith  Jul 20  ││
│           │ ▸ 04 Research     │ ├────────────────────────────────────────┤│
│           │ ▾ 09 Clients      │ │ KV-BS-002  Market Entry Playbook       ││
│           │   ▾ Acme Corp     │ │ [APPROVED]   Author: A. Lee   Jul 18   ││
│           │     Company...    │ ├────────────────────────────────────────┤│
│           │     Discovery...  │ │ KV-BS-003  Pricing Strategy Template   ││
│           │     Deliverables  │ │ [INTERNAL_REVIEW] Author: T. Chen      ││
│           │     ...           │ └────────────────────────────────────────┘│
│           │                   │ [+ New Document in this category]         │
└───────────┴───────────────────┴──────────────────────────────────────────┘
```

- **Layout regions**: three-pane on desktop — nav sidebar, category tree pane, document list pane. Selecting a tree node filters the list; breadcrumb above the list shows full path (e.g. `09 Clients / Acme Corp / Deliverables`).
- **Key components**: `CategoryTree` (recursive, expand/collapse, drag-to-reorder for admins), `DocumentListRow`, `StatusBadge`, `FilterBar`.
- **Responsive**: tablet collapses to two-pane (tree becomes a slide-over triggered by a breadcrumb/menu button); mobile shows one pane at a time (tree → tapping a leaf pushes to the list view, back button returns).

---

## 4. Document Detail View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: 01 Strategy / Frameworks                     [Export ▾] [⋮]  │
│ KV-BS-001  Business Strategy Framework          [DRAFT]  [★ Favorite]    │
│ Author: J. Smith · v3 · Updated 2 days ago · Confidentiality: INTERNAL   │
├───────────────────────────────┬──────────────────────────────────────────┤
│ Tabs: [Content] [Versions]    │ Right Rail                                │
│ [Comments (4)] [Relationships]│  ┌ Metadata ─────────────────────────┐   │
│ [Approvals] [Activity]        │  │ Category, Tags, Client, Owner      │   │
│                               │  └─────────────────────────────────────┘  │
│  ── rendered rich-text        │  ┌ Related Documents ─────────────────┐  │
│     document content ──       │  │ → KV-BS-002 (REFERENCES)          │   │
│                               │  │ ← KV-CL-091 (DERIVED_FROM)        │   │
│                               │  └─────────────────────────────────────┘  │
│                               │  ┌ Reviewers / Approvals status ──────┐ │
│                               │  │ ✔ A. Lee — Approved                │ │
│                               │  │ ⏳ T. Chen — Pending                │ │
│                               │  └─────────────────────────────────────┘  │
├───────────────────────────────┴──────────────────────────────────────────┤
│ [Submit for Review]  [Edit]  (buttons contextual to status + permission) │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Key components**: `StatusBadge`, `TabBar`, rendered content pane (read-only Tiptap output), `MetadataPanel`, `RelationshipList`, `ApprovalStatusList`, `CommentThread` (in Comments tab), action buttons gated by `RoleGuard`/ownership.
- **Responsive**: tablet stacks the right rail below content; mobile collapses tabs into a horizontally scrollable pill row and hides the right rail behind an "Info" sheet.

---

## 5. Document Editor

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [< Back]  Editing: KV-BS-001 (Draft)         [Autosave: Saved ✓] [Save] │
├──────────────────────────────────────────────────────────────────────────┤
│ Title: [Business Strategy Framework________________]                     │
│ Category: [01 Strategy / Frameworks ▾]  Tags: [strategy][framework][+]   │
├──────────────────────────────────────────────────────────────────────────┤
│ Toolbar: [B][I][U] [H1][H2] [• List][1.List] [Link] [Image] [Table]     │
│          [Diagram/Flowchart] [Video Embed] [PDF Embed] [Footnote]       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│               Rich text editing surface (Tiptap)                        │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────┤
│ Change summary (optional): [What changed in this version?___________]   │
│                                            [Cancel]  [Save as Draft]     │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Key components**: `RichEditor` (Tiptap-based), `EditorToolbar`, `TagInput`, `CategoryPicker`, autosave indicator, change-summary field feeding `DocumentVersion.changeSummary`.
- **Responsive**: tablet keeps the toolbar but wraps into two rows; mobile uses a minimal toolbar (bold/italic/lists/link) with advanced blocks (diagram, video, PDF embed, tables) accessible via a "+" insert menu rather than a persistent toolbar row, since fine-grained editing of those blocks is desktop-oriented.

---

## 6. Version History / Diff View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ KV-BS-001 — Version History                                              │
├───────────────────┬──────────────────────────────────────────────────────┤
│ Version Timeline   │ Diff Viewer                                          │
│                     │                                                      │
│ ● v4 (current)      │  Comparing v2 → v4                                   │
│   J. Smith, Jul 24  │  ┌────────────────────────────────────────────────┐ │
│ ● v3                │  │ - Removed: "Legacy pricing model section"     │ │
│   J. Smith, Jul 22  │  │ + Added: "Value-based pricing framework"      │ │
│ ● v2  [compare from]│  │   Changed: paragraph 3 rewritten               │ │
│   A. Lee, Jul 18    │  └────────────────────────────────────────────────┘ │
│ ● v1  [compare to]  │  [Restore this version ▾]  (shown per compared v)   │
│   A. Lee, Jul 15    │                                                      │
└───────────────────┴──────────────────────────────────────────────────────┘
```

- **Key components**: `VersionTimeline` (selectable pair for comparison), `DiffViewer` (inline add/remove/change highlighting), restore action with confirmation dialog.
- **Responsive**: tablet/mobile stack timeline above diff viewer; on mobile the timeline collapses to a dropdown selector for "from"/"to" versions instead of a visual rail.

---

## 7. Search Results

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [🔍 "ai transformation roadmap"        ] [Full-text | Semantic ●]  [X]   │
├───────────┬────────────────────────────────────────────────────────────┤
│ Facets    │ Results (128)                                    [Sort: Relevance▾]│
│ Category  │ ┌────────────────────────────────────────────────────────┐ │
│ ☑ Strategy│ │ KV-CL-091  Acme Corp — Transformation Roadmap  [APPROVED]│ │
│ ☐ Research│ │ "...our recommended AI transformation roadmap begins..." │ │
│           │ ├────────────────────────────────────────────────────────┤ │
│ Status    │ │ KV-RS-014  AI Readiness Research Brief         [APPROVED]│ │
│ ☑ Approved│ │ "...framework for assessing AI transformation..."        │ │
│           │ └────────────────────────────────────────────────────────┘ │
│ Client    │ [Load more / Pagination]                                   │
│ Tag       │                                                              │
└───────────┴────────────────────────────────────────────────────────────┘
```

- **Key components**: `SearchInput` with mode toggle (full-text/semantic), `FacetPanel`, `SearchResultCard` with highlighted snippet, pagination.
- **Responsive**: mobile moves facets into a "Filters" sheet triggered by a button above the results list.

---

## 8. Graph View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Graph View        [Root: KV-BS-001 ▾] [Depth: 2 ▾] [Relation type: All ▾]│
├───────────┬────────────────────────────────────────────────────────────┤
│ Legend    │                                                              │
│ ● REFERENCES        ○ ── node = document, sized/colored by category      │
│ ● SUPERSEDES              ╱ ╲                                           │
│ ● DERIVED_FROM          ○     ○                                          │
│ ● DEPENDS_ON              ╲   ╱                                          │
│ ● PART_OF                  ○ (root, highlighted)                        │
│           │                   ╱   ╲                                     │
│ Node info │                  ○      ○                                    │
│ panel     │                                                              │
│ (on select)│  [Zoom controls +/-]  [Reset view]  [Export PNG]           │
└───────────┴────────────────────────────────────────────────────────────┘
```

- **Key components**: `GraphCanvas` (force-directed layout, click node to open side info panel with title/status/link to Document Detail, hover to preview edge relation type), root/depth/relation-type controls, legend.
- **Responsive**: tablet keeps canvas full-width with controls collapsed into a toolbar overflow menu; mobile graph view is view-only with pinch-zoom/pan, node tap opens a bottom sheet instead of a side panel (full editing/creation of relationships is desktop-first).

---

## 9. AI Assistant Chat

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AI Assistant                                          [New Conversation] │
├───────────┬────────────────────────────────────────────────────────────┤
│ History   │  User: What's our standard AI transformation roadmap?       │
│ ─────     │                                                              │
│ Today     │  Assistant: Our standard roadmap has four phases: Discovery,│
│ "AI roadm-│  Quick Wins, Scale, and Sustain... [1] [2]                  │
│  ap ques-"│                                                              │
│ Yesterday │  Citations:                                                  │
│ "Pricing  │  [1] KV-CL-091 — Acme Corp Transformation Roadmap (v3)      │
│  strategy"│  [2] KV-RS-014 — AI Readiness Research Brief (v2)           │
│           │                                                              │
│           │  ┌────────────────────────────────────────────────────────┐│
│           │  │ Ask a follow-up question...                    [Send] ││
│           │  └────────────────────────────────────────────────────────┘│
└───────────┴────────────────────────────────────────────────────────────┘
```

- **Key components**: `ConversationHistoryList`, `ChatMessageBubble` (user/assistant), inline `CitationChip` linking to Document Detail at the cited version, message composer with send/loading state.
- **Responsive**: tablet/mobile hide the history rail behind a menu button; composer stays pinned to the bottom (mobile keyboard-aware).

---

## 10. Admin / Roles Settings

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Admin Settings                                                            │
├───────────┬────────────────────────────────────────────────────────────┤
│ Users     │ Permission Matrix                                            │
│ Roles &   │                                                              │
│ Permissions│ Resource      │ Admin │ Partner │ Consultant │ ... │ Guest │
│ Categories │ Document.Read │  ✔    │   ✔     │    ✔       │     │  ○    │
│ Audit Log  │ Document.Write│  ✔    │   ✔     │    ✔       │     │  ✘    │
│           │ Document.Publish│ ✔   │   ✔     │    ✘       │     │  ✘    │
│           │ Client.Read    │  ✔    │   ✔     │    ✔       │     │  ✘    │
│           │ ... (scrollable matrix, toggle cells) [Save Changes]        │
└───────────┴────────────────────────────────────────────────────────────┘
```

- **Key components**: `AdminNav`, `PermissionMatrixTable` (toggleable cells, saved via `PUT /permissions/:roleId`), `UserTable` with role-assignment dropdown, `CategoryManager` (drag-reorder tree editor), `AuditLogTable` with filters.
- **Responsive**: the permission matrix is desktop-oriented (wide table); tablet allows horizontal scroll within the table container; mobile presents it as one role at a time in an accordion rather than a full matrix, to keep touch targets usable.

---

## 11. Cross-Screen Responsive Principles

- **Desktop (≥1280px)**: multi-pane layouts (sidebar + content + right rail) as shown above.
- **Tablet (768-1279px)**: one pane collapses to an overlay/drawer; core content pane remains primary.
- **Mobile (<768px)**: single-column, bottom-sheet patterns for secondary panels, sticky action bar for primary CTA (Submit for Review, Save, Send), and simplified toolbars for content-heavy screens (Editor, Admin matrix).
- **Dark/light theme** applies uniformly across all screens above via the token table in §1; status badge colors keep sufficient contrast in both themes (verified against WCAG AA for text-on-badge).
