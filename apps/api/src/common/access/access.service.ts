import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfidentialityLevel, EngagementAccessLevel, Prisma } from "@prisma/client";
import type { JwtUserPayload } from "@keyvantic/types";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * The single document visibility predicate.
 *
 * Every read path — list, get, search, semantic search, export, AI retrieval,
 * notification bodies — must derive its `where` clause from `documentWhere()`. The
 * previous implementation had three divergent versions of this logic across the
 * documents, search, and ai modules, and the search path restricted only GUEST, so a
 * Marketing account could list RESTRICTED documents. One predicate, called everywhere,
 * is the only way that stays fixed.
 *
 * Tenant isolation is *not* handled here. It is enforced one layer down by Postgres
 * Row-Level Security (see the RLS migration), so a mistake in this file can widen
 * access within a firm but can never cross a tenant boundary.
 */

const LEVEL_RANK: Record<ConfidentialityLevel, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

/** Highest confidentiality a role may reach, before engagement scoping narrows it. */
const ROLE_CLEARANCE: Record<string, ConfidentialityLevel> = {
  ADMINISTRATOR: ConfidentialityLevel.RESTRICTED,
  PARTNER: ConfidentialityLevel.RESTRICTED,
  CONSULTANT: ConfidentialityLevel.CONFIDENTIAL,
  RESEARCHER: ConfidentialityLevel.CONFIDENTIAL,
  SALES: ConfidentialityLevel.CONFIDENTIAL,
  DESIGNER: ConfidentialityLevel.INTERNAL,
  MARKETING: ConfidentialityLevel.INTERNAL,
  GUEST: ConfidentialityLevel.PUBLIC,
};

/**
 * Roles that may see engagement documents without being on the engagement team.
 * Ethical walls still apply to them — that is the point of a wall.
 */
const CROSS_ENGAGEMENT_ROLES = new Set(["ADMINISTRATOR", "PARTNER"]);

/** Roles that may see documents which are not yet APPROVED, beyond their own drafts. */
const UNPUBLISHED_ROLES = new Set(["ADMINISTRATOR", "PARTNER"]);

export interface ActorScope {
  allowedEngagementIds: string[];
  /** Engagements the actor actively works on — LEAD or MEMBER, but not VIEWER. */
  contributorEngagementIds: string[];
  deniedEngagementIds: string[];
  clearance: ConfidentialityLevel;
  seesAllEngagements: boolean;
  seesUnpublished: boolean;
}

