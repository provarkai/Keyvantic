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
import { DocumentStatus } from "@prisma/client";

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
  ) {}

  private async nextCode(categoryId: string) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException("Category not found");

    const count = await this.prisma.document.count({ where: { categoryId } });
    return { code: formatDocumentCode(category.code, count + 1), category };
  }

  private async syncTags(documentId: string, tagNames: string[] | undefined) {
    if (!tagNames) return;
    await this.prisma.documentTag.deleteMany({ where: { documentId } });
    for (const name of tagNames) {
      const slug = slugifyTag(name);
      const tag = await this.prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name, slug },
      });
      await this.prisma.documentTag.create({ data: { documentId, tagId: tag.id } });
    }
  }

  async create(dto: CreateDocumentDto, actor: JwtUserPayload) {
    const { code } = await this.nextCode(dto.categoryId);
    const markdown = dto.contentMarkdown ?? `# ${dto.title}\n\n`;
    const wc = wordCount(markdown);

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          code,
          title: dto.title,
          summary: dto.summary,
          categoryId: dto.categoryId,
          authorId: actor.sub,
          confidentiality: dto.confidentiality,
          reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : undefined,
          readTimeMinutes: estimateReadTimeMinutes(wc),
          wordCount: wc,
        },
      });

      await tx.documentVersion.create({
        data: {
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

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.confidentiality ? { confidentiality: query.confidentiality } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    };

    if (actor.role === "GUEST") {
      where.confidentiality = "PUBLIC";
      where.status = "APPROVED";
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: DOCUMENT_LIST_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
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
    const document = await this.prisma.document.findFirst({
      where: { id, deletedAt: null },
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
        create: { userId: actor.sub, documentId: id },
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
          data: { documentId: id, documentVersionId: latestVersion.id, reviewerId: document.approverId },
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
    const byCategoryRaw = await this.prisma.document.groupBy({
      by: ["categoryId"],
      _count: { _all: true },
      where: { deletedAt: null },
      orderBy: { categoryId: "asc" },
    });

    const [
      totalDocuments,
      recentEdits,
      awaitingApproval,
      recentlyViewed,
      upcomingReviews,
    ] = await this.prisma.$transaction([
      this.prisma.document.count({ where: { deletedAt: null } }),
      this.prisma.document.findMany({
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { author: { select: { fullName: true } } },
      }),
      this.prisma.document.findMany({
        where: { status: "INTERNAL_REVIEW", deletedAt: null },
        orderBy: { updatedAt: "asc" },
        take: 8,
        include: { author: { select: { fullName: true } }, approver: { select: { fullName: true } } },
      }),
      this.prisma.recentlyViewed.findMany({
        where: { userId: actor.sub },
        orderBy: { viewedAt: "desc" },
        take: 6,
        include: { document: { select: { id: true, code: true, title: true, status: true } } },
      }),
      this.prisma.document.findMany({
        where: {
          deletedAt: null,
          reviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          status: { not: "ARCHIVED" },
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
    await this.prisma.favorite.create({ data: { userId: actor.sub, documentId } });
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
