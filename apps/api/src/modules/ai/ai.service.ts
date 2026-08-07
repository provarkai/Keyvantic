import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SearchService } from "../search/search.service";
import { AccessService } from "../../common/access/access.service";
import { AiClientService } from "./ai-client.service";
import type { JwtUserPayload } from "@keyvantic/types";

const SYSTEM_PROMPT = `You are the Keyvantic Knowledge Operating System internal assistant.
You answer ONLY using the approved-document excerpts provided in the user message as context.
Never use outside knowledge. If the context does not contain the answer, say so plainly and
suggest which Master Library category might have it. Always cite source documents by their
Document ID (e.g. KV-BS-001) when you use information from them. Keep answers concise and in a
professional consulting tone.`;

export interface RetrievedContext {
  id: string;
  code: string;
  title: string;
  categoryName?: string;
  excerpt: string;
}

const STOPWORDS = new Set([
  "what", "does", "our", "the", "and", "for", "with", "that", "this", "have", "has",
  "about", "from", "into", "say", "says", "tell", "give", "show", "compare", "summarise",
  "summarize", "generate", "using", "version", "when", "were", "was", "are", "how",
]);

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return Array.from(new Set(words.filter((w) => !STOPWORDS.has(w))));
}

@Injectable()
export class AiService {
  constructor(
    private prisma: PrismaService,
    private search: SearchService,
    private aiClient: AiClientService,
    private access: AccessService,
  ) {}

