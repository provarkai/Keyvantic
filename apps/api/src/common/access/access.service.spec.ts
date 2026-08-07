import { PrismaClient } from "@prisma/client";
import type { JwtUserPayload } from "@keyvantic/types";
import { AccessService } from "./access.service";
import { TenantContext } from "../tenant/tenant-context";
import { PrismaService, prismaProvider } from "../../prisma/prisma.service";

/**
 * Integration tests for the visibility predicate and the RLS boundary underneath it.
 *
 * These run against a real Postgres because the properties being asserted — that RLS
 * denies by default, that a walled user sees nothing — are properties of the database,
 * not of the TypeScript. A mocked Prisma would pass while the real system leaked.
 */

const raw = new PrismaClient();
let prisma: PrismaService;
let access: AccessService;

const ids = {
  tenantA: "t_access_a",
  tenantB: "t_access_b",
  roleAPartner: "r_access_a_partner",
  roleAConsultant: "r_access_a_consultant",
  roleAMarketing: "r_access_a_marketing",
  roleBPartner: "r_access_b_partner",
  partner: "u_access_partner",
  consultant: "u_access_consultant",
  walled: "u_access_walled",
  marketing: "u_access_marketing",
  outsider: "u_access_outsider",
  category: "c_access_a",
  categoryB: "c_access_b",
  client: "cl_access_a",
  engagement: "e_access_a",
  docFirmWide: "d_access_firmwide",
  docEngagement: "d_access_engagement",
  docRestricted: "d_access_restricted",
  docOtherTenant: "d_access_other_tenant",
};

function actor(userId: string, role: string): JwtUserPayload {
  return {
    sub: userId,
    tenantId: ids.tenantA,
    email: `${userId}@test.local`,
    role: role as JwtUserPayload["role"],
    permissions: [],
  };
}

/** Run a query the way a request would: inside a tenant scope. */
function asTenantA<T>(fn: () => Promise<T>) {
  return TenantContext.run({ tenantId: ids.tenantA }, fn);
}

