import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { VersionsService } from "./versions.service";
import { SaveVersionDto } from "../documents/dto/save-version.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";
import { SearchService } from "../search/search.service";

@Controller("documents/:documentId/versions")
export class VersionsController {
  constructor(
    private versions: VersionsService,
    private search: SearchService,
  ) {}

  @Get()
  list(@Param("documentId") documentId: string) {
    return this.versions.listForDocument(documentId);
  }

  @Get("compare")
  compare(
    @Param("documentId") documentId: string,
    @Query("from", ParseIntPipe) from: number,
    @Query("to", ParseIntPipe) to: number,
  ) {
    return this.versions.compare(documentId, from, to);
  }

  @Get(":versionNumber")
  getOne(@Param("documentId") documentId: string, @Param("versionNumber", ParseIntPipe) versionNumber: number) {
    return this.versions.getOne(documentId, versionNumber);
  }

  @Post()
  @RequirePermissions("document:update")
  async save(
    @Param("documentId") documentId: string,
    @Body() dto: SaveVersionDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const version = await this.versions.createVersion(
      documentId,
      dto.contentMarkdown,
      dto.contentHtml,
      dto.changeSummary,
      user,
    );
    await this.search.indexDocument(documentId);
    return version;
  }

  @Post(":versionNumber/restore")
  @RequirePermissions("document:update")
  restore(
    @Param("documentId") documentId: string,
    @Param("versionNumber", ParseIntPipe) versionNumber: number,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.versions.restore(documentId, versionNumber, user);
  }
}
