import { Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

/**
 * Every parameter here is a *narrowing* hint. None of them can widen what the caller
 * may see — SearchService runs them through the visibility predicate, which is derived
 * from the authenticated principal alone.
 */
@ApiTags("search")
@Controller("search")
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  async search(
    @CurrentUser() user: JwtUserPayload,
    @Query("q") q = "",
    @Query("categoryId") categoryId?: string,
    @Query("engagementId") engagementId?: string,
    @Query("status") status?: string,
    @Query("confidentiality") confidentiality?: string,
    @Query("tag") tag?: string,
    @Query("authorId") authorId?: string,
  ) {
    return this.searchService.fullTextSearch(
      q,
      { categoryId, engagementId, status, confidentiality, tag, authorId },
      user,
    );
  }

  @Get("semantic")
  @RequirePermissions("search:semantic")
  async semantic(
    @CurrentUser() user: JwtUserPayload,
    @Query("q") q = "",
    @Query("categoryId") categoryId?: string,
    @Query("engagementId") engagementId?: string,
    @Query("status") status?: string,
  ) {
    return this.searchService.semanticSearch(q, { categoryId, engagementId, status }, user);
  }

  @Post("reindex")
  @RequirePermissions("category:manage")
  async reindex() {
    return this.searchService.reindexAll();
  }
}
