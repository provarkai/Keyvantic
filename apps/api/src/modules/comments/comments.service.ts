import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { NotificationsService } from "../notifications/notifications.service";
import type { JwtUserPayload } from "@keyvantic/types";

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async listForDocument(documentId: string) {
    return this.prisma.comment.findMany({
      where: { documentId, parentId: null },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        replies: { include: { author: { select: { id: true, fullName: true, avatarUrl: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
  }

  async create(documentId: string, dto: CreateCommentDto, actor: JwtUserPayload) {
    const comment = await this.prisma.comment.create({
      data: {
        documentId,
        documentVersionId: dto.documentVersionId,
        parentId: dto.parentId,
        authorId: actor.sub,
        body: dto.body,
      },
      include: { document: { select: { code: true, authorId: true, title: true } } },
    });

    if (comment.document.authorId !== actor.sub) {
      await this.notifications.notify({
        userId: comment.document.authorId,
        type: "COMMENT_ADDED",
        title: `New comment on ${comment.document.code}`,
        body: dto.body.slice(0, 140),
        documentId,
      });
    }

    return comment;
  }

  async resolve(commentId: string) {
    return this.prisma.comment.update({ where: { id: commentId }, data: { resolvedAt: new Date() } });
  }
}
