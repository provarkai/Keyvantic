import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTemplateSectionDto } from "./dto/create-section.dto";

@Injectable()
export class ProposalTemplatesService {
  constructor(private prisma: PrismaService) {}

  /** Documents flagged isTemplate: true, with their section definitions (if any). */
  async list() {
    return this.prisma.document.findMany({
      where: { isTemplate: true, deletedAt: null },
      include: {
        templateSections: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { title: "asc" },
    });
  }

  async getSections(templateDocId: string) {
    const template = await this.prisma.document.findFirst({
      where: { id: templateDocId, isTemplate: true, deletedAt: null },
      include: { templateSections: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw new NotFoundException("Proposal template not found");
    return template.templateSections;
  }

  async addSection(templateDocId: string, dto: CreateTemplateSectionDto) {
    const template = await this.prisma.document.findFirst({ where: { id: templateDocId, isTemplate: true } });
    if (!template) throw new NotFoundException("Proposal template not found");

    return this.prisma.proposalTemplateSection.upsert({
      where: { templateDocId_key: { templateDocId, key: dto.key } },
      update: {
        title: dto.title,
        sortOrder: dto.sortOrder,
        promptHint: dto.promptHint,
        requiresHuman: dto.requiresHuman ?? false,
      },
      create: {
        templateDocId,
        key: dto.key,
        title: dto.title,
        sortOrder: dto.sortOrder ?? 0,
        promptHint: dto.promptHint,
        requiresHuman: dto.requiresHuman ?? false,
      },
    });
  }

  async removeSection(templateDocId: string, key: string) {
    await this.prisma.proposalTemplateSection.delete({
      where: { templateDocId_key: { templateDocId, key } },
    });
    return { success: true };
  }
}
