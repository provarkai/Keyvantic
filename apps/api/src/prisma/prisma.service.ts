import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContext, type TenantScope } from "../common/tenant/tenant-context";

/**
 * Applies the current tenant scope to a connection as transaction-local settings.
 *
 * `set_config(..., true)` is transaction-scoped, so the value cannot leak to the next
 * user of a pooled connection — which a session-level `SET` would.
 */
function scopeStatement(client: PrismaClient, scope: TenantScope) {
  return scope.bypass
    ? client.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`
    : client.$executeRaw`SELECT set_config('app.tenant_id', ${scope.tenantId ?? ""}, true)`;
}

function createTenantAwareClient() {
  const base = new PrismaClient();

  return base
    .$extends({
      client: {
        /**
         * Run several statements atomically under the current tenant scope.
         *
         * Services must use this rather than `$transaction` directly: the RLS setting
         * has to be applied on the same connection as the statements it governs,
         * which only holds inside one transaction.
         */
        async tenantTransaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
          const scope = TenantContext.get() ?? {};
          return base.$transaction(async (tx) => {
            await scopeStatement(tx as unknown as PrismaClient, scope);
            return TenantContext.run({ ...scope, inTransaction: true }, () =>
              fn(tx as unknown as PrismaClient),
            );
          });
        },

        /**
         * Escape hatch for genuinely cross-tenant work: resolving a login before the
         * tenant is known, provisioning a new tenant, maintenance jobs.
         *
         * Every call site is a place where tenant isolation is deliberately not
         * enforced, so keep them few, keep them obvious, and never let a tenant id
         * that came from user input decide what runs inside.
         */
        async asSystem<T>(fn: () => Promise<T>): Promise<T> {
          // The `await` must happen *inside* the scope. Prisma promises are lazy, so
          // returning one unawaited lets the AsyncLocalStorage scope exit before the
          // query runs — and it then executes with no tenant set at all.
          return TenantContext.run({ bypass: true }, async () => await fn());
        },

        /** Run `fn` scoped to one tenant outside a request — jobs, seeds, tests. */
        async asTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
          return TenantContext.run({ tenantId }, async () => await fn());
        },
      },
    })
    .$extends({
      query: {
        async $allOperations({ args, query }) {
          const scope = TenantContext.get();

          // No scope at all: let it through unwrapped. RLS still denies by default —
          // `app.tenant_id` is unset, and NULL never matches a tenantId.
          if (!scope) return query(args);

          // Already inside tenantTransaction: the setting is applied on this
          // connection, and nesting another transaction here would fail.
          if (scope.inTransaction) return query(args);

          const [, result] = await base.$transaction([scopeStatement(base, scope), query(args)]);
          return result;
        },
      },
    });
}

type TenantAwareClient = ReturnType<typeof createTenantAwareClient>;

/**
 * Serves as both the DI token and the type for the tenant-aware Prisma client.
 *
 * It is never instantiated. `$extends` returns a new object rather than a subclass,
 * so the provider below supplies the extended client under this class token — which
 * keeps `constructor(private prisma: PrismaService)` working everywhere. The extension
 * methods are declared as properties so they type-check against the real object.
 */
@Injectable()
export class PrismaService extends PrismaClient {
  tenantTransaction!: TenantAwareClient["tenantTransaction"];
  asSystem!: TenantAwareClient["asSystem"];
  asTenant!: TenantAwareClient["asTenant"];
}

/**
 * Postgres exempts superusers and BYPASSRLS roles from row-level security *entirely* —
 * policies still exist, they just never apply. Connecting the API as one silently turns
 * every isolation guarantee into decoration, and nothing else in the system would show
 * a symptom. So check at boot and refuse to start in production.
 */
async function assertRlsIsEnforceable(client: PrismaClient) {
  const [{ is_superuser, bypassrls }] = await client.$queryRaw<
    { is_superuser: boolean; bypassrls: boolean }[]
  >`
    SELECT rolsuper AS is_superuser, rolbypassrls AS bypassrls
    FROM pg_roles WHERE rolname = current_user
  `;

  if (!is_superuser && !bypassrls) return;

  const message =
    `Database user "${process.env.DATABASE_USER ?? "current_user"}" ` +
    `${is_superuser ? "is a superuser" : "has BYPASSRLS"}, so Row-Level Security is not ` +
    "enforced and tenants are not isolated. Connect as an unprivileged role that owns " +
    "no tables (see docs/09-deployment-guide.md).";

  if (process.env.NODE_ENV === "production") throw new Error(message);
  // eslint-disable-next-line no-console
  console.warn(`[SECURITY] ${message}`);
}

export const prismaProvider = {
  provide: PrismaService,
  useFactory: async (): Promise<PrismaService> => {
    const client = createTenantAwareClient();
    await client.$connect();
    await assertRlsIsEnforceable(client as unknown as PrismaClient);
    return client as unknown as PrismaService;
  },
};
