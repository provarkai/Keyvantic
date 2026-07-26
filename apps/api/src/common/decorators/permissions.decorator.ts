import { SetMetadata } from "@nestjs/common";
import type { PermissionAction } from "@keyvantic/types";

export const PERMISSIONS_KEY = "permissions";

/** Require the current user to hold ALL of the given permission actions. */
export const RequirePermissions = (...permissions: PermissionAction[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
