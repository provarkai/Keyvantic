import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiClientService } from "../ai/ai-client.service";
import { extractKeywords } from "../ai/ai.service";
import type { JwtUserPayload } from "@keyvantic/types";
import type { Client, Document, ProposalTemplateSection } from "@prisma/client";

const SECTION_SYSTEM_PROMPT = `You are drafting one section of a client proposal for Keyvantic, an AI Business
Transformation and Advisory firm. Write ONLY using the approved-document excerpts given as context — never invent
facts, scope, or commitments that aren't grounded in them. NEVER state a specific price, discount, or contractual
term, even if asked — that is decided by a human. Write 2-4 short paragraphs in a confident, professional
consulting tone, addressed to the named client. Cite nothing inline; sources are tracked separately.`;

export interface DraftedSection {
  key: string;
  title: string;
  markdown: string;
  requiresHuman: boolean;
  sourceDocumentIds: string[];
}

@Injectable()
export class ProposalGeneratorService {
  private readonly logger = new Logger(ProposalGeneratorService.name);

  constructor(
    private prisma: PrismaService,
    private aiClient: AiClientService,
  ) {}

  /**
   * Category ids belonging to OTHER clients' Master Library sub-trees, to exclude from
   * retrieval. A client's own sub-tree and everything outside "09 Clients" stays in scope.
   */
  private async otherClientsCategoryIds(thisClientRootCategoryId: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true, code: true } });
    const clientsRoot = all.find((c) => c.code === "CLIENTS");
    if (!clientsRoot) return [];

    const childrenOf = new Map<string, string[]>();
    for (const c of all) {
      if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
    }
    const descendants = (id: string): string[] => [id, ...(childrenOf.get(id) ?? []).flatMap(descendants)];

    const allClientIds = new Set(descendants(clientsRoot.id));
    const thisClientIds = new Set(descendants(thisClientRootCategoryId));
    return [...allClientIds].filter((id) => !thisClientIds.has(id));
  }

  private async retrieveScopedContext(
    query: string,
    client: Client,
    actor: JwtUserPayload,
    limit = 4,
  ): Promise<{ id: string; code: string; title: string; categoryName: string; excerpt: string }[]> {
    const isPrivileged = ["ADMINISTRATOR", "PARTNER"].includes(actor.role);
    const confidentialityFilter = isPrivileged ? undefined : { in: ["PUBLIC" as const, "INTERNAL" as const] };
    const excludedCategoryIds = await this.otherClientsCategoryIds(client.rootCategoryId);
    const keywords = extractKeywords(query);

    const candidates = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        status: "APPROVED",
        confidentiality: confidentialityFilter,
        ...(excludedCategoryIds.length > 0 ? { categoryId: { notIn: excludedCategoryIds } } : {}),
        ...(keywords.length > 0
          ? {
              OR: keywords.flatMap((word) => [
                { title: { contains: word, mode: "insensitive" as const } },
                { summary: { contains: word, mode: "insensitive" as const } },
                { versions: { some: { contentMarkdown: { contains: word, mode: "insensitive" as const } } } },
              ]),
            }
          : {}),
      },
      include: { category: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      take: 50,
    });

    const ranked = candidates
      .map((doc) => {
        const haystack = `${doc.title} ${doc.summary ?? ""} ${doc.versions[0]?.contentMarkdown ?? ""}`.toLowerCase();
        const score = keywords.reduce((count, word) => (haystack.includes(word) ? count + 1 : count), 0);
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score);

    const pool = ranked.some((r) => r.score > 0)
      ? ranked.filter((r) => r.score > 0).slice(0, limit).map((r) => r.doc)
      : [];

    return pool.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      categoryName: doc.category.name,
      excerpt: (doc.versions[0]?.contentMarkdown ?? doc.summary ?? "").slice(0, 1500),
    }));
  }

  private static HUMAN_PLACEHOLDER = (title: string) =>
    `[[${title.toUpperCase()} — NOT AI-DRAFTED]]\n\nThis section covers pricing/commercial terms and must be completed by a human before this proposal is submitted for review.`;

  async draftSection(section: ProposalTemplateSection, template: Document, client: Client, actor: JwtUserPayload): Promise<DraftedSection> {
    if (section.requiresHuman) {
      return {
        key: section.key,
        title: section.title,
        markdown: ProposalGeneratorService.HUMAN_PLACEHOLDER(section.title),
        requiresHuman: true,
        sourceDocumentIds: [],
      };
    }

    const query = [template.title, section.title, section.promptHint, client.name, client.industry].filter(Boolean).join(" ");
    const context = await this.retrieveScopedContext(query, client, actor);

    if (context.length === 0) {
      return {
        key: section.key,
        title: section.title,
        markdown: `No approved documents were found to ground this section. Add source material to ${client.name}'s Discovery Notes, or to the firm-wide Methodology/Frameworks library, then regenerate this section.`,
        requiresHuman: false,
        sourceDocumentIds: [],
      };
    }

    const contextBlock = context.map((c) => `### ${c.code} — ${c.title} (${c.categoryName})\n${c.excerpt}`).join("\n\n");
    const prompt = `Client: ${client.name}${client.industry ? ` (${client.industry})` : ""}\nProposal template: ${template.title}\nSection to draft: "${section.title}"${section.promptHint ? `\nInstruction: ${section.promptHint}` : ""}\n\nContext:\n${contextBlock}`;

    const answer = await this.aiClient.chatComplete(SECTION_SYSTEM_PROMPT, prompt);
    // Extractive fallback (no OPENAI_API_KEY): plain text, not markdown emphasis —
    // the assembled HTML doesn't run a markdown renderer, so "**bold**" would show
    // as literal asterisks in the editor.
    const markdown =
      answer ??
      context
        .map((c) => `Source: ${c.code} — ${c.title}\n${c.excerpt.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? c.excerpt.slice(0, 200)}`)
        .join("\n\n");

    return {
      key: section.key,
      title: section.title,
      markdown,
      requiresHuman: false,
      sourceDocumentIds: context.map((c) => c.id),
    };
  }

  async draftAllSections(sections: ProposalTemplateSection[], template: Document, client: Client, actor: JwtUserPayload) {
    const drafted: DraftedSection[] = [];
    for (const section of sections) {
      try {
        drafted.push(await this.draftSection(section, template, client, actor));
      } catch (err) {
        this.logger.warn(`Failed to draft section "${section.key}": ${(err as Error).message}`);
        drafted.push({
          key: section.key,
          title: section.title,
          markdown: `This section failed to generate (${(err as Error).message}). Please fill it in manually or regenerate it.`,
          requiresHuman: section.requiresHuman,
          sourceDocumentIds: [],
        });
      }
    }
    return drafted;
  }

  /** Assembles drafted sections into one document, with a hidden marker per section so it can be regenerated in place later. */
  assemble(sections: DraftedSection[]) {
    const markdown = sections
      .map((s) => `<!-- section:${s.key} -->\n## ${s.title}\n\n${s.markdown}`)
      .join("\n\n");
    const html = sections
      .map((s) => `<div data-section="${s.key}"><h2>${s.title}</h2><p>${s.markdown.replace(/\n/g, "<br/>")}</p></div>`)
      .join("");
    const sourceDocumentIds = Array.from(new Set(sections.flatMap((s) => s.sourceDocumentIds)));
    return { markdown, html, sourceDocumentIds };
  }
}
