import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ProposalsService } from "./proposals.service";
import { CreateProposalRunDto } from "./dto/create-run.dto";
import { RegenerateSectionDto } from "./dto/regenerate-section.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("proposals/runs")
export class ProposalsController {
  constructor(private proposals: ProposalsService) {}

  @Get()
  list(@Query("clientId") clientId?: string) {
    return this.proposals.listRuns(clientId);
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.proposals.getRun(id);
  }

  @Post()
  @RequirePermissions("proposal:generate")
  create(@Body() dto: CreateProposalRunDto, @CurrentUser() user: JwtUserPayload) {
    return this.proposals.create(dto, user);
  }

  @Post(":id/regenerate-section")
  @RequirePermissions("proposal:generate")
  regenerateSection(@Param("id") id: string, @Body() dto: RegenerateSectionDto, @CurrentUser() user: JwtUserPayload) {
    return this.proposals.regenerateSection(id, dto, user);
  }
}
