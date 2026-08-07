import { Module } from "@nestjs/common";
import { EngagementsService } from "./engagements.service";
import { EngagementsController } from "./engagements.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
