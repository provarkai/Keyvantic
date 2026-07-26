import { Module } from "@nestjs/common";
import { RelationshipsService } from "./relationships.service";
import { RelationshipsController } from "./relationships.controller";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [RelationshipsService],
  controllers: [RelationshipsController],
})
export class RelationshipsModule {}
