import { Injectable, NotFoundException } from "@nestjs/common";
import { EngagementAccessLevel } from "@prisma/client";
import type { JwtUserPayload } from "@keyvantic/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AccessService } from "../../common/access/access.service";
import { AuditService } from "../audit/audit.service";
import { TenantContext } from "../../common/tenant/tenant-context";
import { CreateEngagementDto } from "./dto/create-engagement.dto";
import { SetMemberDto } from "./dto/set-member.dto";

@Injectable()
export class EngagementsService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private audit: AuditService,
  ) {}

  /** Engagements the actor can see: their own, plus all of them for partners/admins. */
  async list(actor: JwtUserPayload) {
    const scope = await this.access.scopeFor(actor);

    return this.prisma.engagement.findMany({
      where: {
        ...(scope.seesAllEngagements ? {} : { id: { in: scope.allowedEngagementIds } }),
        ...(scope.deniedEngagementIds.length
          ? { NOT: { id: { in: scope.deniedEngagementIds } } }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        lead: { select: { id: true, fullName: true, avatarUrl: true } },
        _count: { select: { documents: true, members: true } },
      },
      orderBy: { openedAt: "desc" },
    });
  }

  async findById(id: string, actor: JwtUserPayload) {
    const scope = await this.access.scopeFor(actor);
    if (scope.deniedEngagementIds.includes(id)) {
      throw new NotFoundException("Engagement not found");
    }
    if (!scope.seesAllEngagements && !scope.allowedEngagementIds.includes(id)) {
      throw new NotFoundException("Engagement not found");
    }

    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      include: {
        client: true,
        lead: { select: { id: true, fullName: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true, title: true } } },
        },
      },
    });
    if (!engagement) throw new NotFoundException("Engagement not found");
    return engagement;
  }

  async create(dto: CreateEngagementDto, actor: JwtUserPayload) {
    const tenantId = TenantContext.requireTenantId();

    return this.prisma.tenantTransaction(async (tx) => {
      const engagement = await tx.engagement.create({
        data: {
          tenantId,
          clientId: dto.clientId,
          reference: dto.reference,
          name: dto.name,
          practiceArea: dto.practiceArea,
          leadId: dto.leadId ?? actor.sub,
          openedAt: dto.openedAt ? new Date(dto.openedAt) : new Date(),
        },
      });

      // The creator (or nominated lead) is seeded onto the team, otherwise the
      // engagement would be invisible to everyone below partner the moment it exists.
      await tx.engagementMember.create({
        data: {
          tenantId,
          engagementId: engagement.id,
          userId: dto.leadId ?? actor.sub,
          accessLevel: EngagementAccessLevel.LEAD,
        },
      });

      return engagement;
    });
  }

  /**
   * Add, change, or wall off a team member.
   *
   * Setting DENIED is the ethical-wall operation: it blocks the user from the
   * engagement's documents even if their role would otherwise reach them.
   */
  async setMember(engagementId: string, dto: SetMemberDto, actor: JwtUserPayload) {
    await this.access.requireEngagementWriteAccess(engagementId, actor);
    const tenantId = TenantContext.requireTenantId();

    const membership = await this.prisma.engagementMember.upsert({
      where: { engagementId_userId: { engagementId, userId: dto.userId } },
      update: { accessLevel: dto.accessLevel, note: dto.note },
      create: {
        tenantId,
        engagementId,
        userId: dto.userId,
        accessLevel: dto.accessLevel,
        note: dto.note,
      },
    });

    await this.audit.log({
      actorId: actor.sub,
      action: "PERMISSION_CHANGE",
      entityType: "EngagementMember",
      entityId: membership.id,
      metadata: { engagementId, userId: dto.userId, accessLevel: dto.accessLevel },
    });

    return membership;
  }

  async removeMember(engagementId: string, userId: string, actor: JwtUserPayload) {
    await this.access.requireEngagementWriteAccess(engagementId, actor);

    await this.prisma.engagementMember.deleteMany({ where: { engagementId, userId } });
    await this.audit.log({
      actorId: actor.sub,
      action: "PERMISSION_CHANGE",
      entityType: "EngagementMember",
      entityId: `${engagementId}:${userId}`,
      metadata: { engagementId, userId, removed: true },
    });

    return { ok: true };
  }
}
