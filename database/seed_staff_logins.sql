-- =============================================================
-- Seed ADMIN + BANKER login rows (idempotent — safe to re-run).
--
-- Run AFTER core schema / deploy.sh (users table must exist).
--
-- Demo credentials (change in production):
--   Admin:  aryan@splitzy.com     / Admin@123
--   Banker: banker@splitzy.com    / banker123
--
-- Password hashes are bcrypt (cost 12), compatible with Flask-Bcrypt.
-- =============================================================

-- Allow BANKER in users.role if your schema still only lists USER, ADMIN
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

INSERT INTO users (
    first_name,
    last_name,
    email,
    phone_number,
    date_of_birth,
    gender,
    hashed_password,
    opening_balance,
    current_balance,
    role,
    is_active
)
VALUES
  (
    'Aryan',
    'Mathur',
    'aryan@splitzy.com',
    '+919876543210',
    DATE '2002-05-15',
    'male',
    '$2b$12$iVycqfC9nL12bxDW2m1mYuZ99rjPOyTR//dCAHAyV4GvLWA20dKdG',
    0.00,
    0.00,
    'ADMIN',
    TRUE
  ),
  (
    'System',
    'Banker',
    'banker@splitzy.com',
    '+910000000000',
    DATE '1990-01-01',
    'other',
    '$2b$12$E7vi/JNefsXzkn/IjWaQhuKs9ky/uJtqud2Vz5.eiXtI0OQAOMNuS',
    0.00,
    0.00,
    'BANKER',
    TRUE
  )
ON CONFLICT (email) DO UPDATE SET
  first_name      = EXCLUDED.first_name,
  last_name       = EXCLUDED.last_name,
  phone_number    = EXCLUDED.phone_number,
  date_of_birth   = EXCLUDED.date_of_birth,
  gender          = EXCLUDED.gender,
  hashed_password = EXCLUDED.hashed_password,
  opening_balance = 0,
  current_balance = 0,
  role            = EXCLUDED.role,
  is_active       = TRUE;
