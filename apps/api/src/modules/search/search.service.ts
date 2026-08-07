import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MeiliSearch, type Index } from "meilisearch";
import { PrismaService } from "../../prisma/prisma.service";
import { AiClientService } from "../ai/ai-client.service";
import { AccessService } from "../../common/access/access.service";
import type { JwtUserPayload } from "@keyvantic/types";
import type { Prisma } from "@prisma/client";

const INDEX_NAME = "documents";

const DOCUMENT_STATUSES = ["DRAFT", "INTERNAL_REVIEW", "APPROVED", "ARCHIVED"] as const;
const CONFIDENTIALITY_LEVELS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;

export interface SearchFilters {
  categoryId?: string;
  engagementId?: string;
  status?: string;
  confidentiality?: string;
  tag?: string;
  authorId?: string;
}

/** Ids are opaque cuids; anything else in a filter position is not trusted. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function safeId(value: string | undefined): string | undefined {
  return value && ID_PATTERN.test(value) ? value : undefined;
}

function oneOf<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

/**
 * Build a Meilisearch filter expression from validated values only.
 *
 * Every component is either matched against a fixed enum or an id pattern before it
 * reaches the expression, so nothing user-supplied is interpolated verbatim. This is
 * belt-and-braces: the results are re-authorised against Postgres regardless.
 */
function buildFilterExpression(filters: SearchFilters): string | undefined {
  const parts: string[] = [];
  const categoryId = safeId(filters.categoryId);
  const tag = safeId(filters.tag);
  const status = oneOf(filters.status, DOCUMENT_STATUSES);
  const confidentiality = oneOf(filters.confidentiality, CONFIDENTIALITY_LEVELS);

  if (categoryId) parts.push(`categoryId = "${categoryId}"`);
  if (status) parts.push(`status = "${status}"`);
  if (confidentiality) parts.push(`confidentiality = "${confidentiality}"`);
  if (tag) parts.push(`tags = "${tag}"`);

  return parts.length ? parts.join(" AND ") : undefined;
}

/** Translate caller filters into a Prisma fragment, dropping anything unrecognised. */
function toPrismaFilter(filters: SearchFilters): Prisma.DocumentWhereInput {
  const status = oneOf(filters.status, DOCUMENT_STATUSES);
  const confidentiality = oneOf(filters.confidentiality, CONFIDENTIALITY_LEVELS);

  return {
    ...(safeId(filters.categoryId) ? { categoryId: filters.categoryId } : {}),
    ...(safeId(filters.engagementId) ? { engagementId: filters.engagementId } : {}),
    ...(safeId(filters.authorId) ? { authorId: filters.authorId } : {}),
    ...(status ? { status: status as Prisma.EnumDocumentStatusFilter["equals"] } : {}),
    ...(confidentiality
      ? { confidentiality: confidentiality as Prisma.EnumConfidentialityLevelFilter["equals"] }
      : {}),
    ...(safeId(filters.tag) ? { tags: { some: { tag: { slug: filters.tag } } } } : {}),
  };
}

