import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ProposalTemplatesService } from "./proposal-templates.service";
import { CreateTemplateSectionDto } from "./dto/create-section.dto";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@Controller("proposal-templates")
export class ProposalTemplatesController {
  constructor(private templates: ProposalTemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(":templateDocId/sections")
  getSections(@Param("templateDocId") templateDocId: string) {
    return this.templates.getSections(templateDocId);
  }

  @Post(":templateDocId/sections")
  @RequirePermissions("category:manage")
  addSection(@Param("templateDocId") templateDocId: string, @Body() dto: CreateTemplateSectionDto) {
    return this.templates.addSection(templateDocId, dto);
  }

  @Delete(":templateDocId/sections/:key")
  @RequirePermissions("category:manage")
  removeSection(@Param("templateDocId") templateDocId: string, @Param("key") key: string) {
    return this.templates.removeSection(templateDocId, key);
  }
}
