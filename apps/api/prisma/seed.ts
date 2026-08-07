/* eslint-disable no-console */
import { PrismaClient, RoleName, DocumentStatus, ConfidentialityLevel, RelationshipType } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { DEFAULT_ROLE_PERMISSIONS, formatDocumentCode } from "@keyvantic/types";

const prisma = new PrismaClient();

/**
 * The seed runs outside any request, so there is no tenant scope and RLS would reject
 * every write. Setting app.bypass_rls for the session is correct here and nowhere in
 * the application: this process is trusted and short-lived.
 */
async function bypassRls() {
  await prisma.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', false)");
}

const TENANT_SLUG = process.env.SEED_TENANT_SLUG ?? "keyvantic";
let tenantId = "";

// ── 1. Master Library folder tree (matches the KOS spec exactly) ──────────
interface CategorySeed {
  name: string;
  code: string;
  children?: CategorySeed[];
}

const MASTER_LIBRARY: CategorySeed[] = [
  {
    name: "01 Strategy",
    code: "STRAT",
    children: [
      { name: "Brand Strategy", code: "BS" },
      { name: "Vision", code: "VIS" },
      { name: "Mission", code: "MIS" },
      { name: "Business Plan", code: "BP" },
      { name: "Corporate Strategy", code: "CS" },
    ],
  },
  {
    name: "02 Brand",
    code: "BRAND",
    children: [
      { name: "Logo", code: "LOGO" },
      { name: "Brand Guidelines", code: "BG" },
      { name: "Messaging", code: "MSG" },
      { name: "Identity", code: "ID" },
      { name: "Templates", code: "TPL" },
    ],
  },
  {
    name: "03 Advisory",
    code: "ADV",
    children: [
      { name: "Consulting Methodology", code: "CM" },
      { name: "Frameworks", code: "FW" },
      { name: "Assessments", code: "ASM" },
      { name: "Workshops", code: "WS" },
    ],
  },
  {
    name: "04 Research",
    code: "RES",
    children: [
      { name: "Industry Reports", code: "IR" },
      { name: "AI Index", code: "AIX" },
      { name: "White Papers", code: "WP" },
      { name: "Publications", code: "PUB" },
    ],
  },
  {
    name: "05 Sales",
    code: "SALES",
    children: [
      { name: "Proposal Templates", code: "PT" },
      { name: "Pricing", code: "PRC" },
      { name: "Sales Playbook", code: "SP" },
      { name: "Case Studies", code: "CST" },
    ],
  },
  {
    name: "06 Marketing",
    code: "MKT",
    children: [
      { name: "Website", code: "WEB" },
      { name: "Campaigns", code: "CMP" },
      { name: "Content", code: "CNT" },
      { name: "Social Media", code: "SOC" },
    ],
  },
  {
    name: "07 Operations",
    code: "OPS",
    children: [
      { name: "SOPs", code: "SOP" },
      { name: "HR", code: "HR" },
      { name: "Finance", code: "FIN" },
      { name: "Legal", code: "LEG" },
    ],
  },
  {
    name: "08 Products",
    code: "PROD",
    children: [
      { name: "AI Tools", code: "AIT" },
      { name: "SaaS", code: "SAAS" },
      { name: "Roadmaps", code: "RDM" },
    ],
  },
  { name: "09 Clients", code: "CLIENTS" },
];

async function seedCategoryTree(nodes: CategorySeed[], parentId: string | null, sortOrder = 0) {
  for (const [index, node] of nodes.entries()) {
    const slug = node.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const category = await prisma.category.upsert({
      where: { tenantId_code: { tenantId, code: node.code } },
      update: {},
      create: { tenantId, name: node.name, code: node.code, slug, parentId, sortOrder: sortOrder + index },
    });
    if (node.children) await seedCategoryTree(node.children, category.id, 0);
  }
}

async function seedRoles() {
  const roles: Record<RoleName, { id: string }> = {} as any;
  for (const roleName of Object.values(RoleName)) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleName } },
      update: {},
      create: { tenantId, name: roleName, description: `${roleName} role`, isSystem: true },
    });
    roles[roleName] = role;

    const actions = DEFAULT_ROLE_PERMISSIONS[roleName];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: actions.map((action) => ({ tenantId, roleId: role.id, action })),
    });
  }
  return roles;
}

