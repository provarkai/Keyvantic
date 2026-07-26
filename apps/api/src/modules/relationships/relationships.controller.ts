import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { RelationshipsService } from "./relationships.service";
import { CreateRelationshipDto } from "./dto/create-relationship.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller()
export class RelationshipsController {
  constructor(private relationships: RelationshipsService) {}

  @Get("graph")
  graph(@Query("categoryId") categoryId?: string) {
    return this.relationships.graph(categoryId);
  }

  @Post("documents/:documentId/relationships")
  @RequirePermissions("document:update")
  create(
    @Param("documentId") documentId: string,
    @Body() dto: CreateRelationshipDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.relationships.create(documentId, dto, user);
  }

  @Delete("relationships/:id")
  @RequirePermissions("document:update")
  remove(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.relationships.remove(id, user);
  }
}
