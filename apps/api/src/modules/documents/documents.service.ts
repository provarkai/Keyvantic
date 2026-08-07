import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { QueryDocumentsDto } from "./dto/query-documents.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import { SearchService } from "../search/search.service";
import type { JwtUserPayload } from "@keyvantic/types";
import { estimateReadTimeMinutes, formatDocumentCode } from "@keyvantic/types";
import { DocumentStatus, PrismaClient } from "@prisma/client";
import { AccessService } from "../../common/access/access.service";
import { TenantContext } from "../../common/tenant/tenant-context";

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ARCHIVED", "INTERNAL_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

function wordCount(markdown: string) {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

function slugifyTag(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const DOCUMENT_LIST_INCLUDE = {
  category: { select: { id: true, name: true, code: true } },
  author: { select: { id: true, fullName: true, avatarUrl: true } },
  approver: { select: { id: true, fullName: true, avatarUrl: true } },
  tags: { include: { tag: true } },
};

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private search: SearchService,
    private access: AccessService,
  ) {}

  /**
   * Allocate the next document code for a category.
   *
   * Uses a persisted counter rather than a row count. Counting raced under concurrent
   * creates, and — worse — went backwards after a delete, so the next create collided
   * with an existing code and violated the unique constraint.
   *
   * Must run inside `tenantTransaction` so the increment and the insert that consumes
   * it commit together.
   */
  private async nextCode(tx: PrismaClient, tenantId: string, categoryId: string) {
    const category = await tx.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException("Category not found");

    const sequence = await tx.documentSequence.upsert({
      where: { tenantId_categoryId: { tenantId, categoryId } },
      update: { lastValue: { increment: 1 } },
      create: { tenantId, categoryId, lastValue: 1 },
    });

    return { code: formatDocumentCode(category.code, sequence.lastValue), category };
  }

  private async syncTags(documentId: string, tagNames: string[] | undefined) {
    if (!tagNames) return;
    const tenantId = TenantContext.requireTenantId();
    await this.prisma.documentTag.deleteMany({ where: { documentId } });
    for (const name of tagNames) {
      const slug = slugifyTag(name);
      const tag = await this.prisma.tag.upsert({
        where: { tenantId_slug: { tenantId, slug } },
        update: {},
        create: { tenantId, name, slug },
      });
      await this.prisma.documentTag.create({
        data: { tenantId, documentId, tagId: tag.id },
      });
    }
  }

  async create(dto: CreateDocumentDto, actor: JwtUserPayload) {
    const tenantId = TenantContext.requireTenantId();
    const markdown = dto.contentMarkdown ?? `# ${dto.title}\n\n`;
    const wc = wordCount(markdown);

    // Filing against an engagement puts the document behind that engagement's
    // confidentiality boundary, so the actor has to be on the team to do it.
    if (dto.engagementId) {
      await this.access.requireEngagementWriteAccess(dto.engagementId, actor);
    }

    const document = await this.prisma.tenantTransaction(async (tx) => {
      const { code } = await this.nextCode(tx, tenantId, dto.categoryId);

      const doc = await tx.document.create({
        data: {
          tenantId,
          code,
          title: dto.title,
          summary: dto.summary,
          categoryId: dto.categoryId,
          engagementId: dto.engagementId,
          authorId: actor.sub,
          confidentiality: dto.confidentiality,
          reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
          readTimeMinutes: estimateReadTimeMinutes(wc),
          wordCount: wc,
        },
      });

      await tx.documentVersion.create({
        data: {
          tenantId,
          documentId: doc.id,
          versionNumber: 1,
          contentMarkdown: markdown,
          contentHtml: `<p>${dto.title}</p>`,
          authorId: actor.sub,
          wordCount: wc,
          changeSummary: "Initial draft",
        },
      });

      return doc;
    });

    await this.syncTags(document.id, dto.tags);
    await this.audit.log({ actorId: actor.sub, action: "CREATE", entityType: "Document", entityId: document.id });
    await this.search.indexDocument(document.id);

    return this.findById(document.id, actor);
  }

  async list(query: QueryDocumentsDto, actor: JwtUserPayload) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    // Caller filters can only narrow what the predicate already allows — they are
    // ANDed with it, never substituted for it.
    const where = await this.access.documentWhereWithFilters(actor, {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.engagementId ? { engagementId: query.engagementId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.confidentiality ? { confidentiality: query.confidentiality } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    });

    const [data, total] = await this.prisma.tenantTransaction(async (tx) => [
      await tx.document.findMany({
        where,
        include: DOCUMENT_LIST_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      await tx.document.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findById(id: string, actor?: JwtUserPayload) {
    // Without an actor this is an internal lookup (indexing, notifications). Callers
    // that serve a user must pass one — the predicate is what stops a direct fetch by
    // id from returning a document the requester may not read.
    const visibility = actor ? await this.access.documentWhere(actor) : { deletedAt: null };

    const document = await this.prisma.document.findFirst({
      where: { AND: [{ id }, visibility] },
      include: {
        ...DOCUMENT_LIST_INCLUDE,
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        relationshipsFrom: { include: { targetDocument: { select: { id: true, code: true, title: true, status: true } } } },
        relationshipsTo: { include: { sourceDocument: { select: { id: true, code: true, title: true, status: true } } } },
        approvals: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { id: true, fullName: true } } } },
        _count: { select: { comments: true } },
      },
    });
    if (!document) throw new NotFoundException("Document not found");

    if (actor) {
      await this.prisma.recentlyViewed.upsert({
        where: { userId_documentId: { userId: actor.sub, documentId: id } },
        update: { viewedAt: new Date() },
        create: { tenantId: document.tenantId, userId: actor.sub, documentId: id },
      });
      await this.prisma.document.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    }

    return document;
  }

  async update(id: string, dto: UpdateDocumentDto, actor: JwtUserPayload) {
    const existing = await this.findById(id);
    const document = await this.prisma.document.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        categoryId: dto.categoryId,
        approverId: dto.approverId,
        confidentiality: dto.confidentiality,
        reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
      },
    });
    await this.syncTags(id, dto.tags);
    await this.audit.log({
      actorId: actor.sub,
      action: "UPDATE",
      entityType: "Document",
      entityId: id,
      metadata: { before: existing.title, after: document.title },
    });
    await this.search.indexDocument(id);
    return this.findById(id, actor);
  }

  async remove(id: string, actor: JwtUserPayload) {
    await this.prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ actorId: actor.sub, action: "DELETE", entityType: "Document", entityId: id });
    await this.search.removeDocument(id);
    return { success: true };
  }

  async changeStatus(id: string, next: DocumentStatus, comment: string | undefined, actor: JwtUserPayload) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException("Document not found");

    const allowed = ALLOWED_TRANSITIONS[document.status];
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Cannot move document from ${document.status} to ${next}`);
    }
    if (next === "APPROVED" && !actor.permissions.includes("document:approve")) {
      throw new ForbiddenException("You do not have permission to approve documents");
    }

    const updated = await this.prisma.document.update({ where: { id }, data: { status: next } });

    if (next === "INTERNAL_REVIEW") {
      const latestVersion = await this.prisma.documentVersion.findFirst({
        where: { documentId: id },
        orderBy: { versionNumber: "desc" },
      });
      if (latestVersion && document.approverId) {
        await this.prisma.approval.create({
          data: {
          tenantId: document.tenantId,
          documentId: id,
          documentVersionId: latestVersion.id,
          reviewerId: document.approverId,
        },
        });
        await this.notifications.notify({
          userId: document.approverId,
          type: "SUBMITTED_FOR_REVIEW",
          title: `${document.code} submitted for review`,
          body: comment,
          documentId: id,
        });
      }
    }

    if (next === "APPROVED") {
      await this.prisma.approval.updateMany({
        where: { documentId: id, decision: "PENDING" },
        data: { decision: "APPROVED", decidedAt: new Date(), comment },
      });
      await this.notifications.notify({
        userId: document.authorId,
        type: "DOCUMENT_APPROVED",
        title: `${document.code} was approved`,
        body: comment,
        documentId: id,
      });
      await this.notifyDependents(id, document.code);
    }

    await this.audit.log({
      actorId: actor.sub,
      action: "STATUS_CHANGE",
      entityType: "Document",
      entityId: id,
      metadata: { from: document.status, to: next, comment },
    });
    await this.search.indexDocument(id);

    return updated;
  }

  private async notifyDependents(documentId: string, code: string) {
    const dependents = await this.prisma.documentRelationship.findMany({
      where: { targetDocumentId: documentId, type: "DEPENDS_ON" },
      include: { sourceDocument: { select: { id: true, authorId: true, code: true } } },
    });
    for (const rel of dependents) {
      await this.notifications.notify({
        userId: rel.sourceDocument.authorId,
        type: "DEPENDENCY_CHANGED",
        title: `${code} changed — ${rel.sourceDocument.code} depends on it`,
        documentId: rel.sourceDocument.id,
      });
    }
  }

  async dashboardStats(actor: JwtUserPayload) {
    // The dashboard counted every document in the firm regardless of who was asking,
    // which leaked both engagement existence and volume. Everything here is now scoped
    // to what the actor may actually read.
    const visible = await this.access.documentWhere(actor);

    const byCategoryRaw = await this.prisma.document.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
      where: visible,
      orderBy: { categoryId: "asc" },
    });

    const [
      totalDocuments,
      recentEdits,
      awaitingApproval,
      recentlyViewed,
      upcomingReviews,
    ] = await this.prisma.tenantTransaction(async (tx) => [
      await tx.document.count({ where: visible }),
      await tx.document.findMany({
        where: visible,
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { author: { select: { fullName: true } } },
      }),
      await tx.document.findMany({
        where: { AND: [visible, { status: "INTERNAL_REVIEW" }] },
        orderBy: { updatedAt: "asc" },
        take: 8,
        include: { author: { select: { fullName: true } }, approver: { select: { fullName: true } } },
      }),
      await tx.recentlyViewed.findMany({
        where: { userId: actor.sub, document: visible },
        orderBy: { viewedAt: "desc" },
        take: 6,
        include: { document: { select: { id: true, code: true, title: true, status: true } } },
      }),
      await tx.document.findMany({
        where: {
          AND: [
            visible,
            {
              reviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
              status: { not: "ARCHIVED" },
            },
          ],
        },
        orderBy: { reviewDate: "asc" },
        take: 8,
      }),
    ]);

    const categories = await this.prisma.category.findMany({
      where: { id: { in: byCategoryRaw.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });
    const byCategory = byCategoryRaw.map((row) => ({
      categoryId: row.categoryId,
      categoryName: categories.find((c) => c.id === row.categoryId)?.name ?? "Unknown",
      count: row._count._all,
    }));

    const recentAudit = await this.audit.recent(20);

    return {
      totalDocuments,
      byCategory,
      recentEdits,
      awaitingApproval,
      recentlyViewed: recentlyViewed.map((r) => r.document),
      upcomingReviews,
      activityFeed: recentAudit,
    };
  }

  async toggleFavorite(documentId: string, actor: JwtUserPayload) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_documentId: { userId: actor.sub, documentId } },
    });
    if (existing) {
      await this.prisma.favorite.delete({ where: { userId_documentId: { userId: actor.sub, documentId } } });
      return { favorited: false };
    }
    await this.prisma.favorite.create({
      data: { tenantId: TenantContext.requireTenantId(), userId: actor.sub, documentId },
    });
    return { favorited: true };
  }

  async listFavorites(actor: JwtUserPayload) {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: actor.sub },
      include: { document: { include: DOCUMENT_LIST_INCLUDE } },
      orderBy: { createdAt: "desc" },
    });
    return favorites.map((f) => f.document);
  }
}
