import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtUserPayload, PermissionAction } from "@keyvantic/types";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return user;
  }

  buildPayload(user: {
    id: string;
    email: string;
    role: { name: string; permissions: { action: string }[] };
  }): JwtUserPayload {
    return {
      sub: user.id,
      email: user.email,
      role: user.role.name as JwtUserPayload["role"],
      permissions: user.role.permissions.map((p) => p.action) as PermissionAction[],
    };
  }

  async issueTokens(payload: JwtUserPayload) {
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get("JWT_ACCESS_TTL", "15m"),
    });

    const refreshToken = crypto.randomBytes(48).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { userId: payload.sub, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, ipAddress?: string) {
    const user = await this.validateUser(email, password);
    const payload = this.buildPayload(user);
    const tokens = await this.issueTokens(payload);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.log({
      actorId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      ipAddress,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        title: user.title,
        avatarUrl: user.avatarUrl,
        role: user.role.name,
        permissions: payload.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      include: { role: { include: { permissions: true } } },
    });
    if (!user || !user.isActive) throw new UnauthorizedException("User inactive");

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const payload = this.buildPayload(user);
    return this.issueTokens(payload);
  }

  async logout(refreshToken: string | undefined, userId: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({ actorId: userId, action: "LOGOUT", entityType: "User", entityId: userId });
  }
}
