# API tests

## They need a real database

The access-control and vault suites are integration tests, not unit tests, and that is
deliberate. The properties they assert are properties of Postgres, not of the
TypeScript:

- Row-Level Security denies by default when no tenant is in scope
- `NOT (col IN (...))` is NULL — and therefore excludes the row — when `col` is NULL
- AES-GCM rejects a tampered ciphertext rather than returning wrong bytes

A mocked Prisma would pass every one of those while the real system leaked. Both of
the bugs found during the tenancy build were of exactly this shape.

## Connect as an unprivileged role

Postgres exempts superusers and `BYPASSRLS` roles from row-level security **entirely** —
policies still exist, they just never apply. Running the suite as the migration user
makes every isolation test pass while proving nothing.

```bash
psql "$ADMIN_DATABASE_URL" -v app_password="'kos_app'" -f prisma/provision-app-role.sql
DATABASE_URL="postgresql://kos_app:kos_app@localhost:5432/keyvantic_kos?schema=public" pnpm test
```

`PrismaService` checks this at boot and refuses to start in production against a role
that can bypass RLS.

## They run serially

`maxWorkers: 1` in the Jest config. The suites share one database and each seeds and
tears down its own fixtures; parallel workers racing on that produced intermittent
failures. A flaky access-control suite is worse than no suite, because people learn to
re-run it instead of reading it. The whole suite takes a few seconds, so there is
nothing to win back here.

## Known gap: PDF extraction is not covered

`ExtractionService` loads `pdf-parse` through a dynamic import, which Jest's VM refuses
without `--experimental-vm-modules`. The corrupt-PDF test therefore passes because the
import fails, not because the parser rejected the file — it verifies the graceful
degradation path and nothing more.

Real PDF extraction is verified outside Jest, against a running API:

```bash
curl -X POST localhost:4000/api/v1/vault -H "Authorization: Bearer $TOKEN" \
  -F "file=@some.pdf;type=application/pdf" -F "name=Test"
# then confirm VaultFileVersion.extractedText is populated
```

Worth closing properly by enabling ESM support in Jest.