@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  private levelsUpTo(level: ConfidentialityLevel): ConfidentialityLevel[] {
    const max = LEVEL_RANK[level];
    return (Object.keys(LEVEL_RANK) as ConfidentialityLevel[]).filter(
      (l) => LEVEL_RANK[l] <= max,
    );
  }

  /** Resolve the actor's engagement memberships and clearance. */
  async scopeFor(actor: JwtUserPayload): Promise<ActorScope> {
    const memberships = await this.prisma.engagementMember.findMany({
      where: { userId: actor.sub },
      select: { engagementId: true, accessLevel: true },
    });

    return {
      allowedEngagementIds: memberships
        .filter((m) => m.accessLevel !== EngagementAccessLevel.DENIED)
        .map((m) => m.engagementId),
      contributorEngagementIds: memberships
        .filter(
          (m) =>
            m.accessLevel === EngagementAccessLevel.LEAD ||
            m.accessLevel === EngagementAccessLevel.MEMBER,
        )
        .map((m) => m.engagementId),
      deniedEngagementIds: memberships
        .filter((m) => m.accessLevel === EngagementAccessLevel.DENIED)
        .map((m) => m.engagementId),
      clearance: ROLE_CLEARANCE[actor.role] ?? ConfidentialityLevel.PUBLIC,
      seesAllEngagements: CROSS_ENGAGEMENT_ROLES.has(actor.role),
      seesUnpublished: UNPUBLISHED_ROLES.has(actor.role),
    };
  }

  /**
   * Build the `where` fragment describing everything this actor may read.
   *
   * Ordering of the rules matters:
   *   1. Ethical walls are absolute — applied outside every other clause, so no role
   *      and no ownership claim can reach past them.
   *   2. Authorship then grants access to your own work regardless of status or level.
   *   3. Otherwise clearance, publication status, and engagement membership all apply.
   */
  async documentWhere(actor: JwtUserPayload): Promise<Prisma.DocumentWhereInput> {
    const scope = await this.scopeFor(actor);

    // The null branch is load-bearing: `NOT (engagementId IN (...))` evaluates to NULL
    // — and so excludes the row — for firm-wide documents, where engagementId is NULL.
    // Without it, walling someone off one matter hid the entire library from them.
    const wall: Prisma.DocumentWhereInput = scope.deniedEngagementIds.length
      ? {
          OR: [
            { engagementId: null },
            { engagementId: { notIn: scope.deniedEngagementIds } },
          ],
        }
      : {};

    const engagementClause: Prisma.DocumentWhereInput = scope.seesAllEngagements
      ? {}
      : {
          OR: [
            { engagementId: null }, // firm-wide knowledge, not matter-specific
            { engagementId: { in: scope.allowedEngagementIds } },
          ],
        };

    const statusClause: Prisma.DocumentWhereInput = scope.seesUnpublished
      ? {}
      : { status: "APPROVED" };

    return {
      deletedAt: null,
      AND: [
        wall,
        {
          OR: [
            // Your own work is always yours, walls excepted.
            { authorId: actor.sub },
            {
              AND: [
                { confidentiality: { in: this.levelsUpTo(scope.clearance) } },
                statusClause,
                engagementClause,
              ],
            },
            // A matter team collaborates on drafts. Restricting engagement documents
            // to APPROVED would mean colleagues on the same engagement could not see
            // each other's work in progress, which is not how matters are run. Scoped
            // to active contributors, so a VIEWER still only sees approved output.
            ...(scope.contributorEngagementIds.length
              ? [
                  {
                    AND: [
                      { confidentiality: { in: this.levelsUpTo(scope.clearance) } },
                      { engagementId: { in: scope.contributorEngagementIds } },
                    ],
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }

  /**
   * The same rules, applied to uploaded files.
   *
   * Files have no approval lifecycle, so there is no status clause — otherwise this is
   * the document predicate: walls are absolute, your own uploads are yours, and
   * everything else needs clearance plus engagement membership.
   */
  async vaultItemWhere(actor: JwtUserPayload): Promise<Prisma.VaultItemWhereInput> {
    const scope = await this.scopeFor(actor);

    const wall: Prisma.VaultItemWhereInput = scope.deniedEngagementIds.length
      ? {
          OR: [
            { engagementId: null },
            { engagementId: { notIn: scope.deniedEngagementIds } },
          ],
        }
      : {};

    const engagementClause: Prisma.VaultItemWhereInput = scope.seesAllEngagements
      ? {}
      : {
          OR: [
            { engagementId: null },
            { engagementId: { in: scope.allowedEngagementIds } },
          ],
        };

    return {
      deletedAt: null,
      AND: [
        wall,
        {
          OR: [
            { uploadedById: actor.sub },
            {
              AND: [
                { confidentiality: { in: this.levelsUpTo(scope.clearance) } },
                engagementClause,
              ],
            },
          ],
        },
      ],
    };
  }

  /** Fetch a vault item by id, or throw, applying exactly the same rules. */
  async requireReadableVaultItem(id: string, actor: JwtUserPayload) {
    const where = await this.vaultItemWhere(actor);
    const item = await this.prisma.vaultItem.findFirst({ where: { AND: [{ id }, where] } });
    if (!item) throw new NotFoundException("File not found");
    return item;
  }

  /**
   * Narrow a caller-supplied filter so it can only ever subtract from what the actor
   * may see. Query parameters are combined with `AND`, never substituted for the
   * predicate — the previous search endpoint took `confidentiality` straight from the
   * query string, which let any non-GUEST role widen their own access.
   */
  async documentWhereWithFilters(
    actor: JwtUserPayload,
    filters: Prisma.DocumentWhereInput,
  ): Promise<Prisma.DocumentWhereInput> {
    return { AND: [await this.documentWhere(actor), filters] };
  }

  /** Fetch a document by id, or throw, applying exactly the same rules. */
  async requireReadableDocument(id: string, actor: JwtUserPayload) {
    const where = await this.documentWhere(actor);
    const document = await this.prisma.document.findFirst({
      where: { AND: [{ id }, where] },
    });
    if (!document) throw new NotFoundException("Document not found");
    return document;
  }

  /**
   * Assert the actor may contribute to an engagement. Read access is not enough —
   * VIEWER and DENIED both fail.
   */
  async requireEngagementWriteAccess(engagementId: string, actor: JwtUserPayload) {
    const membership = await this.prisma.engagementMember.findUnique({
      where: { engagementId_userId: { engagementId, userId: actor.sub } },
      select: { accessLevel: true },
    });

    if (membership?.accessLevel === EngagementAccessLevel.DENIED) {
      throw new ForbiddenException("You are walled off this engagement");
    }
    if (
      membership?.accessLevel === EngagementAccessLevel.LEAD ||
      membership?.accessLevel === EngagementAccessLevel.MEMBER
    ) {
      return;
    }
    if (CROSS_ENGAGEMENT_ROLES.has(actor.role)) return;

    throw new ForbiddenException("You are not on this engagement");
  }
}
