import { Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { JwtUserPayload } from "@keyvantic/types";
import { EngagementsService } from "./engagements.service";
import { CreateEngagementDto } from "./dto/create-engagement.dto";
import { SetMemberDto } from "./dto/set-member.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@ApiTags("engagements")
@Controller("engagements")
export class EngagementsController {
  constructor(private engagements: EngagementsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload) {
    return this.engagements.list(user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.engagements.findById(id, user);
  }

  @Post()
  @RequirePermissions("engagement:manage")
  create(@Body() dto: CreateEngagementDto, @CurrentUser() user: JwtUserPayload) {
    return this.engagements.create(dto, user);
  }

  @Put(":id/members")
  @RequirePermissions("engagement:manage")
  setMember(
    @Param("id") id: string,
    @Body() dto: SetMemberDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.engagements.setMember(id, dto, user);
  }

  @Delete(":id/members/:userId")
  @RequirePermissions("engagement:manage")
  removeMember(
    @Param("id") id: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return this.engagements.removeMember(id, userId, user);
  }
}
