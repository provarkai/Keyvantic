import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request tenant scope. Carried in AsyncLocalStorage so that PrismaService can
 * apply the `app.tenant_id` Postgres setting that drives Row-Level Security without
 * every service having to thread a tenant id through its signatures.
 *
 * The store is a mutable object established at the start of the request (before
 * authentication has run) and populated once the JWT has been validated.
 */
export interface TenantScope {
  tenantId?: string;
  userId?: string;

  /** Set while inside `tenantTransaction`, so the query extension does not re-wrap. */
  inTransaction?: boolean;

  /**
   * Bypasses RLS. Only for operations that legitimately span tenants — login lookup
   * by email, tenant provisioning, scheduled maintenance. Never set from anything
   * derived from a request body or query string.
   */
  bypass?: boolean;
}

const storage = new AsyncLocalStorage<TenantScope>();

export const TenantContext = {
  /** Establish a scope for the duration of `fn`. */
  run<T>(scope: TenantScope, fn: () => T): T {
    return storage.run(scope, fn);
  },

  get(): TenantScope | undefined {
    return storage.getStore();
  },

  /**
   * Populate the scope established earlier in the request. The store is mutated
   * rather than replaced because the middleware that creates it runs before
   * authentication has resolved the tenant.
   */
  set(patch: Partial<TenantScope>): void {
    const store = storage.getStore();
    if (store) Object.assign(store, patch);
  },

  requireTenantId(): string {
    const tenantId = storage.getStore()?.tenantId;
    if (!tenantId) {
      throw new Error(
        "No tenant in context. A tenant-scoped query ran outside a request scope — " +
          "wrap it in TenantContext.run() or use prisma.asSystem() deliberately.",
      );
    }
    return tenantId;
  },
};
