-- =============================================================
-- Splitzy Pay — PostgreSQL DB-Level Roles
--
-- These roles are for demonstration and evaluation in pgAdmin.
-- The application runtime continues to use the 'splitzy_app' role.
-- =============================================================

-- 1. Create Roles
CREATE ROLE app_user NOLOGIN;
CREATE ROLE app_banker NOLOGIN;
CREATE ROLE app_admin NOLOGIN;

-- 2. Grant Privileges

-- USER
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;

-- BANKER
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_banker;
GRANT UPDATE ON users TO app_banker;

-- ADMIN
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;

-- 3. Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_banker, app_admin;

-- 4. Default Privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, UPDATE ON TABLES TO app_banker;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO app_admin;

-- 5. Function Access Control
-- Ensure functions are executable by the respective roles
GRANT EXECUTE ON FUNCTION get_user_balance(INT) TO app_user;
GRANT EXECUTE ON FUNCTION adjust_balance(INT, NUMERIC) TO app_banker;
GRANT EXECUTE ON FUNCTION deactivate_user(INT) TO app_admin;
