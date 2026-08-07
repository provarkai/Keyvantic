import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile as UploadedFileParam,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { JwtUserPayload } from "@keyvantic/types";
import { VaultService, type UploadedFile } from "./vault.service";
import { UploadFileDto } from "./dto/upload-file.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

/** Matches the multipart body limit configured on the interceptor below. */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

@ApiTags("vault")
@Controller("vault")
export class VaultController {
  constructor(private vault: VaultService) {}

  @Get()
  list(
    @CurrentUser() user: JwtUserPayload,
    @Query("engagementId") engagementId?: string,
    @Query("documentId") documentId?: string,
  ) {
    return this.vault.list(user, { engagementId, documentId });
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.vault.findById(id, user);
  }

  @Post()
  @RequirePermissions("document:create")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadFileDto })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(
    @UploadedFileParam() file: UploadedFile,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.vault.upload(file, dto, user);
  }

  @Post(":id/versions")
  @RequirePermissions("document:update")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  addVersion(
    @Param("id") id: string,
    @UploadedFileParam() file: UploadedFile,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.vault.addVersion(id, file, user);
  }

  @Get(":id/download")
  @RequirePermissions("document:export")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: JwtUserPayload,
    @Res() res: Response,
    @Query("version") version?: string,
  ) {
    const result = await this.vault.download(
      id,
      user,
      version ? Number.parseInt(version, 10) : undefined,
    );

    res.setHeader("Content-Type", result.mimeType);
    // Quotes and escapes the filename so a crafted upload name cannot inject
    // additional header directives.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename.replace(/["\\]/g, "_")}"`,
    );
    res.setHeader("Content-Length", String(result.buffer.length));
    // Decrypted bytes should not sit in a shared cache.
    res.setHeader("Cache-Control", "private, no-store");
    res.send(result.buffer);
  }

  @Delete(":id")
  @RequirePermissions("document:delete")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.vault.remove(id, user);
  }
}