async function seedUsers(roles: Record<RoleName, { id: string }>) {
  const passwordHash = await bcrypt.hash("Keyvantic!2026", 12);
  const users = [
    { email: "admin@keyvantic.com", fullName: "Ada Okonkwo", title: "System Administrator", role: RoleName.ADMINISTRATOR },
    { email: "partner@keyvantic.com", fullName: "Muyiwa Lusi", title: "Managing Partner", role: RoleName.PARTNER },
    { email: "consultant@keyvantic.com", fullName: "Elena Marsh", title: "Senior Consultant", role: RoleName.CONSULTANT },
    { email: "researcher@keyvantic.com", fullName: "Kwame Asante", title: "Research Lead", role: RoleName.RESEARCHER },
    { email: "designer@keyvantic.com", fullName: "Priya Nair", title: "Brand Designer", role: RoleName.DESIGNER },
    { email: "sales@keyvantic.com", fullName: "Jonah Reyes", title: "Head of Sales", role: RoleName.SALES },
    { email: "marketing@keyvantic.com", fullName: "Sofia Bianchi", title: "Marketing Manager", role: RoleName.MARKETING },
    { email: "guest@keyvantic.com", fullName: "Guest Viewer", title: "External Guest", role: RoleName.GUEST },
  ];

  const created: Record<string, { id: string }> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, passwordHash, fullName: u.fullName, title: u.title },
    });
    // Role now lives on the membership, not the user — identity is global, the seat is
    // per firm.
    await prisma.tenantMember.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      update: { roleId: roles[u.role].id },
      create: { tenantId, userId: user.id, roleId: roles[u.role].id },
    });
    created[u.email] = user;
  }
  return created;
}

