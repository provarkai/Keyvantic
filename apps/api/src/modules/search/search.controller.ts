import { Controller, Get, Post, Query } from "@nestjs/common";
import { SearchService } from "./search.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("search")
export class SearchController {
  constructor(
    private searchService: SearchService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async search(
    @Query("q") q: string = "",
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: string,
    @Query("confidentiality") confidentiality?: string,
    @Query("tag") tag?: string,
    @Query("authorId") authorId?: string,
    @CurrentUser() user?: JwtUserPayload,
  ) {
    const guestSafe = user?.role === "GUEST";
    return this.searchService.fullTextSearch(q, {
      categoryId,
      status: guestSafe ? "APPROVED" : status,
      confidentiality: guestSafe ? "PUBLIC" : confidentiality,
      tag,
      authorId,
    });
  }

  @Get("semantic")
  @RequirePermissions("search:semantic")
  async semantic(
    @Query("q") q: string = "",
    @Query("categoryId") categoryId?: string,
    @Query("status") status?: string,
  ) {
    return this.searchService.semanticSearch(q, { categoryId, status });
  }

  @Post("reindex")
  @RequirePermissions("category:manage")
  reindex() {
    return this.searchService.reindexAll();
  }
}
