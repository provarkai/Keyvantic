import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationType } from "@prisma/client";
import { TenantContext } from "../../common/tenant/tenant-context";

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  documentId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(input: NotifyInput) {
    return this.prisma.notification.create({
      data: { ...input, tenantId: TenantContext.requireTenantId() },
    });
  }

  async notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
    const unique = Array.from(new Set(userIds));
    return this.prisma.notification.createMany({
      data: unique.map((userId) => ({
        ...input,
        userId,
        tenantId: TenantContext.requireTenantId(),
      })),
    });
  }

  async listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { document: { select: { id: true, code: true, title: true } } },
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
