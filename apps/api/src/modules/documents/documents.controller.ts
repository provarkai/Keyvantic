import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";
import { QueryDocumentsDto } from "./dto/query-documents.dto";
import { ChangeStatusDto } from "./dto/change-status.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";
import { ExportService } from "./export.service";
import { VersionsService } from "../versions/versions.service";

@Controller("documents")
export class DocumentsController {
  constructor(
    private documents: DocumentsService,
    private exportService: ExportService,
    private versions: VersionsService,
  ) {}

  @Get("dashboard")
  dashboard(@CurrentUser() user: JwtUserPayload) {
    return this.documents.dashboardStats(user);
  }

  @Get("favorites")
  favorites(@CurrentUser() user: JwtUserPayload) {
    return this.documents.listFavorites(user);
  }

  @Get()
  list(@Query() query: QueryDocumentsDto, @CurrentUser() user: JwtUserPayload) {
    return this.documents.list(query, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.documents.findById(id, user);
  }

  @Post()
  @RequirePermissions("document:create")
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: JwtUserPayload) {
    return this.documents.create(dto, user);
  }

  @Patch(":id")
  @RequirePermissions("document:update")
  update(@Param("id") id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: JwtUserPayload) {
    return this.documents.update(id, dto, user);
  }

  @Delete(":id")
  @RequirePermissions("document:delete")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.documents.remove(id, user);
  }

  @Post(":id/status")
  changeStatus(@Param("id") id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: JwtUserPayload) {
    return this.documents.changeStatus(id, dto.status, dto.comment, user);
  }

  @Post(":id/favorite")
  toggleFavorite(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.documents.toggleFavorite(id, user);
  }

  @Get(":id/export/:format")
  @RequirePermissions("document:export")
  async export(@Param("id") id: string, @Param("format") format: string, @Res() res: Response) {
    const document = await this.documents.findById(id);
    const latestVersion = await this.versions.latest(id);
    const file = await this.exportService.export(document, latestVersion, format);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }
}
