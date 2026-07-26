import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ProposalGeneratorService } from "./proposal-generator.service";
import { DocumentsService } from "../documents/documents.service";
import { VersionsService } from "../versions/versions.service";
import { RelationshipsService } from "../relationships/relationships.service";
import { CreateProposalRunDto } from "./dto/create-run.dto";
import { RegenerateSectionDto } from "./dto/regenerate-section.dto";
import type { JwtUserPayload } from "@keyvantic/types";
import { ConfidentialityLevel, RelationshipType } from "@keyvantic/types";

@Injectable()
export class ProposalsService {
  constructor(
    private prisma: PrismaService,
    private generator: ProposalGeneratorService,
    private documents: DocumentsService,
    private versions: VersionsService,
    private relationships: RelationshipsService,
  ) {}

  private async deliverablesCategoryFor(client: { rootCategoryId: string }) {
    const category = await this.prisma.category.findFirst({
      where: { parentId: client.rootCategoryId, name: "Deliverables" },
    });
    if (!category) throw new NotFoundException("This client has no Deliverables folder — was it created via the Clients API?");
    return category;
  }

  async listRuns(clientId?: string) {
    return this.prisma.proposalRun.findMany({
      where: clientId ? { clientId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        templateDoc: { select: { id: true, code: true, title: true } },
        resultDocument: { select: { id: true, code: true, title: true, status: true } },
        requestedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async getRun(id: string) {
    const run = await this.prisma.proposalRun.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        templateDoc: { select: { id: true, code: true, title: true } },
        resultDocument: { select: { id: true, code: true, title: true, status: true } },
        requestedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!run) throw new NotFoundException("Proposal run not found");
    return run;
  }

  async create(dto: CreateProposalRunDto, actor: JwtUserPayload) {
    const [template, client] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: dto.templateDocId, isTemplate: true, deletedAt: null } }),
      this.prisma.client.findUnique({ where: { id: dto.clientId } }),
    ]);
    if (!template) throw new NotFoundException("Proposal template not found");
    if (!client) throw new NotFoundException("Client not found");

    const sections = await this.prisma.proposalTemplateSection.findMany({
      where: { templateDocId: template.id },
      orderBy: { sortOrder: "asc" },
    });
    if (sections.length === 0) {
      throw new BadRequestException("This template has no sections defined yet — add sections before generating.");
    }

    const run = await this.prisma.proposalRun.create({
      data: { templateDocId: template.id, clientId: client.id, requestedById: actor.sub, status: "GENERATING" },
    });

    try {
      const deliverablesCategory = await this.deliverablesCategoryFor(client);
      const drafted = await this.generator.draftAllSections(sections, template, client, actor);
      const { markdown, html, sourceDocumentIds } = this.generator.assemble(drafted);

      const titleBase = template.title.replace(/^Standard\s+/i, "").replace(/\s+Template$/i, "");
      const doc = await this.documents.create(
        {
          title: `${client.name} — ${titleBase}`,
          summary: `Generated from ${template.code} for ${client.name}.`,
          categoryId: deliverablesCategory.id,
          confidentiality: ConfidentialityLevel.CONFIDENTIAL,
          tags: ["proposal", "ai-generated"],
        },
        actor,
      );

      await this.versions.createVersion(doc.id, markdown, html, "AI-generated first draft", actor);

      await this.relationships.create(doc.id, { targetDocumentId: template.id, type: RelationshipType.DERIVED_FROM }, actor);
      for (const sourceId of sourceDocumentIds) {
        if (sourceId === template.id) continue;
        await this.relationships.create(doc.id, { targetDocumentId: sourceId, type: RelationshipType.DERIVED_FROM }, actor).catch(() => {
          // duplicate edge or self-reference — non-fatal
        });
      }

      return this.prisma.proposalRun.update({
        where: { id: run.id },
        data: {
          status: "DRAFTED",
          resultDocumentId: doc.id,
          sourceDocumentIds,
          completedAt: new Date(),
        },
        include: { resultDocument: { select: { id: true, code: true, title: true, status: true } } },
      });
    } catch (err) {
      await this.prisma.proposalRun.update({
        where: { id: run.id },
        data: { status: "FAILED", error: (err as Error).message, completedAt: new Date() },
      });
      throw err;
    }
  }

  async regenerateSection(runId: string, dto: RegenerateSectionDto, actor: JwtUserPayload) {
    const run = await this.prisma.proposalRun.findUnique({
      where: { id: runId },
      include: { client: true, templateDoc: true },
    });
    if (!run || !run.resultDocumentId) throw new NotFoundException("Proposal run has no result document yet");

    const section = await this.prisma.proposalTemplateSection.findUnique({
      where: { templateDocId_key: { templateDocId: run.templateDocId, key: dto.sectionKey } },
    });
    if (!section) throw new NotFoundException("Section not found on this template");

    const sectionToUse = dto.instruction ? { ...section, promptHint: dto.instruction } : section;
    const redrafted = await this.generator.draftSection(sectionToUse, run.templateDoc, run.client, actor);

    const latest = await this.versions.latest(run.resultDocumentId);
    if (!latest) throw new NotFoundException("Result document has no versions");

    const marker = `<!-- section:${dto.sectionKey} -->`;
    const blocks = latest.contentMarkdown.split(/(?=<!-- section:)/);
    const replaced = blocks.map((block) =>
      block.startsWith(marker) ? `${marker}\n## ${redrafted.title}\n\n${redrafted.markdown}` : block,
    );
    const newMarkdown = replaced.join("\n\n");
    const newHtml = latest.contentHtml.replace(
      new RegExp(`<div data-section="${dto.sectionKey}">[\\s\\S]*?</div>`),
      `<div data-section="${dto.sectionKey}"><h2>${redrafted.title}</h2><p>${redrafted.markdown.replace(/\n/g, "<br/>")}</p></div>`,
    );

    const nextSourceIds = Array.from(
      new Set([...(Array.isArray(run.sourceDocumentIds) ? (run.sourceDocumentIds as string[]) : []), ...redrafted.sourceDocumentIds]),
    );

    await this.versions.createVersion(run.resultDocumentId, newMarkdown, newHtml, `Regenerated section: ${redrafted.title}`, actor);
    await this.prisma.proposalRun.update({ where: { id: run.id }, data: { sourceDocumentIds: nextSourceIds } });

    return { section: redrafted };
  }
}
