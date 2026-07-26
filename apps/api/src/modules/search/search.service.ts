import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MeiliSearch, type Index } from "meilisearch";
import { PrismaService } from "../../prisma/prisma.service";
import { AiClientService } from "../ai/ai-client.service";

const INDEX_NAME = "documents";

interface SearchableDocument {
  id: string;
  code: string;
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  categoryName: string;
  status: string;
  confidentiality: string;
  authorName: string;
  tags: string[];
  updatedAt: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: MeiliSearch | null = null;
  private index: Index<SearchableDocument> | null = null;
  private embeddingCache = new Map<string, number[]>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private aiClient: AiClientService,
  ) {}

  async onModuleInit() {
    try {
      this.client = new MeiliSearch({
        host: this.config.get<string>("MEILI_HOST", "http://localhost:7700"),
        apiKey: this.config.get<string>("MEILI_MASTER_KEY"),
      });
      this.index = this.client.index<SearchableDocument>(INDEX_NAME);
      await this.index.updateFilterableAttributes([
        "categoryId",
        "status",
        "confidentiality",
        "tags",
        "authorName",
      ]);
      await this.index.updateSortableAttributes(["updatedAt"]);
    } catch (err) {
      this.logger.warn(
        `Meilisearch unavailable at startup — full-text search will degrade to a Postgres fallback until it recovers. (${(err as Error).message})`,
      );
    }
  }

  async indexDocument(documentId: string) {
    if (!this.index) return;
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        category: true,
        author: true,
        tags: { include: { tag: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
    });
    if (!doc) return;

    const payload: SearchableDocument = {
      id: doc.id,
      code: doc.code,
      title: doc.title,
      summary: doc.summary ?? "",
      content: doc.versions[0]?.contentMarkdown ?? "",
      categoryId: doc.categoryId,
      categoryName: doc.category.name,
      status: doc.status,
      confidentiality: doc.confidentiality,
      authorName: doc.author.fullName,
      tags: doc.tags.map((t) => t.tag.name),
      updatedAt: doc.updatedAt.getTime(),
    };

    try {
      await this.index.addDocuments([payload]);
    } catch (err) {
      this.logger.warn(`Failed to index document ${documentId}: ${(err as Error).message}`);
    }
  }

  async removeDocument(documentId: string) {
    try {
      await this.index?.deleteDocument(documentId);
    } catch {
      // index may be unavailable — non-fatal
    }
  }

  async reindexAll() {
    const docs = await this.prisma.document.findMany({ where: { deletedAt: null }, select: { id: true } });
    for (const d of docs) await this.indexDocument(d.id);
    return { indexed: docs.length };
  }

  /** Full-text + faceted search, restricted by role/confidentiality upstream by the caller. */
  async fullTextSearch(
    query: string,
    filters: { categoryId?: string; status?: string; confidentiality?: string; tag?: string; authorId?: string },
    limit = 20,
  ) {
    if (!this.index) return this.fallbackSearch(query, filters, limit);

    const filterExpr: string[] = [];
    if (filters.categoryId) filterExpr.push(`categoryId = "${filters.categoryId}"`);
    if (filters.status) filterExpr.push(`status = "${filters.status}"`);
    if (filters.confidentiality) filterExpr.push(`confidentiality = "${filters.confidentiality}"`);
    if (filters.tag) filterExpr.push(`tags = "${filters.tag}"`);

    try {
      const result = await this.index.search(query, {
        filter: filterExpr.length ? filterExpr.join(" AND ") : undefined,
        limit,
        attributesToHighlight: ["title", "summary", "content"],
      });
      return result.hits;
    } catch (err) {
      this.logger.warn(`Meilisearch query failed, using fallback: ${(err as Error).message}`);
      return this.fallbackSearch(query, filters, limit);
    }
  }

  /** Postgres ILIKE fallback used when Meilisearch is unreachable (dev environments, outages). */
  private async fallbackSearch(
    query: string,
    filters: { categoryId?: string; status?: string; confidentiality?: string; tag?: string },
    limit: number,
  ) {
    const docs = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.status ? { status: filters.status as any } : {}),
        ...(filters.confidentiality ? { confidentiality: filters.confidentiality as any } : {}),
        ...(filters.tag ? { tags: { some: { tag: { slug: filters.tag } } } } : {}),
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
        ],
      },
      include: { category: true, author: true, tags: { include: { tag: true } } },
      take: limit,
    });
    return docs.map((d) => ({
      id: d.id,
      code: d.code,
      title: d.title,
      summary: d.summary,
      categoryId: d.categoryId,
      categoryName: d.category.name,
      status: d.status,
      confidentiality: d.confidentiality,
      authorName: d.author.fullName,
      tags: d.tags.map((t) => t.tag.name),
      updatedAt: d.updatedAt.getTime(),
    }));
  }

  /**
   * Semantic search: embeds the query and each candidate document (cached),
   * ranks by cosine similarity. Requires OPENAI_API_KEY — otherwise falls
   * back transparently to full-text search.
   */
  async semanticSearch(
    query: string,
    filters: { categoryId?: string; status?: string; confidentiality?: string },
    limit = 20,
  ) {
    if (!this.aiClient.isEnabled()) {
      return this.fullTextSearch(query, filters, limit);
    }

    const candidates = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        status: filters.status ? (filters.status as any) : undefined,
        categoryId: filters.categoryId,
        confidentiality: filters.confidentiality ? (filters.confidentiality as any) : undefined,
      },
      include: { category: true, author: true },
      take: 200,
    });
    if (candidates.length === 0) return [];

    const queryEmbedding = await this.aiClient.embed(query);
    const scored = await Promise.all(
      candidates.map(async (doc) => {
        const text = `${doc.title}\n${doc.summary ?? ""}`;
        let embedding = this.embeddingCache.get(doc.id);
        if (!embedding) {
          embedding = await this.aiClient.embed(text);
          this.embeddingCache.set(doc.id, embedding);
        }
        return { doc, score: cosineSimilarity(queryEmbedding, embedding) };
      }),
    );

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ doc, score }) => ({
        id: doc.id,
        code: doc.code,
        title: doc.title,
        summary: doc.summary,
        categoryName: doc.category.name,
        status: doc.status,
        confidentiality: doc.confidentiality,
        authorName: doc.author.fullName,
        score,
      }));
  }

  invalidateEmbeddingCache(documentId: string) {
    this.embeddingCache.delete(documentId);
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
