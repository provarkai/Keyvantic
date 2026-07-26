import { Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "@keyvantic/types";

@Controller("notifications")
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUserPayload, @Query("unreadOnly") unreadOnly?: string) {
    return this.notifications.listForUser(user.sub, unreadOnly === "true");
  }

  @Get("unread-count")
  unreadCount(@CurrentUser() user: JwtUserPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: JwtUserPayload) {
    return this.notifications.markRead(id, user.sub);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: JwtUserPayload) {
    return this.notifications.markAllRead(user.sub);
  }
}
