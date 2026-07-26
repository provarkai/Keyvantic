import { Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  title: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { fullName: "asc" } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async create(dto: CreateUserDto) {
    const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
    if (!role) throw new NotFoundException(`Role ${dto.role} not seeded`);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        title: dto.title,
        roleId: role.id,
      },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {
      fullName: dto.fullName,
      title: dto.title,
      isActive: dto.isActive,
    };
    if (dto.role) {
      const role = await this.prisma.role.findUnique({ where: { name: dto.role } });
      if (!role) throw new NotFoundException(`Role ${dto.role} not seeded`);
      data.roleId = role.id;
    }
    return this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
  }

  async remove(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: SAFE_SELECT });
  }
}
