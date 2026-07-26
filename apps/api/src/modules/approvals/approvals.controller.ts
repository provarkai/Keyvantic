import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { DecideApprovalDto } from "./dto/decide-approval.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("approvals")
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

  @Get("pending")
  pending(@CurrentUser() user: JwtUserPayload) {
    return this.approvals.pendingForReviewer(user);
  }

  @Get("documents/:documentId")
  history(@Param("documentId") documentId: string) {
    return this.approvals.historyForDocument(documentId);
  }

  @Patch(":id/decision")
  decide(@Param("id") id: string, @Body() dto: DecideApprovalDto, @CurrentUser() user: JwtUserPayload) {
    return this.approvals.decide(id, dto, user);
  }
}
