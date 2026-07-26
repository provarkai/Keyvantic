import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TagsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.tag.findMany({
      include: { _count: { select: { documents: true } } },
      orderBy: { name: "asc" },
    });
  }
}