/** A window of text around the first match, so a hit shows why it matched. */
function excerptAround(text: string | null, query: string, radius = 160): string | null {
  if (!text) return null;
  if (!query) return text.slice(0, radius * 2);

  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return text.slice(0, radius * 2);

  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function toSearchHit(d: {
  id: string;
  code: string;
  title: string;
  summary: string | null;
  categoryId: string;
  category: { name: string };
  status: string;
  confidentiality: string;
  author: { fullName: string };
  tags: { tag: { name: string } }[];
  updatedAt: Date;
}) {
  return {
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
  };
}

interface SearchableDocument {
  id: string;
  tenantId: string;
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
    private access: AccessService,
  ) {}

  async onModuleInit() {
    try {
      this.client = new MeiliSearch({
        host: this.config.get<string>("MEILI_HOST", "http://localhost:7700"),
        apiKey: this.config.get<string>("MEILI_MASTER_KEY"),
      });
      this.index = this.client.index<SearchableDocument>(INDEX_NAME);
      await this.index.updateFilterableAttributes([
        "tenantId",
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
      tenantId: doc.tenantId,
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

  /** Reindexes the calling tenant's documents only — RLS scopes the query. */
  async reindexAll() {
    const docs = await this.prisma.document.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    for (const d of docs) await this.indexDocument(d.id);
    return { indexed: docs.length };
  }

  /**
   * Full-text search.
   *
   * Meilisearch ranks; Postgres authorises. Hits from the index are only ever used as
   * a candidate id list, which is then run back through the visibility predicate — so
   * the index cannot become a second, weaker access-control surface, and a stale or
   * poisoned index cannot leak a document.
   *
   * The previous version passed the caller's `confidentiality` query parameter
   * straight into a Meilisearch filter string, which both allowed any non-GUEST role
   * to widen its own access and interpolated user input into the filter expression.
   */
  async fullTextSearch(
    query: string,
    filters: SearchFilters,
    actor: JwtUserPayload,
    limit = 20,
  ) {
    const visibility = await this.access.documentWhereWithFilters(actor, toPrismaFilter(filters));

    if (!this.index) return this.rankedByPostgres(query, visibility, limit);

    let candidateIds: string[];
    try {
      // Over-fetch: some hits will be filtered out by the predicate below.
      const result = await this.index.search(query, {
        filter: buildFilterExpression(filters),
        limit: Math.min(limit * 5, 200),
        attributesToHighlight: ["title", "summary", "content"],
      });
      candidateIds = result.hits.map((h) => h.id);
    } catch (err) {
      this.logger.warn(`Meilisearch query failed, using fallback: ${(err as Error).message}`);
      return this.rankedByPostgres(query, visibility, limit);
    }

    if (candidateIds.length === 0) return [];

    const permitted = await this.prisma.document.findMany({
      where: { AND: [visibility, { id: { in: candidateIds } }] },
      include: { category: true, author: true, tags: { include: { tag: true } } },
    });

    // Restore Meilisearch's relevance order, which the id-based refetch loses.
    const rank = new Map(candidateIds.map((id, i) => [id, i]));
    return permitted
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
      .slice(0, limit)
      .map(toSearchHit);
  }

  /**
   * Search uploaded files by name and extracted text.
   *
   * Runs entirely in Postgres against `VaultFileVersion.extractedText`, scoped by the
   * vault predicate. Only WORKING files have extracted text at all, so SEALED files
   * can match on name but never on content — which is the classification working as
   * intended rather than a gap.
   */
  async searchVaultFiles(query: string, actor: JwtUserPayload, limit = 20) {
    const visibility = await this.access.vaultItemWhere(actor);

    const items = await this.prisma.vaultItem.findMany({
      where: {
        AND: [
          visibility,
          query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                  {
                    versions: {
                      some: { extractedText: { contains: query, mode: "insensitive" } },
                    },
                  },
                ],
              }
            : {},
        ],
      },
      include: {
        engagement: { select: { id: true, name: true, reference: true } },
        uploadedBy: { select: { fullName: true } },
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return items.map((item) => {
      const latest = item.versions[0];
      return {
        id: item.id,
        kind: "file" as const,
        name: item.name,
        originalName: latest?.originalName,
        mimeType: latest?.mimeType,
        sizeBytes: latest?.sizeBytes,
        classification: item.classification,
        confidentiality: item.confidentiality,
        engagement: item.engagement,
        uploadedBy: item.uploadedBy.fullName,
        excerpt: excerptAround(latest?.extractedText ?? null, query),
        updatedAt: item.updatedAt.getTime(),
      };
    });
  }

  /** Postgres search over exactly the documents the actor may read. */
  private async rankedByPostgres(
    query: string,
    visibility: Prisma.DocumentWhereInput,
    limit: number,
  ) {
    const docs = await this.prisma.document.findMany({
      where: {
        AND: [
          visibility,
          query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { summary: { contains: query, mode: "insensitive" } },
                  { code: { contains: query, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      include: { category: true, author: true, tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return docs.map(toSearchHit);
  }

  /**
   * Semantic search over the actor's visible corpus.
   *
   * Candidates are drawn through the visibility predicate before anything is embedded,
   * so a document the actor cannot read is never sent to the embedding provider and
   * can never surface in results. The previous version applied no filter at all here.
   */
  async semanticSearch(
    query: string,
    filters: SearchFilters,
    actor: JwtUserPayload,
    limit = 20,
  ) {
    if (!this.aiClient.isEnabled()) {
      return this.fullTextSearch(query, filters, actor, limit);
    }

    const visibility = await this.access.documentWhereWithFilters(actor, toPrismaFilter(filters));
    const candidates = await this.prisma.document.findMany({
      where: visibility,
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
