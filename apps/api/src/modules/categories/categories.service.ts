import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  /** Returns the full Master Library tree with document counts per node. */
  async getTree() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { documents: true } } },
    });

    const byId = new Map(categories.map((c) => [c.id, { ...c, children: [] as any[] }]));
    const roots: any[] = [];
    for (const cat of byId.values()) {
      if (cat.parentId && byId.has(cat.parentId)) {
        byId.get(cat.parentId)!.children.push(cat);
      } else {
        roots.push(cat);
      }
    }
    return roots;
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  async create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        slug: slugify(dto.name),
        description: dto.description,
        icon: dto.icon,
        parentId: dto.parentId,
      },
    });
  }

  async completionStats() {
    // "Completion" heuristic: proportion of leaf categories that have at
    // least one APPROVED document, weighted equally across the Master Library.
    const leaves = await this.prisma.category.findMany({
      where: { children: { none: {} } },
      select: {
        id: true,
        documents: { select: { status: true }, take: 50 },
      },
    });
    if (leaves.length === 0) return { percentage: 0, completedFolders: 0, totalFolders: 0 };

    const completed = leaves.filter((l) => l.documents.some((d) => d.status === "APPROVED")).length;
    return {
      percentage: Math.round((completed / leaves.length) * 100),
      completedFolders: completed,
      totalFolders: leaves.length,
    };
  }
}
