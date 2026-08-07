import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { TenantContext } from "../../common/tenant/tenant-context";

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  title: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Identity is global but membership is per-tenant, so a user's role now comes from
   * their TenantMember row rather than the user record. Listing goes through
   * memberships, which also means RLS on TenantMember scopes the result to this firm.
   */
  async list() {
    const members = await this.prisma.tenantMember.findMany({
      include: {
        user: { select: SAFE_SELECT },
        role: { select: { id: true, name: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    });

    return members.map((m) => ({ ...m.user, role: m.role, membershipStatus: m.status }));
  }

  async findById(id: string) {
    const membership = await this.prisma.tenantMember.findFirst({
      where: { userId: id },
      include: {
        user: { select: SAFE_SELECT },
        role: { select: { id: true, name: true } },
      },
    });
    if (!membership) throw new NotFoundException("User not found");
    return { ...membership.user, role: membership.role, membershipStatus: membership.status };
  }

  /**
   * Add someone to this firm. If the email already exists globally — a contractor who
   * works with several firms — reuse that identity rather than refusing, and just add
   * a membership.
   */
  async create(dto: CreateUserDto) {
    const tenantId = TenantContext.requireTenantId();

    const role = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: dto.role } },
    });
    if (!role) throw new NotFoundException(`Role ${dto.role} not seeded for this workspace`);

    // The lookup crosses tenants deliberately: it decides whether to mint a new
    // identity or reuse one. It returns nothing to the caller beyond that decision.
    const existing = await this.prisma.asSystem(() =>
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
    );

    return this.prisma.tenantTransaction(async (tx) => {
      const userId =
        existing?.id ??
        (
          await tx.user.create({
            data: {
              email: dto.email,
              passwordHash: await bcrypt.hash(dto.password, 12),
              fullName: dto.fullName,
              title: dto.title,
            },
          })
        ).id;

      const alreadyMember = await tx.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      if (alreadyMember) throw new ConflictException("That person is already in this workspace");

      await tx.tenantMember.create({ data: { tenantId, userId, roleId: role.id } });

      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: SAFE_SELECT });
      return { ...user, role: { id: role.id, name: role.name } };
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const tenantId = TenantContext.requireTenantId();

    if (dto.role) {
      const role = await this.prisma.role.findUnique({
        where: { tenantId_name: { tenantId, name: dto.role } },
      });
      if (!role) throw new NotFoundException(`Role ${dto.role} not seeded for this workspace`);

      await this.prisma.tenantMember.update({
        where: { tenantId_userId: { tenantId, userId: id } },
        data: { roleId: role.id },
      });
    }

    if (dto.fullName !== undefined || dto.title !== undefined || dto.isActive !== undefined) {
      // Guarded by the membership lookup above / below: RLS on TenantMember is what
      // proves this user belongs to the caller's firm before their record is touched.
      const membership = await this.prisma.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId, userId: id } },
      });
      if (!membership) throw new NotFoundException("User not found");

      await this.prisma.user.update({
        where: { id },
        data: { fullName: dto.fullName, title: dto.title, isActive: dto.isActive },
      });
    }

    return this.findById(id);
  }

  /** Removes the person from this firm without destroying their global identity. */
  async remove(id: string) {
    const tenantId = TenantContext.requireTenantId();
    await this.prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId, userId: id } },
      data: { status: "SUSPENDED" },
    });
    return this.findById(id);
  }
}
