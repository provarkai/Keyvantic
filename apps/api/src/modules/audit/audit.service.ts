import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditAction, Prisma } from "@prisma/client";
import { TenantContext } from "../../common/tenant/tenant-context";

interface LogInput {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  /** Defaults to the request's tenant; pass explicitly only from outside a request. */
  tenantId?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: LogInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? TenantContext.requireTenantId(),
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findForEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async recent(limit = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }
}
