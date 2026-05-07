-- =============================================================
-- Runtime application role for Neon (run once as neondb_owner)
-- =============================================================
-- After this, backend DATABASE_URL must use splitzy_app — NOT neondb_owner.
-- Replace 'CHANGE_ME_STRONG_PASSWORD' before running.

CREATE ROLE splitzy_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

ALTER ROLE splitzy_app NOBYPASSRLS;
ALTER ROLE splitzy_app NOCREATEDB;
ALTER ROLE splitzy_app NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO splitzy_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO splitzy_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO splitzy_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO splitzy_app;

-- Objects created later by the owner still grant rights to the app role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO splitzy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO splitzy_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO splitzy_app;

-- After adding tables/views/functions later, re-apply table grants so splitzy_app keeps access:
--   psql "$OWNER_URL" -v ON_ERROR_STOP=1 -f database/patches/grant_splitzy_app_privileges.sql
