import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@Controller("categories")
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get("tree")
  getTree() {
    return this.categories.getTree();
  }

  @Get("completion")
  completion() {
    return this.categories.completionStats();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.categories.findById(id);
  }

  @Post()
  @RequirePermissions("category:manage")
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }
}
