-- =============================================================
-- Seed reference rows into category (budgets & payments use these).
-- Safe to run multiple times: skips names that already exist.
--
-- Run as schema owner (e.g. neondb_owner), same as other patches:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/patches/seed_categories.sql
-- =============================================================

INSERT INTO category (category_name) VALUES
  ('Food'),
  ('Travel'),
  ('Entertainment'),
  ('Shopping'),
  ('Utilities'),
  ('Insurance'),
  ('Health'),
  ('General')
ON CONFLICT (category_name) DO NOTHING;
