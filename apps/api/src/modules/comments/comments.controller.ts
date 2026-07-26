import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("documents/:documentId/comments")
export class CommentsController {
  constructor(private comments: CommentsService) {}

  @Get()
  list(@Param("documentId") documentId: string) {
    return this.comments.listForDocument(documentId);
  }

  @Post()
  @RequirePermissions("comment:create")
  create(@Param("documentId") documentId: string, @Body() dto: CreateCommentDto, @CurrentUser() user: JwtUserPayload) {
    return this.comments.create(documentId, dto, user);
  }

  @Patch(":commentId/resolve")
  @RequirePermissions("comment:create")
  resolve(@Param("commentId") commentId: string) {
    return this.comments.resolve(commentId);
  }
}
