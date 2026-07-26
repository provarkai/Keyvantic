import { Controller, Get, Param, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@Controller("audit")
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  @RequirePermissions("user:manage")
  recent(@Query("limit") limit?: string) {
    return this.audit.recent(limit ? Number(limit) : 50);
  }

  @Get(":entityType/:entityId")
  @RequirePermissions("user:manage")
  forEntity(@Param("entityType") entityType: string, @Param("entityId") entityId: string) {
    return this.audit.findForEntity(entityType, entityId);
  }
}
