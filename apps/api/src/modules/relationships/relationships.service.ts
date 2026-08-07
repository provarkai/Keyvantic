import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRelationshipDto } from "./dto/create-relationship.dto";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { JwtUserPayload } from "@keyvantic/types";
import { TenantContext } from "../../common/tenant/tenant-context";

@Injectable()
export class RelationshipsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(sourceDocumentId: string, dto: CreateRelationshipDto, actor: JwtUserPayload) {
    const relationship = await this.prisma.documentRelationship.create({
      data: {
        tenantId: TenantContext.requireTenantId(),
        sourceDocumentId,
        targetDocumentId: dto.targetDocumentId,
        type: dto.type,
        note: dto.note,
      },
      include: { targetDocument: { select: { id: true, code: true, title: true, authorId: true } } },
    });

    await this.audit.log({
      actorId: actor.sub,
      action: "UPDATE",
      entityType: "DocumentRelationship",
      entityId: relationship.id,
      metadata: { sourceDocumentId, targetDocumentId: dto.targetDocumentId, type: dto.type },
    });

    if (dto.type === "DEPENDS_ON") {
      await this.notifications.notify({
        userId: relationship.targetDocument.authorId,
        type: "DEPENDENCY_CHANGED",
        title: `Your document ${relationship.targetDocument.code} now has a downstream dependent`,
        documentId: relationship.targetDocument.id,
      });
    }

    return relationship;
  }

  async remove(id: string, actor: JwtUserPayload) {
    await this.prisma.documentRelationship.delete({ where: { id } });
    await this.audit.log({ actorId: actor.sub, action: "DELETE", entityType: "DocumentRelationship", entityId: id });
    return { success: true };
  }

  /** Full relationship graph for the Graph View — nodes + typed, directed edges. */
  async graph(categoryId?: string) {
    const documents = await this.prisma.document.findMany({
      where: { deletedAt: null, ...(categoryId ? { categoryId } : {}) },
      select: { id: true, code: true, title: true, status: true, categoryId: true, category: { select: { name: true } } },
    });
    const documentIds = new Set(documents.map((d) => d.id));

    const edges = await this.prisma.documentRelationship.findMany({
      where: {
        OR: [{ sourceDocumentId: { in: [...documentIds] } }, { targetDocumentId: { in: [...documentIds] } }],
      },
    });

    return {
      nodes: documents.map((d) => ({
        id: d.id,
        code: d.code,
        title: d.title,
        status: d.status,
        category: d.category.name,
        categoryId: d.categoryId,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.sourceDocumentId,
        target: e.targetDocumentId,
        type: e.type,
      })),
    };
  }
}
