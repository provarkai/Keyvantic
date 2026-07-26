import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClientDto } from "./dto/create-client.dto";

const CLIENT_SUBFOLDERS = [
  { name: "Company Profile", code: "PROFILE" },
  { name: "Discovery Notes", code: "DISCOVERY" },
  { name: "Deliverables", code: "DELIV" },
  { name: "Reports", code: "REPORTS" },
  { name: "Meeting Notes", code: "MEETINGS" },
  { name: "AI Opportunities", code: "AIOPP" },
  { name: "Transformation Roadmap", code: "ROADMAP" },
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.client.findMany({
      include: { rootCategory: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findById(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
      include: { rootCategory: { include: { children: { include: { _count: { select: { documents: true } } } } } } },
    });
  }

  /** Creates the client record AND its full 09-Clients sub-tree in one transaction. */
  async create(dto: CreateClientDto, clientsRootCategoryId: string) {
    const slugBase = slugify(dto.name);
    const codeBase = dto.name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "CLI";

    return this.prisma.$transaction(async (tx) => {
      const rootCategory = await tx.category.create({
        data: {
          name: dto.name,
          code: codeBase,
          slug: slugBase,
          parentId: clientsRootCategoryId,
        },
      });

      await tx.category.createMany({
        data: CLIENT_SUBFOLDERS.map((sf, index) => ({
          name: sf.name,
          code: `${codeBase}-${sf.code}`,
          slug: `${slugBase}-${slugify(sf.name)}`,
          parentId: rootCategory.id,
          sortOrder: index,
        })),
      });

      return tx.client.create({
        data: {
          name: dto.name,
          industry: dto.industry,
          primaryContact: dto.primaryContact,
          logoUrl: dto.logoUrl,
          rootCategoryId: rootCategory.id,
        },
        include: { rootCategory: { include: { children: true } } },
      });
    });
  }
}
