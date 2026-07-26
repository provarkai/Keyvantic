import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { DecideApprovalDto } from "./dto/decide-approval.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";
import type { JwtUserPayload } from "@keyvantic/types";

@Injectable()
export class ApprovalsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private audit: AuditService,
  ) {}

  async pendingForReviewer(actor: JwtUserPayload) {
    return this.prisma.approval.findMany({
      where: { reviewerId: actor.sub, decision: "PENDING" },
      include: {
        document: { select: { id: true, code: true, title: true, category: { select: { name: true } } } },
        documentVersion: { select: { versionNumber: true, changeSummary: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async historyForDocument(documentId: string) {
    return this.prisma.approval.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      include: { reviewer: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async decide(approvalId: string, dto: DecideApprovalDto, actor: JwtUserPayload) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { document: true },
    });
    if (!approval) throw new NotFoundException("Approval not found");
    if (approval.reviewerId !== actor.sub && !actor.permissions.includes("document:approve")) {
      throw new ForbiddenException("You are not the assigned reviewer for this approval");
    }

    const updated = await this.prisma.approval.update({
      where: { id: approvalId },
      data: { decision: dto.decision, comment: dto.comment, decidedAt: new Date() },
    });

    if (dto.decision === "APPROVED") {
      await this.prisma.document.update({ where: { id: approval.documentId }, data: { status: "APPROVED" } });
      await this.notifications.notify({
        userId: approval.document.authorId,
        type: "DOCUMENT_APPROVED",
        title: `${approval.document.code} was approved`,
        body: dto.comment,
        documentId: approval.documentId,
      });
    } else if (dto.decision === "REJECTED" || dto.decision === "CHANGES_REQUESTED") {
      await this.prisma.document.update({ where: { id: approval.documentId }, data: { status: "DRAFT" } });
      await this.notifications.notify({
        userId: approval.document.authorId,
        type: "DOCUMENT_CHANGED",
        title: `${approval.document.code} needs changes`,
        body: dto.comment,
        documentId: approval.documentId,
      });
    }

    await this.audit.log({
      actorId: actor.sub,
      action: "STATUS_CHANGE",
      entityType: "Approval",
      entityId: approvalId,
      metadata: { decision: dto.decision, comment: dto.comment },
    });

    return updated;
  }
}