async function seed() {
  await raw.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");

  await raw.tenant.createMany({
    data: [
      { id: ids.tenantA, name: "Alpha LLP", slug: "access-alpha", status: "ACTIVE" },
      { id: ids.tenantB, name: "Beta LLP", slug: "access-beta", status: "ACTIVE" },
    ],
  });

  await raw.role.createMany({
    data: [
      { id: ids.roleAPartner, tenantId: ids.tenantA, name: "PARTNER" },
      { id: ids.roleAConsultant, tenantId: ids.tenantA, name: "CONSULTANT" },
      { id: ids.roleAMarketing, tenantId: ids.tenantA, name: "MARKETING" },
      { id: ids.roleBPartner, tenantId: ids.tenantB, name: "PARTNER" },
    ],
  });

  const people = [
    [ids.partner, "Pat Partner"],
    [ids.consultant, "Con Consultant"],
    [ids.walled, "Wanda Walled"],
    [ids.marketing, "Mo Marketing"],
    [ids.outsider, "Otto Outsider"],
  ] as const;

  await raw.user.createMany({
    data: people.map(([id, fullName]) => ({
      id,
      email: `${id}@test.local`,
      passwordHash: "x",
      fullName,
    })),
  });

  await raw.tenantMember.createMany({
    data: [
      { tenantId: ids.tenantA, userId: ids.partner, roleId: ids.roleAPartner },
      { tenantId: ids.tenantA, userId: ids.consultant, roleId: ids.roleAConsultant },
      { tenantId: ids.tenantA, userId: ids.walled, roleId: ids.roleAConsultant },
      { tenantId: ids.tenantA, userId: ids.marketing, roleId: ids.roleAMarketing },
      { tenantId: ids.tenantA, userId: ids.outsider, roleId: ids.roleAConsultant },
    ],
  });

  await raw.category.createMany({
    data: [
      { id: ids.category, tenantId: ids.tenantA, name: "Advisory", code: "ADV", slug: "advisory" },
      { id: ids.categoryB, tenantId: ids.tenantB, name: "Advisory", code: "ADV", slug: "advisory" },
    ],
  });

  await raw.client.create({
    data: {
      id: ids.client,
      tenantId: ids.tenantA,
      name: "Acme",
      rootCategoryId: ids.category,
    },
  });

  await raw.engagement.create({
    data: {
      id: ids.engagement,
      tenantId: ids.tenantA,
      clientId: ids.client,
      reference: "M-001",
      name: "Acme merger",
      leadId: ids.consultant,
    },
  });

  await raw.engagementMember.createMany({
    data: [
      {
        tenantId: ids.tenantA,
        engagementId: ids.engagement,
        userId: ids.consultant,
        accessLevel: "LEAD",
      },
      // The ethical wall under test.
      {
        tenantId: ids.tenantA,
        engagementId: ids.engagement,
        userId: ids.walled,
        accessLevel: "DENIED",
      },
      {
        tenantId: ids.tenantA,
        engagementId: ids.engagement,
        userId: ids.partner,
        accessLevel: "DENIED",
      },
    ],
  });

  const baseDoc = {
    categoryId: ids.category,
    authorId: ids.partner,
    status: "APPROVED" as const,
    currentVersionNumber: 1,
  };

  await raw.document.createMany({
    data: [
      {
        ...baseDoc,
        id: ids.docFirmWide,
        tenantId: ids.tenantA,
        code: "KV-ADV-001",
        title: "Firm-wide playbook",
        confidentiality: "INTERNAL",
      },
      {
        ...baseDoc,
        id: ids.docEngagement,
        tenantId: ids.tenantA,
        code: "KV-ADV-002",
        title: "Acme merger memo",
        engagementId: ids.engagement,
        confidentiality: "CONFIDENTIAL",
        // Authored by the partner, who is walled off it — so the wall test proves the
        // wall beats authorship, and the consultant's access comes purely from being
        // on the engagement team.
        authorId: ids.partner,
      },
      {
        ...baseDoc,
        id: ids.docRestricted,
        tenantId: ids.tenantA,
        code: "KV-ADV-003",
        title: "Board compensation",
        confidentiality: "RESTRICTED",
      },
      {
        ...baseDoc,
        id: ids.docOtherTenant,
        tenantId: ids.tenantB,
        code: "KV-ADV-001",
        title: "Beta confidential",
        categoryId: ids.categoryB,
        authorId: ids.outsider,
        confidentiality: "INTERNAL",
      },
    ],
  });
}

async function cleanup() {
  await raw.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");
  await raw.document.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await raw.engagementMember.deleteMany({ where: { engagementId: ids.engagement } });
  await raw.engagement.deleteMany({ where: { id: ids.engagement } });
  await raw.client.deleteMany({ where: { id: ids.client } });
  await raw.category.deleteMany({ where: { id: { in: [ids.category, ids.categoryB] } } });
  await raw.tenantMember.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await raw.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await raw.role.deleteMany({ where: { tenantId: { in: [ids.tenantA, ids.tenantB] } } });
  await raw.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } });
}

/** Titles the actor can see, sorted, so assertions read as an exact allowlist. */
async function visibleTitles(who: JwtUserPayload): Promise<string[]> {
  return asTenantA(async () => {
    const where = await access.documentWhere(who);
    const docs = await prisma.document.findMany({ where, select: { title: true } });
    return docs.map((d) => d.title).sort();
  });
}

