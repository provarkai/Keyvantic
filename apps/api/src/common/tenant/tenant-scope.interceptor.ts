import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";
import type { JwtUserPayload } from "@keyvantic/types";
import { TenantContext } from "./tenant-context";

/**
 * Copies the authenticated tenant into the request's tenant scope.
 *
 * Runs after the auth guards, so `request.user` carries a validated JWT. The tenant id
 * comes from the signed token and never from a header, query string, or body — a
 * client-supplied tenant id would defeat the entire isolation model.
 */
@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user: JwtUserPayload | undefined = request?.user;

    if (user?.tenantId) {
      TenantContext.set({ tenantId: user.tenantId, userId: user.sub });
    }

    return next.handle();
  }
}
