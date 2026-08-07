import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AccessModule } from "./common/access/access.module";
import { JwtAuthGuard } from "./modules/auth/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { TenantContextMiddleware } from "./common/tenant/tenant-context.middleware";
import { TenantScopeInterceptor } from "./common/tenant/tenant-scope.interceptor";

import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { EngagementsModule } from "./modules/engagements/engagements.module";
import { VaultModule } from "./modules/vault/vault.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { VersionsModule } from "./modules/versions/versions.module";
import { TagsModule } from "./modules/tags/tags.module";
import { RelationshipsModule } from "./modules/relationships/relationships.module";
import { CommentsModule } from "./modules/comments/comments.module";
import { ApprovalsModule } from "./modules/approvals/approvals.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SearchModule } from "./modules/search/search.module";
import { AiModule } from "./modules/ai/ai.module";
import { AuditModule } from "./modules/audit/audit.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    PrismaModule,
    AccessModule,

    AuthModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    ClientsModule,
    EngagementsModule,
    VaultModule,
    DocumentsModule,
    VersionsModule,
    TagsModule,
    RelationshipsModule,
    CommentsModule,
    ApprovalsModule,
    NotificationsModule,
    SearchModule,
    AiModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Runs after the guards, so request.user carries a validated JWT.
    { provide: APP_INTERCEPTOR, useClass: TenantScopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Opens the AsyncLocalStorage scope for every request, before guards run.
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}
