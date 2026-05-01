-- =============================================================
-- Splitzy Pay — Seed Data
-- Run AFTER schema.sql
--
-- This seed is intentionally clean for evaluation: no fake groups,
-- payments, expenses, or future expenses. Only reference categories
-- and one admin account are inserted. Real demo data should be created
-- through the application so triggers/functions/RLS can be demonstrated.
-- =============================================================

-- =============================================================
-- Categories
-- =============================================================
INSERT INTO category (category_name) VALUES
  ('Food'),
  ('Travel'),
  ('Entertainment'),
  ('Shopping'),
  ('Utilities'),
  ('Insurance'),
  ('Health'),
  ('General');

-- =============================================================
-- Admin User
-- Demo credentials:
--   Admin: aryan@splitzy.com / Admin@123
-- =============================================================
INSERT INTO users (first_name, last_name, email, phone_number, date_of_birth, gender, hashed_password, opening_balance, current_balance, role)
VALUES
  ('Aryan',  'Mathur',  'aryan@splitzy.com',  '+919876543210', '2002-05-15', 'male', '$2b$12$xsuDacnqYMVrlu2BUz9/n.cin5lFVGqXr9Reg4XfgqCl7HKOc8qHC', 0.00, 0.00, 'ADMIN');
