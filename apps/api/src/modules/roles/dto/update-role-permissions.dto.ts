import { ArrayUnique, IsArray, IsIn } from "class-validator";
import { PERMISSION_ACTIONS, type PermissionAction } from "@keyvantic/types";

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_ACTIONS, { each: true })
  actions!: PermissionAction[];
}
