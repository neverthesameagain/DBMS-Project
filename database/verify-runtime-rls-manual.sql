-- Manual RLS smoke test — connect as splitzy_app (same DATABASE_URL as Flask).
--   psql "$DATABASE_URL" -f verify-runtime-rls-manual.sql
--
-- Expect: without session vars → no visible payment rows (policy default deny).
--         With app.user_id set → only rows allowed by policies.

SELECT current_user;

SELECT set_config('app.user_id', '', false);
SELECT set_config('app.role', '', false);

SELECT COUNT(*) AS payment_count_without_session FROM payment;

-- Expect 0 unless policies allow anonymous visibility (they should not):
-- SELECT * FROM payment;

SELECT set_config('app.user_id', '1', false);
SELECT set_config('app.role', 'USER', false);

SELECT COUNT(*) AS payment_count_with_session_user_1 FROM payment;

-- SELECT * FROM payment;