describe("AccessService — document visibility", () => {
  beforeAll(async () => {
    prisma = await prismaProvider.useFactory();
    access = new AccessService(prisma);
    await cleanup();
    await seed();
  });

  afterAll(async () => {
    await cleanup();
    await raw.$disconnect();
    await prisma.$disconnect();
  });

  it("denies everything when no tenant scope is set", async () => {
    // No TenantContext.run: RLS has no app.tenant_id to match, so nothing is readable.
    const docs = await prisma.document.findMany({ where: { deletedAt: null } });
    expect(docs).toHaveLength(0);
  });

  it("never returns another tenant's documents", async () => {
    for (const who of [
      actor(ids.partner, "PARTNER"),
      actor(ids.consultant, "CONSULTANT"),
      actor(ids.marketing, "MARKETING"),
    ]) {
      const titles = await visibleTitles(who);
      expect(titles).not.toContain("Beta confidential");
    }
  });

  it("lets an engagement member see that engagement's documents", async () => {
    const titles = await visibleTitles(actor(ids.consultant, "CONSULTANT"));
    expect(titles).toContain("Acme merger memo");
  });

  it("hides engagement documents from someone not on the team", async () => {
    const titles = await visibleTitles(actor(ids.outsider, "CONSULTANT"));
    expect(titles).not.toContain("Acme merger memo");
    expect(titles).toContain("Firm-wide playbook");
  });

  it("enforces an ethical wall against a partner who would otherwise see everything", async () => {
    // The partner is DENIED on this engagement *and* authored other documents, so this
    // covers both the cross-engagement role bypass and the authorship bypass.
    const titles = await visibleTitles(actor(ids.partner, "PARTNER"));
    expect(titles).not.toContain("Acme merger memo");
    expect(titles).toContain("Board compensation");
  });

  it("keeps a walled consultant out even though they hold the role for it", async () => {
    const titles = await visibleTitles(actor(ids.walled, "CONSULTANT"));
    expect(titles).not.toContain("Acme merger memo");
  });

  it("does not let a low-clearance role reach RESTRICTED documents", async () => {
    // This is the regression that shipped: search restricted only GUEST, so a
    // MARKETING account could list RESTRICTED material.
    const titles = await visibleTitles(actor(ids.marketing, "MARKETING"));
    expect(titles).not.toContain("Board compensation");
    expect(titles).toContain("Firm-wide playbook");
  });

  it("lets an engagement contributor see unapproved work on their own matter", async () => {
    // A matter team collaborates on drafts; restricting them to APPROVED would hide
    // colleagues' work in progress on their own engagement.
    await raw.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");
    await raw.document.update({
      where: { id: ids.docEngagement },
      data: { status: "DRAFT" },
    });

    try {
      const contributor = await visibleTitles(actor(ids.consultant, "CONSULTANT"));
      expect(contributor).toContain("Acme merger memo");

      // A VIEWER on the same engagement sees approved output only.
      await raw.engagementMember.update({
        where: {
          engagementId_userId: { engagementId: ids.engagement, userId: ids.consultant },
        },
        data: { accessLevel: "VIEWER" },
      });
      const viewer = await visibleTitles(actor(ids.consultant, "CONSULTANT"));
      expect(viewer).not.toContain("Acme merger memo");
    } finally {
      await raw.engagementMember.update({
        where: {
          engagementId_userId: { engagementId: ids.engagement, userId: ids.consultant },
        },
        data: { accessLevel: "LEAD" },
      });
      await raw.document.update({
        where: { id: ids.docEngagement },
        data: { status: "APPROVED" },
      });
    }
  });

  it("still keeps firm-wide documents visible to someone walled off one matter", async () => {
    // Regression: `NOT (engagementId IN (...))` is NULL for firm-wide documents, so
    // an unguarded wall clause hid the entire library from anyone walled off anything.
    const titles = await visibleTitles(actor(ids.walled, "CONSULTANT"));
    expect(titles).toContain("Firm-wide playbook");
  });

  it("treats caller-supplied filters as narrowing only, never widening", async () => {
    const marketing = actor(ids.marketing, "MARKETING");

    const titles = await asTenantA(async () => {
      // Exactly the shape a crafted `?confidentiality=RESTRICTED` would take.
      const where = await access.documentWhereWithFilters(marketing, {
        confidentiality: "RESTRICTED",
      });
      const docs = await prisma.document.findMany({ where, select: { title: true } });
      return docs.map((d) => d.title);
    });

    expect(titles).toHaveLength(0);
  });

  it("refuses a direct fetch by id of a document outside the predicate", async () => {
    await expect(
      asTenantA(() =>
        access.requireReadableDocument(ids.docEngagement, actor(ids.outsider, "CONSULTANT")),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("blocks writes to an engagement the actor is walled off", async () => {
    await expect(
      asTenantA(() =>
        access.requireEngagementWriteAccess(ids.engagement, actor(ids.walled, "CONSULTANT")),
      ),
    ).rejects.toThrow(/walled off/i);
  });
});