  /**
   * Retrieval is hard-restricted to APPROVED documents the actor may read.
   *
   * Visibility comes from the shared predicate — engagement membership and ethical
   * walls included — with APPROVED applied on top, because unapproved material must
   * never become an answer even to someone allowed to read the draft. This module
   * previously carried its own third interpretation of confidentiality, which
   * disagreed with both the documents and search modules.
   */
  private async retrieveApprovedContext(query: string, actor: JwtUserPayload, limit = 6): Promise<RetrievedContext[]> {
    const visibleAndApproved = await this.access.documentWhereWithFilters(actor, {
      status: "APPROVED",
    });
    const keywords = extractKeywords(query);

    const candidates = await this.prisma.document.findMany({
      where: {
        AND: [
          visibleAndApproved,
          ...(keywords.length > 0
            ? [
                {
                  OR: keywords.flatMap((word) => [
                    { title: { contains: word, mode: "insensitive" as const } },
                    { summary: { contains: word, mode: "insensitive" as const } },
                    {
                      versions: {
                        some: { contentMarkdown: { contains: word, mode: "insensitive" as const } },
                      },
                    },
                  ]),
                },
              ]
            : []),
        ],
      },
      include: { category: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      take: 50,
    });

    // Rank candidates by number of distinct keywords matched, so multi-word
    // questions surface the most relevant documents rather than the first hit.
    const ranked = candidates
      .map((doc) => {
        const haystack = `${doc.title} ${doc.summary ?? ""} ${doc.versions[0]?.contentMarkdown ?? ""}`.toLowerCase();
        const score = keywords.reduce((count, word) => (haystack.includes(word) ? count + 1 : count), 0);
        return { doc, score };
      })
      .sort((a, b) => b.score - a.score);

    // If nothing matched any keyword, broaden to the most recently approved
    // documents in-scope so the assistant can still ground an answer.
    const pool = ranked.some((r) => r.score > 0)
      ? ranked.filter((r) => r.score > 0).slice(0, limit).map((r) => r.doc)
      : await this.prisma.document.findMany({
          where: visibleAndApproved,
          include: { category: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
          orderBy: { updatedAt: "desc" },
          take: limit,
        });

    return pool.map((doc) => ({
      id: doc.id,
      code: doc.code,
      title: doc.title,
      categoryName: doc.category.name,
      excerpt: (doc.versions[0]?.contentMarkdown ?? doc.summary ?? "").slice(0, 1500),
    }));
  }

  async ask(question: string, actor: JwtUserPayload) {
    const context = await this.retrieveApprovedContext(question, actor);

    if (context.length === 0) {
      return {
        answer:
          "I couldn't find any approved documents relevant to that question. Try rephrasing, or ask a Partner/Administrator to review a draft covering this topic.",
        sources: [],
        modelBacked: false,
      };
    }

    const contextBlock = context
      .map((c) => `### ${c.code} — ${c.title} (${c.categoryName})\n${c.excerpt}`)
      .join("\n\n");

    const answer = await this.aiClient.chatComplete(
      SYSTEM_PROMPT,
      `Context:\n${contextBlock}\n\nQuestion: ${question}`,
    );

    if (answer) {
      return { answer, sources: context.map(({ id, code, title }) => ({ id, code, title })), modelBacked: true };
    }

    // Extractive fallback when no OPENAI_API_KEY is configured: surface the
    // most relevant line (the one containing a query keyword) per document
    // rather than always the heading.
    const keywords = extractKeywords(question);
    const extractive = context
      .map((c) => {
        const allLines = c.excerpt.split("\n").map((l) => l.trim()).filter(Boolean);
        // Prefer body text over markdown headings — headings trivially match
        // keywords drawn from the document's own title.
        const bodyLines = allLines.filter((l) => !l.startsWith("#"));
        const bestLine =
          bodyLines.find((line) => keywords.some((word) => line.toLowerCase().includes(word))) ??
          allLines.find((line) => keywords.some((word) => line.toLowerCase().includes(word))) ??
          bodyLines[0] ??
          allLines[0] ??
          c.excerpt.slice(0, 200);
        return `**${c.code} — ${c.title}**: ${bestLine}`;
      })
      .join("\n\n");
    return {
      answer: `AI model access is not configured, so here are the most relevant approved excerpts instead:\n\n${extractive}`,
      sources: context.map(({ id, code, title }) => ({ id, code, title })),
      modelBacked: false,
    };
  }

  async compareVersions(documentId: string, fromVersion: number, toVersion: number, actor: JwtUserPayload) {
    // Same predicate as every other read path, plus the APPROVED requirement.
    const visibleAndApproved = await this.access.documentWhereWithFilters(actor, {
      status: "APPROVED",
    });
    const document = await this.prisma.document.findFirst({
      where: { AND: [{ id: documentId }, visibleAndApproved] },
    });
    if (!document) {
      return { answer: "I can only compare versions of APPROVED documents you have access to.", sources: [] };
    }
    const [from, to] = await Promise.all([
      this.prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber: fromVersion } } }),
      this.prisma.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber: toVersion } } }),
    ]);
    if (!from || !to) return { answer: "One or both versions were not found.", sources: [] };

    const prompt = `Document ${document.code} — ${document.title}\n\nVersion ${fromVersion}:\n${from.contentMarkdown.slice(0, 3000)}\n\nVersion ${toVersion}:\n${to.contentMarkdown.slice(0, 3000)}\n\nSummarise the substantive differences for an executive audience.`;
    const answer = await this.aiClient.chatComplete(SYSTEM_PROMPT, prompt);

    return {
      answer: answer ?? `AI model access is not configured. Change summary on file for v${toVersion}: "${to.changeSummary ?? "none recorded"}". Use the Version History diff view for a line-level comparison.`,
      sources: [{ id: document.id, code: document.code, title: document.title }],
      modelBacked: Boolean(answer),
    };
  }

  async whatChangedThisMonth(actor: JwtUserPayload) {
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const visibleAndApproved = await this.access.documentWhereWithFilters(actor, {
      status: "APPROVED",
      updatedAt: { gte: since },
    });
    const docs = await this.prisma.document.findMany({
      where: visibleAndApproved,
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { category: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    if (docs.length === 0) {
      return { answer: "No approved documents have changed so far this month.", sources: [] };
    }

    const summary = docs
      .map((d) => `- ${d.code} (${d.category.name}): ${d.versions[0]?.changeSummary ?? "updated"}`)
      .join("\n");
    return {
      answer: `Approved documents changed this month:\n\n${summary}`,
      sources: docs.map((d) => ({ id: d.id, code: d.code, title: d.title })),
    };
  }
}
