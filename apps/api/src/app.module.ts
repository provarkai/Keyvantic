import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { JwtAuthGuard } from "./modules/auth/jwt-auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ClientsModule } from "./modules/clients/clients.module";
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

    AuthModule,
    UsersModule,
    RolesModule,
    CategoriesModule,
    ClientsModule,
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
  ],
})
export class AppModule {}