async function createDocument(opts: {
  categoryCode: string;
  title: string;
  summary: string;
  authorId: string;
  approverId?: string;
  status: DocumentStatus;
  confidentiality: ConfidentialityLevel;
  content: string;
  tags: string[];
}) {
  const category = await prisma.category.findUniqueOrThrow({
    where: { tenantId_code: { tenantId, code: opts.categoryCode } },
  });
  const sequence = await prisma.documentSequence.upsert({
    where: { tenantId_categoryId: { tenantId, categoryId: category.id } },
    update: { lastValue: { increment: 1 } },
    create: { tenantId, categoryId: category.id, lastValue: 1 },
  });
  const code = formatDocumentCode(category.code, sequence.lastValue);
  const wordCount = opts.content.trim().split(/\s+/).length;

  const document = await prisma.document.create({
    data: {
      tenantId,
      code,
      title: opts.title,
      summary: opts.summary,
      categoryId: category.id,
      authorId: opts.authorId,
      approverId: opts.approverId,
      status: opts.status,
      confidentiality: opts.confidentiality,
      readTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      wordCount,
      reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.documentVersion.create({
    data: {
      tenantId,
      documentId: document.id,
      versionNumber: 1,
      contentMarkdown: opts.content,
      contentHtml: `<p>${opts.content.replace(/\n/g, "<br/>")}</p>`,
      authorId: opts.authorId,
      wordCount,
      changeSummary: "Initial approved version",
    },
  });

  for (const tagName of opts.tags) {
    const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const tag = await prisma.tag.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {},
      create: { tenantId, name: tagName, slug },
    });
    await prisma.documentTag.create({
      data: { tenantId, documentId: document.id, tagId: tag.id },
    });
  }

  return document;
}

async function main() {
  console.log("Seeding Keyvantic KOS...");
  await bypassRls();

  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: {
      name: "Keyvantic",
      slug: TENANT_SLUG,
      vertical: "CONSULTING",
      status: "ACTIVE",
    },
  });
  tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);

  await seedCategoryTree(MASTER_LIBRARY, null);
  const roles = await seedRoles();
  const users = await seedUsers(roles);

  const partner = users["partner@keyvantic.com"];
  const consultant = users["consultant@keyvantic.com"];
  const researcher = users["researcher@keyvantic.com"];
  const sales = users["sales@keyvantic.com"];

  // ── Sample Master Library documents illustrating the reference chain:
  // Brand Strategy -> Company Profile -> Service Catalogue -> Consulting
  // Methodology -> KEYSHIFT Framework -> Proposal Templates -> Client Deliverables
  const brandStrategy = await createDocument({
    categoryCode: "BS",
    title: "Keyvantic Brand Strategy 2026",
    summary: "Positioning, voice, and target-segment strategy for Keyvantic, including guidance on engaging government clients.",
    authorId: partner.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "INTERNAL",
    content:
      "# Keyvantic Brand Strategy 2026\n\n## Positioning\nKeyvantic positions itself as the AI Business Transformation partner for mid-market and enterprise clients, blending McKinsey-grade rigor with startup-speed execution.\n\n## Government & Public Sector Clients\nWhen engaging government clients, lead with governance, auditability, and data-sovereignty guarantees before ROI. Case studies must be anonymized unless written consent is on file. Government engagements route through the Public Sector practice lead and require an additional security review gate prior to proposal submission.\n\n## Voice\nAuthoritative, plain-spoken, evidence-led. No hype language.",
    tags: ["brand", "strategy", "government"],
  });

  const consultingMethodology = await createDocument({
    categoryCode: "CM",
    title: "Keyvantic Consulting Methodology",
    summary: "The end-to-end delivery methodology used across all advisory engagements.",
    authorId: consultant.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "INTERNAL",
    content:
      "# Keyvantic Consulting Methodology\n\n## Phases\n1. Diagnose — current-state assessment\n2. Design — target operating model\n3. Mobilise — roadmap and business case\n4. Deliver — implementation support\n5. Sustain — governance and capability transfer\n\nVersion 2 introduces the KEYSHIFT Framework as the standard diagnostic lens for AI transformation engagements (see KV-FW-001).",
    tags: ["methodology", "advisory"],
  });
  await prisma.documentVersion.create({
    data: {
      tenantId,
      documentId: consultingMethodology.id,
      versionNumber: 2,
      contentMarkdown:
        "# Keyvantic Consulting Methodology (v2)\n\n## Phases\n1. Diagnose\n2. Design\n3. Mobilise\n4. Deliver\n5. Sustain\n\n## What's new in v2\nAdopts the KEYSHIFT Framework (KV-FW-001) as the mandatory diagnostic lens for all AI transformation engagements, replacing the ad hoc maturity model used in v1.",
      contentHtml: "<p>Consulting Methodology v2 — adopts KEYSHIFT Framework</p>",
      authorId: partner.id,
      wordCount: 60,
      changeSummary: "Adopted KEYSHIFT Framework as the standard diagnostic lens",
    },
  });
  await prisma.document.update({ where: { id: consultingMethodology.id }, data: { currentVersionNumber: 2 } });

  const keyshiftFramework = await createDocument({
    categoryCode: "FW",
    title: "KEYSHIFT Framework",
    summary: "Keyvantic's proprietary AI transformation diagnostic and roadmap framework.",
    authorId: partner.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "CONFIDENTIAL",
    content:
      "# KEYSHIFT Framework\n\nK — Knowledge audit\nE — Efficiency mapping\nY — Yield modelling\nS — Systems readiness\nH — Human capability\nI — Implementation roadmap\nF — Financial case\nT — Transformation governance\n\nUsed as the mandatory diagnostic lens in Phase 1 (Diagnose) of the Consulting Methodology.",
    tags: ["framework", "ai-transformation", "keyshift"],
  });

  const proposalTemplate = await createDocument({
    categoryCode: "PT",
    title: "Standard AI Transformation Proposal Template",
    summary: "Reusable proposal template built on the KEYSHIFT Framework and Consulting Methodology v2.",
    authorId: sales.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "INTERNAL",
    content:
      "# Proposal Template — AI Transformation Engagement\n\n1. Executive Summary\n2. Current-State Diagnosis (KEYSHIFT)\n3. Target Operating Model\n4. Roadmap & Milestones\n5. Commercial Terms\n6. Team & Governance",
    tags: ["proposal", "template", "sales"],
  });
  await prisma.document.update({ where: { id: proposalTemplate.id }, data: { isTemplate: true } });

  const aiIndex = await createDocument({
    categoryCode: "AIX",
    title: "Keyvantic AI Adoption Index — H1 2026",
    summary: "Quarterly benchmark of AI adoption maturity across Keyvantic's client industries.",
    authorId: researcher.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "PUBLIC",
    content: "# Keyvantic AI Adoption Index — H1 2026\n\nSummary of AI maturity benchmarks across financial services, public sector, and manufacturing clients.",
    tags: ["research", "ai-index"],
  });

  const governanceDraft = await createDocument({
    categoryCode: "LEG",
    title: "AI Governance Framework",
    summary: "Internal governance policy for responsible AI use across client engagements.",
    authorId: researcher.id,
    approverId: partner.id,
    status: "INTERNAL_REVIEW",
    confidentiality: "INTERNAL",
    content: "# AI Governance Framework (Draft)\n\nCovers model risk tiers, human-in-the-loop requirements, and client data handling for AI-enabled deliverables.",
    tags: ["governance", "ai", "policy"],
  });
  await prisma.approval.create({
    data: {
      tenantId,
      documentId: governanceDraft.id,
      documentVersionId: (
        await prisma.documentVersion.findFirstOrThrow({
          where: { documentId: governanceDraft.id },
        })
      ).id,
      reviewerId: partner.id,
    },
  });

  // ── Relationship graph chain ─────────────────────────────────────────────
  const chain: [string, string, RelationshipType][] = [
    [consultingMethodology.id, brandStrategy.id, "RELATES_TO"],
    [keyshiftFramework.id, consultingMethodology.id, "DERIVED_FROM"],
    [proposalTemplate.id, keyshiftFramework.id, "DEPENDS_ON"],
    [proposalTemplate.id, consultingMethodology.id, "DEPENDS_ON"],
  ];
  for (const [sourceDocumentId, targetDocumentId, type] of chain) {
    await prisma.documentRelationship.upsert({
      where: { sourceDocumentId_targetDocumentId_type: { sourceDocumentId, targetDocumentId, type } },
      update: {},
      create: { tenantId, sourceDocumentId, targetDocumentId, type },
    });
  }

  // ── Sample client with full sub-tree + a deliverable derived from the proposal template ──
  const clientsRoot = await prisma.category.findUniqueOrThrow({
    where: { tenantId_code: { tenantId, code: "CLIENTS" } },
  });
  const acmeRoot = await prisma.category.upsert({
    where: { tenantId_code: { tenantId, code: "ACME" } },
    update: {},
    create: { tenantId, name: "Acme Federal Logistics", code: "ACME", slug: "acme-federal-logistics", parentId: clientsRoot.id },
  });
  const acmeSubfolders = [
    { name: "Company Profile", code: "ACME-PROFILE" },
    { name: "Discovery Notes", code: "ACME-DISCOVERY" },
    { name: "Deliverables", code: "ACME-DELIV" },
    { name: "Reports", code: "ACME-REPORTS" },
    { name: "Meeting Notes", code: "ACME-MEETINGS" },
    { name: "AI Opportunities", code: "ACME-AIOPP" },
    { name: "Transformation Roadmap", code: "ACME-ROADMAP" },
  ];
  for (const [index, sf] of acmeSubfolders.entries()) {
    await prisma.category.upsert({
      where: { tenantId_code: { tenantId, code: sf.code } },
      update: {},
      create: { tenantId, name: sf.name, code: sf.code, slug: `acme-${sf.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, parentId: acmeRoot.id, sortOrder: index },
    });
  }
  await prisma.client.upsert({
    where: { rootCategoryId: acmeRoot.id },
    update: {},
    create: { tenantId, name: "Acme Federal Logistics", industry: "Public Sector Logistics", rootCategoryId: acmeRoot.id, primaryContact: "J. Alvarez, COO" },
  });

  const deliverable = await createDocument({
    categoryCode: "ACME-DELIV",
    title: "Acme Federal — AI Transformation Proposal",
    summary: "Client-specific proposal generated from the Standard AI Transformation Proposal Template.",
    authorId: sales.id,
    approverId: partner.id,
    status: "APPROVED",
    confidentiality: "CONFIDENTIAL",
    content: "# Acme Federal Logistics — AI Transformation Proposal\n\nBuilt on the Standard Proposal Template (KV-PT-001) and the KEYSHIFT Framework diagnostic.",
    tags: ["client-deliverable", "acme"],
  });
  await prisma.documentRelationship.upsert({
    where: {
      sourceDocumentId_targetDocumentId_type: {
        sourceDocumentId: deliverable.id,
        targetDocumentId: proposalTemplate.id,
        type: "DERIVED_FROM",
      },
    },
    update: {},
    create: { tenantId, sourceDocumentId: deliverable.id, targetDocumentId: proposalTemplate.id, type: "DERIVED_FROM" },
  });

  console.log("Seed complete.");
  console.log("Login with any seeded user, e.g. partner@keyvantic.com / Keyvantic!2026");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
