-- ======================================================
-- Database role separation for Collective Finance Portal
-- ======================================================
-- Creates three distinct PostgreSQL roles:
--   1. cfp_migration  — schema owner, runs Prisma Migrate (DIRECT_URL)
--   2. cfp_provisioning — roster/admin import scripts (PROVISIONING_DATABASE_URL)
--   3. cfp_app         — runtime application role (DATABASE_URL)
--
-- After applying, set passwords for the new roles:
--   ALTER ROLE cfp_migration WITH PASSWORD '<secure_password>';
--   ALTER ROLE cfp_provisioning WITH PASSWORD '<secure_password>';
--   ALTER ROLE cfp_app WITH PASSWORD '<secure_password>';
-- ======================================================

-- 1. Create roles (IF NOT EXISTS prevents errors on re-run)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cfp_migration') THEN
    CREATE ROLE cfp_migration WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cfp_provisioning') THEN
    CREATE ROLE cfp_provisioning WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cfp_app') THEN
    CREATE ROLE cfp_app WITH LOGIN;
  END IF;
END
$$;

-- 2. Migration owner: full schema ownership
GRANT ALL ON SCHEMA public TO cfp_migration;
GRANT ALL ON ALL TABLES IN SCHEMA public TO cfp_migration;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO cfp_migration;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cfp_migration;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO cfp_migration;

-- 3. Provisioning operator
GRANT USAGE ON SCHEMA public TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "groups" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "members" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE, DELETE ON "authorized_admins" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "users" TO cfp_provisioning;
GRANT SELECT, INSERT ON "audit_events" TO cfp_provisioning;
GRANT SELECT ON "sessions" TO cfp_provisioning;

-- 4. Application runtime: least privilege
GRANT USAGE ON SCHEMA public TO cfp_app;
GRANT SELECT ON "groups" TO cfp_app;
GRANT SELECT ON "members" TO cfp_app;
GRANT SELECT ON "authorized_admins" TO cfp_app;
GRANT SELECT, INSERT, UPDATE ON "users" TO cfp_app;
GRANT SELECT, INSERT, UPDATE ON "sessions" TO cfp_app;
GRANT SELECT, INSERT, UPDATE ON "otp_challenges" TO cfp_app;
GRANT SELECT, INSERT, UPDATE ON "rate_limit_buckets" TO cfp_app;
GRANT SELECT, INSERT, UPDATE ON "transactions" TO cfp_app;
GRANT SELECT, INSERT ON "audit_events" TO cfp_app;
GRANT SELECT, INSERT ON "idempotency_requests" TO cfp_app;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations'
  ) THEN
    GRANT SELECT ON "_prisma_migrations" TO cfp_provisioning;
    GRANT SELECT ON "_prisma_migrations" TO cfp_app;
  END IF;
END
$$;
