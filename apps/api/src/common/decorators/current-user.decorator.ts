import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { JwtUserPayload } from "@keyvantic/types";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
