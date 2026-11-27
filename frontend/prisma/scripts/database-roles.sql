-- ======================================================
-- Database role separation for Collective Finance Portal
-- ======================================================
-- This migration creates three distinct PostgreSQL roles:
--   1. cfp_migration  — schema owner, runs Prisma Migrate (DIRECT_URL)
--   2. cfp_provisioning — roster/admin import scripts (PROVISIONING_DATABASE_URL)
--   3. cfp_app         — runtime application role (DATABASE_URL)
--
-- IMPORTANT: This migration runs as the postgres superuser.
-- After applying, set passwords for the new roles using:
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

-- 3. Provisioning operator: write groups, members, authorized_admins, users, audit_events
GRANT USAGE ON SCHEMA public TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "groups" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "members" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE, DELETE ON "authorized_admins" TO cfp_provisioning;
GRANT SELECT, INSERT, UPDATE ON "users" TO cfp_provisioning;
GRANT SELECT, INSERT ON "audit_events" TO cfp_provisioning;
GRANT SELECT ON "sessions" TO cfp_provisioning;
GRANT SELECT ON "_prisma_migrations" TO cfp_provisioning;

-- 4. Application runtime: least privilege
GRANT USAGE ON SCHEMA public TO cfp_app;
-- Read-only roster tables
GRANT SELECT ON "groups" TO cfp_app;
GRANT SELECT ON "members" TO cfp_app;
GRANT SELECT ON "authorized_admins" TO cfp_app;
-- User accounts: full CRUD except delete
GRANT SELECT, INSERT, UPDATE ON "users" TO cfp_app;
-- Sessions: full lifecycle
GRANT SELECT, INSERT, UPDATE ON "sessions" TO cfp_app;
-- OTP challenges: full lifecycle
GRANT SELECT, INSERT, UPDATE ON "otp_challenges" TO cfp_app;
-- Rate limit buckets: upsert
GRANT SELECT, INSERT, UPDATE ON "rate_limit_buckets" TO cfp_app;
-- Transactions: insert + single void update (delete blocked by trigger)
GRANT SELECT, INSERT, UPDATE ON "transactions" TO cfp_app;
-- Audit: append only (no UPDATE/DELETE)
GRANT SELECT, INSERT ON "audit_events" TO cfp_app;
-- Idempotency: insert + read
GRANT SELECT, INSERT ON "idempotency_requests" TO cfp_app;
-- Prisma migrations table (read-only for status checks)
GRANT SELECT ON "_prisma_migrations" TO cfp_app;
