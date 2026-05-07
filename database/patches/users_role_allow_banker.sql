-- =============================================================
-- Ensure users.role allows BANKER (needed if DB was created from an older schema).
-- Run as table owner:
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/patches/users_role_allow_banker.sql
-- =============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'users'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  ) LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('USER', 'ADMIN', 'BANKER'));

-- Example: restore banker after wrong toggle (adjust email if yours differs):
-- UPDATE users SET role = 'BANKER' WHERE email = 'banker@splitzy.com';
