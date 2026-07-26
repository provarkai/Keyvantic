import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@Controller("users")
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @RequirePermissions("user:manage")
  list() {
    return this.users.list();
  }

  @Get(":id")
  @RequirePermissions("user:manage")
  findOne(@Param("id") id: string) {
    return this.users.findById(id);
  }

  @Post()
  @RequirePermissions("user:manage")
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("user:manage")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("user:manage")
  remove(@Param("id") id: string) {
    return this.users.remove(id);
  }
}
