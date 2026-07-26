import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiQueryDto } from "./dto/ai-query.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("ai")
export class AiController {
  constructor(private ai: AiService) {}

  @Post("ask")
  @RequirePermissions("ai:query")
  ask(@Body() dto: AiQueryDto, @CurrentUser() user: JwtUserPayload) {
    return this.ai.ask(dto.question, user);
  }

  @Get("documents/:documentId/compare")
  @RequirePermissions("ai:query")
  compare(
    @Param("documentId") documentId: string,
    @Query("from", ParseIntPipe) from: number,
    @Query("to", ParseIntPipe) to: number,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.ai.compareVersions(documentId, from, to, user);
  }

  @Get("changes/this-month")
  @RequirePermissions("ai:query")
  changesThisMonth(@CurrentUser() user: JwtUserPayload) {
    return this.ai.whatChangedThisMonth(user);
  }
}
