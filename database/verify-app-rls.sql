-- Run: psql "$DATABASE_URL" -f verify-app-rls.sql  (from database/) or database/verify-app-rls.sql from repo root
SELECT current_user AS connected_as;

SELECT rolbypassrls AS must_be_false
FROM pg_roles
WHERE rolname = current_user;

SELECT relname, relrowsecurity AS must_be_true_rls, relforcerowsecurity AS must_be_true_force
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('payment', 'expense_split_group', 'group_members')
ORDER BY relname;
