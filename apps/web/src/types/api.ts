import type { ConfidentialityLevel, DocumentStatus, RelationshipType } from "@keyvantic/types";

export interface UserSummary {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface CategorySummary {
  id: string;
  name: string;
  code: string;
}

export interface TagRef {
  tag: { id: string; name: string; slug: string };
}

export interface DocumentSummary {
  id: string;
  code: string;
  title: string;
  summary?: string | null;
  status: DocumentStatus;
  confidentiality: ConfidentialityLevel;
  category: CategorySummary;
  author: UserSummary;
  approver?: UserSummary | null;
  tags: TagRef[];
  readTimeMinutes: number;
  reviewDate?: string | null;
  currentVersionNumber: number;
  updatedAt: string;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  versions: { versionNumber: number; contentMarkdown: string; contentHtml: string }[];
  relationshipsFrom: { id: string; type: RelationshipType; targetDocument: { id: string; code: string; title: string; status: DocumentStatus } }[];
  relationshipsTo: { id: string; type: RelationshipType; sourceDocument: { id: string; code: string; title: string; status: DocumentStatus } }[];
  approvals: { id: string; decision: string; comment?: string | null; createdAt: string; reviewer: { id: string; fullName: string } }[];
  wordCount: number;
  viewCount: number;
  _count: { comments: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CategoryNode {
  id: string;
  name: string;
  code: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
  _count: { documents: number };
}

export interface DashboardStats {
  totalDocuments: number;
  byCategory: { categoryId: string; categoryName: string; count: number }[];
  recentEdits: (DocumentSummary & { author: UserSummary })[];
  awaitingApproval: (DocumentSummary & { approver?: UserSummary | null })[];
  recentlyViewed: { id: string; code: string; title: string; status: DocumentStatus }[];
  upcomingReviews: DocumentSummary[];
  activityFeed: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    actor?: { fullName: string } | null;
  }[];
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  contentMarkdown: string;
  contentHtml: string;
  changeSummary?: string | null;
  wordCount: number;
  isRestoreOf?: number | null;
  createdAt: string;
  author: UserSummary;
}

export interface GraphNode {
  id: string;
  code: string;
  title: string;
  status: DocumentStatus;
  category: string;
  categoryId: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  readAt?: string | null;
  createdAt: string;
  document?: { id: string; code: string; title: string } | null;
}

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  resolvedAt?: string | null;
  author: UserSummary;
  replies: CommentItem[];
}
