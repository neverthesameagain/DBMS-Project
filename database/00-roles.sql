-- =============================================================
-- Splitzy Pay — Database Role Setup (RUN ONCE BEFORE SCHEMA)
-- Production deployment: Create OWNER and APP roles
-- =============================================================

-- ============================================================= 
-- CRITICAL: Run this script FIRST before schema.sql
-- with superuser credentials from Neon
-- =============================================================

-- 1. CREATE OWNER ROLE (for migrations/schema changes only)
-- Minimal privileges: LOGIN to connect, CREATEDB to manage databases
-- Note: Neon superuser already exists; we don't need full superuser privileges
CREATE ROLE owner_role WITH LOGIN CREATEDB PASSWORD 'change-me-owner-password';

-- 2. CREATE APP ROLE (for production runtime only)
-- CRITICAL: Must have LOGIN (to connect) but NOBYPASSRLS (cannot bypass RLS)
-- Note: DO NOT use NOLOGIN (that would prevent all connections)
CREATE ROLE app_user WITH LOGIN PASSWORD 'change-me-app-password';

-- CRITICAL: Enforce RLS - app_user cannot bypass row-level security
ALTER ROLE app_user NOBYPASSRLS;

-- CRITICAL: No superuser privileges
ALTER ROLE app_user NOCREATEDB;
ALTER ROLE app_user NOCREATEROLE;

-- ============================================================= 
-- GRANT MINIMAL PRIVILEGES TO APP ROLE
-- =============================================================

-- Schema access (read-only to schema definition)
GRANT USAGE ON SCHEMA public TO app_user;

-- Table privileges (SELECT, INSERT, UPDATE, DELETE for RLS-filtered rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Sequence privileges (for auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Function privileges (for stored procedures)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES FOR USER owner_role IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR USER owner_role IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES FOR USER owner_role IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;

-- ============================================================= 
-- VERIFY SETUP
-- =============================================================

-- Check APP role properties (RLS must be NO)
SELECT rolname, rolbypassrls, rolinherit, rolecanlogin 
FROM pg_roles 
WHERE rolname IN ('app_user', 'owner_role');

-- Check privileges
\du+ app_user
\du+ owner_role

-- ============================================================= 
-- NEXT STEPS
-- =============================================================
-- 1. Change passwords: change-me-owner-password, change-me-app-password
-- 2. Use one connection string (e.g. Neon) as DATABASE_URL everywhere
-- 3. Run: export DATABASE_URL='postgresql://...' && ./database/deploy.sh
