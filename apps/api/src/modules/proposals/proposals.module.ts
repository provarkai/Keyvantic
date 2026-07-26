import { Module } from "@nestjs/common";
import { ProposalTemplatesService } from "./proposal-templates.service";
import { ProposalTemplatesController } from "./proposal-templates.controller";
import { ProposalGeneratorService } from "./proposal-generator.service";
import { ProposalsService } from "./proposals.service";
import { ProposalsController } from "./proposals.controller";
import { AiClientModule } from "../ai/ai-client.module";
import { DocumentsModule } from "../documents/documents.module";
import { VersionsModule } from "../versions/versions.module";
import { RelationshipsModule } from "../relationships/relationships.module";

@Module({
  imports: [AiClientModule, DocumentsModule, VersionsModule, RelationshipsModule],
  providers: [ProposalTemplatesService, ProposalGeneratorService, ProposalsService],
  controllers: [ProposalTemplatesController, ProposalsController],
})
export class ProposalsModule {}
