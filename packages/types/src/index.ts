// Shared enums & DTO-shaped types used by both apps/api and apps/web.
// Kept dependency-free (no Prisma import) so the web app can bundle it
// without pulling in server-only code.

export enum RoleName {
  ADMINISTRATOR = "ADMINISTRATOR",
  PARTNER = "PARTNER",
  CONSULTANT = "CONSULTANT",
  RESEARCHER = "RESEARCHER",
  DESIGNER = "DESIGNER",
  SALES = "SALES",
  MARKETING = "MARKETING",
  GUEST = "GUEST",
}

export enum DocumentStatus {
  DRAFT = "DRAFT",
  INTERNAL_REVIEW = "INTERNAL_REVIEW",
  APPROVED = "APPROVED",
  ARCHIVED = "ARCHIVED",
}

export enum ConfidentialityLevel {
  PUBLIC = "PUBLIC",
  INTERNAL = "INTERNAL",
  CONFIDENTIAL = "CONFIDENTIAL",
  RESTRICTED = "RESTRICTED",
}

export enum RelationshipType {
  RELATES_TO = "RELATES_TO",
  DEPENDS_ON = "DEPENDS_ON",
  DERIVED_FROM = "DERIVED_FROM",
  SUPERSEDES = "SUPERSEDES",
  REFERENCES = "REFERENCES",
}

export enum ApprovalDecision {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CHANGES_REQUESTED = "CHANGES_REQUESTED",
}

export enum NotificationType {
  DOCUMENT_APPROVED = "DOCUMENT_APPROVED",
  REVIEW_DUE = "REVIEW_DUE",
  DOCUMENT_CHANGED = "DOCUMENT_CHANGED",
  COMMENT_ADDED = "COMMENT_ADDED",
  DEPENDENCY_CHANGED = "DEPENDENCY_CHANGED",
  MENTION = "MENTION",
  SUBMITTED_FOR_REVIEW = "SUBMITTED_FOR_REVIEW",
}

export enum ExportFormat {
  PDF = "PDF",
  MARKDOWN = "MARKDOWN",
  DOCX = "DOCX",
  HTML = "HTML",
}

export const PERMISSION_ACTIONS = [
  "document:create",
  "document:read",
  "document:update",
  "document:delete",
  "document:submit_review",
  "document:approve",
  "document:archive",
  "document:export",
  "category:manage",
  "client:manage",
  "engagement:manage",
  "comment:create",
  "user:manage",
  "role:manage",
  "ai:query",
  "search:semantic",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Default permission matrix seeded for each role. Admin-configurable at runtime via RolePermission rows. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionAction[]> = {
  [RoleName.ADMINISTRATOR]: [...PERMISSION_ACTIONS],
  [RoleName.PARTNER]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:approve", "document:archive", "document:export", "category:manage",
    "client:manage", "engagement:manage", "comment:create", "ai:query", "search:semantic",
  ],
  [RoleName.CONSULTANT]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:export", "client:manage", "engagement:manage", "comment:create", "ai:query", "search:semantic",
  ],
  [RoleName.RESEARCHER]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:export", "comment:create", "ai:query", "search:semantic",
  ],
  [RoleName.DESIGNER]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:export", "comment:create", "ai:query",
  ],
  [RoleName.SALES]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:export", "client:manage", "comment:create", "ai:query",
  ],
  [RoleName.MARKETING]: [
    "document:create", "document:read", "document:update", "document:submit_review",
    "document:export", "comment:create", "ai:query",
  ],
  [RoleName.GUEST]: ["document:read"],
};

export enum EngagementAccessLevel {
  LEAD = "LEAD",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
  /** An ethical wall: an explicit block that overrides any role permission held. */
  DENIED = "DENIED",
}

export interface JwtUserPayload {
  sub: string;
  /** The tenant this session is scoped to. Drives Row-Level Security on every query. */
  tenantId: string;
  email: string;
  role: RoleName;
  permissions: PermissionAction[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorShape {
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}

/** KV-<CATEGORY_CODE>-<sequence, zero padded to 3> e.g. KV-BS-001 */
export function formatDocumentCode(categoryCode: string, sequence: number): string {
  return `KV-${categoryCode.toUpperCase()}-${String(sequence).padStart(3, "0")}`;
}

export function estimateReadTimeMinutes(wordCount: number, wordsPerMinute = 200): number {
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
