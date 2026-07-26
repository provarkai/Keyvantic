import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { ExportService } from "./export.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditModule } from "../audit/audit.module";
import { SearchModule } from "../search/search.module";
import { VersionsModule } from "../versions/versions.module";

@Module({
  imports: [NotificationsModule, AuditModule, SearchModule, VersionsModule],
  providers: [DocumentsService, ExportService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
