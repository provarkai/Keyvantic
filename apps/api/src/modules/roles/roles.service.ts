import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RoleName } from "@prisma/client";
import type { PermissionAction } from "@keyvantic/types";
import { PERMISSION_ACTIONS } from "@keyvantic/types";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.role.findMany({
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
  }

  async availableActions(): Promise<readonly PermissionAction[]> {
    return PERMISSION_ACTIONS;
  }

  async setPermissions(roleName: RoleName, actions: PermissionAction[]) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new NotFoundException("Role not found");

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      this.prisma.rolePermission.createMany({
        data: actions.map((action) => ({ roleId: role.id, action })),
      }),
    ]);

    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: { permissions: true },
    });
  }
}
