-- Provisions the unprivileged role the API connects as.
--
-- Migrations run as an owner/superuser; the application must NOT. Postgres exempts
-- superusers and BYPASSRLS roles from row-level security entirely, so connecting the
-- API as one turns every tenant-isolation policy into decoration with no visible
-- symptom. PrismaService checks this at boot and refuses to start in production.
--
-- Run once per database, after migrations, as a superuser:
--   psql "$ADMIN_DATABASE_URL" -v app_password="'...'" -f prisma/provision-app-role.sql
--
-- Then point the API's DATABASE_URL at kos_app.

\set app_password :app_password

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kos_app') THEN
    CREATE ROLE kos_app LOGIN;
  END IF;
END
$$;

ALTER ROLE kos_app WITH PASSWORD :app_password NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO kos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kos_app;

-- Tables created by future migrations inherit the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kos_app;
