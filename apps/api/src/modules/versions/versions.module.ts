import { Module } from "@nestjs/common";
import { VersionsService } from "./versions.service";
import { VersionsController } from "./versions.controller";
import { AuditModule } from "../audit/audit.module";
import { SearchModule } from "../search/search.module";

@Module({
  imports: [AuditModule, SearchModule],
  providers: [VersionsService],
  controllers: [VersionsController],
  exports: [VersionsService],
})
export class VersionsModule {}
