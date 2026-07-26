import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { RolesService } from "./roles.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { UpdateRolePermissionsDto } from "./dto/update-role-permissions.dto";
import { RoleName } from "@keyvantic/types";

@Controller("roles")
export class RolesController {
  constructor(private roles: RolesService) {}

  @Get()
  @RequirePermissions("role:manage")
  list() {
    return this.roles.list();
  }

  @Get("permission-actions")
  @RequirePermissions("role:manage")
  actions() {
    return this.roles.availableActions();
  }

  @Put(":roleName/permissions")
  @RequirePermissions("role:manage")
  setPermissions(@Param("roleName") roleName: RoleName, @Body() dto: UpdateRolePermissionsDto) {
    return this.roles.setPermissions(roleName, dto.actions);
  }
}
