import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { JwtUserPayload, PermissionAction } from "@keyvantic/types";
import { AuditService } from "../audit/audit.service";
import { TenantContext } from "../../common/tenant/tenant-context";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  /**
   * Resolve credentials to a membership of one tenant.
   *
   * Runs under `asSystem` because the tenant is not known until the user is found —
   * this is one of the few places that legitimately reads across tenants. Nothing
   * here trusts the caller beyond the email/password pair and the requested slug,
   * and the returned membership fixes the tenant for the rest of the session.
   */
  private async resolveMembership(email: string, password: string, tenantSlug?: string) {
    return this.prisma.asSystem(async () => {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) throw new UnauthorizedException("Invalid credentials");

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new UnauthorizedException("Invalid credentials");

      const memberships = await this.prisma.tenantMember.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
        },
        include: {
          tenant: true,
          role: { include: { permissions: true } },
        },
      });

      if (memberships.length === 0) {
        // Deliberately indistinguishable from a bad password: revealing that an
        // account exists but has no access to this firm leaks membership.
        throw new UnauthorizedException("Invalid credentials");
      }
      if (memberships.length > 1) {
        throw new UnauthorizedException(
          "This account belongs to more than one firm — specify tenantSlug",
        );
      }

      const membership = memberships[0];
      if (membership.tenant.status === "SUSPENDED") {
        throw new UnauthorizedException("This workspace is suspended");
      }

      return { user, membership };
    });
  }

  buildPayload(
    user: { id: string; email: string },
    membership: { tenantId: string; role: { name: string; permissions: { action: string }[] } },
  ): JwtUserPayload {
    return {
      sub: user.id,
      tenantId: membership.tenantId,
      email: user.email,
      role: membership.role.name as JwtUserPayload["role"],
      permissions: membership.role.permissions.map((p) => p.action) as PermissionAction[],
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

    await this.prisma.asTenant(payload.tenantId, () =>
      this.prisma.refreshToken.create({
        data: { tenantId: payload.tenantId, userId: payload.sub, tokenHash, expiresAt },
      }),
    );

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, tenantSlug?: string, ipAddress?: string) {
    const { user, membership } = await this.resolveMembership(email, password, tenantSlug);
    const payload = this.buildPayload(user, membership);
    const tokens = await this.issueTokens(payload);

    await this.prisma.asSystem(() =>
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    );

    await this.prisma.asTenant(membership.tenantId, () =>
      this.audit.log({
        actorId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        ipAddress,
      }),
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        title: user.title,
        avatarUrl: user.avatarUrl,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        role: membership.role.name,
        permissions: payload.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const { user, membership } = await this.prisma.asSystem(async () => {
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new UnauthorizedException("Invalid or expired refresh token");
      }

      const found = await this.prisma.user.findUnique({ where: { id: stored.userId } });
      if (!found || !found.isActive) throw new UnauthorizedException("User inactive");

      const found2 = await this.prisma.tenantMember.findUnique({
        where: { tenantId_userId: { tenantId: stored.tenantId, userId: stored.userId } },
        include: { tenant: true, role: { include: { permissions: true } } },
      });
      if (!found2 || found2.status !== "ACTIVE") {
        throw new UnauthorizedException("Membership inactive");
      }

      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return { user: found, membership: found2 };
    });

    return this.issueTokens(this.buildPayload(user, membership));
  }

  async logout(refreshToken: string | undefined, userId: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      actorId: userId,
      action: "LOGOUT",
      entityType: "User",
      entityId: userId,
      tenantId: TenantContext.get()?.tenantId,
    });
  }
}
