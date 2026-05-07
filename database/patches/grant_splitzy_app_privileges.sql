-- =============================================================
-- Fix: permission denied for table users (and related tables)
--
-- PostgreSQL only grants ON ALL TABLES to objects that exist *when*
-- you run GRANT. After deploy.sh adds tables later than splitzy_app was
-- set up — or if GRANT was skipped — the app role has no rights.
--
-- Run connected as schema OWNER (e.g. Neon `neondb_owner`), NOT as splitzy_app:
--
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f database/patches/grant_splitzy_app_privileges.sql
--
-- Replace splitzy_app below if your runtime role name differs.
-- =============================================================

GRANT USAGE ON SCHEMA public TO splitzy_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO splitzy_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO splitzy_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO splitzy_app;

-- Views exposed through ALL TABLES in PostgreSQL 15+ as routine_objects sometimes separate —
-- ALL TABLES includes views in typical setups.

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO splitzy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO splitzy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO splitzy_app;
