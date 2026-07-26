import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { JwtUserPayload } from "@keyvantic/types";
import { estimateReadTimeMinutes } from "@keyvantic/types";

function wordCount(markdown: string) {
  return markdown.trim().split(/\s+/).filter(Boolean).length;
}

@Injectable()
export class VersionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listForDocument(documentId: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNumber: "desc" },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
  }

  async latest(documentId: string) {
    return this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getOne(documentId: string, versionNumber: number) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { documentId_versionNumber: { documentId, versionNumber } },
      include: { author: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    if (!version) throw new NotFoundException("Version not found");
    return version;
  }

  async createVersion(
    documentId: string,
    contentMarkdown: string,
    contentHtml: string,
    changeSummary: string | undefined,
    actor: JwtUserPayload,
    isRestoreOf?: number,
  ) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException("Document not found");

    const nextVersionNumber = document.currentVersionNumber + 1;
    const wc = wordCount(contentMarkdown);

    const version = await this.prisma.$transaction(async (tx) => {
      const v = await tx.documentVersion.create({
        data: {
          documentId,
          versionNumber: nextVersionNumber,
          contentMarkdown,
          contentHtml,
          changeSummary,
          authorId: actor.sub,
          wordCount: wc,
          isRestoreOf,
        },
      });
      await tx.document.update({
        where: { id: documentId },
        data: {
          currentVersionNumber: nextVersionNumber,
          wordCount: wc,
          readTimeMinutes: estimateReadTimeMinutes(wc),
        },
      });
      return v;
    });

    await this.audit.log({
      actorId: actor.sub,
      action: isRestoreOf ? "VERSION_RESTORE" : "VERSION_CREATE",
      entityType: "DocumentVersion",
      entityId: version.id,
      metadata: { documentId, versionNumber: nextVersionNumber, isRestoreOf },
    });

    return version;
  }

  async restore(documentId: string, versionNumber: number, actor: JwtUserPayload) {
    const target = await this.getOne(documentId, versionNumber);
    return this.createVersion(
      documentId,
      target.contentMarkdown,
      target.contentHtml,
      `Restored from v${versionNumber}`,
      actor,
      versionNumber,
    );
  }

  /** Line-level diff (LCS-based) between two versions' markdown content. */
  async compare(documentId: string, fromVersion: number, toVersion: number) {
    const [from, to] = await Promise.all([
      this.getOne(documentId, fromVersion),
      this.getOne(documentId, toVersion),
    ]);

    const diff = computeLineDiff(from.contentMarkdown.split("\n"), to.contentMarkdown.split("\n"));
    return { from, to, diff };
  }
}

type DiffOp = { type: "equal" | "added" | "removed"; line: string };

/** Classic O(N*M) LCS diff — fine for document-sized text (thousands of lines, not millions). */
function computeLineDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "removed", line: a[i] });
      i++;
    } else {
      ops.push({ type: "added", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "removed", line: a[i++] });
  while (j < m) ops.push({ type: "added", line: b[j++] });
  return ops;
}
