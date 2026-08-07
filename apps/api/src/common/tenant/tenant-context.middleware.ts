import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { TenantContext } from "./tenant-context";

/**
 * Opens an (initially empty) tenant scope for the lifetime of the request.
 *
 * Middleware runs before guards, so the tenant is not known yet — `TenantScopeInterceptor`
 * fills it in once the JWT has been validated. Establishing the store here rather than in
 * the interceptor matters: `next()` is called synchronously inside `run`, so every
 * downstream async continuation inherits the same store and can mutate it.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    TenantContext.run({}, () => next());
  }
}
