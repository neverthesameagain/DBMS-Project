-- =============================================================
-- Splitzy Pay — DBMS Evaluation Queries
-- Demonstrates: Roles, Functions, Views, and Indexed Queries.
-- =============================================================

-- ==========================================
-- 1. USER ROLE DEMONSTRATION
-- ==========================================
-- Set PostgreSQL role for evaluation/demo
SET ROLE app_user;

-- Set session variables for a regular user
SET app.user_id = '1';
SET app.role = 'USER';

-- Function Execution: Get user's own balance
SELECT get_user_balance(1);

-- Function Execution: View amount user owes another user
SELECT amount_user_owes(1, 2);

-- View Execution: View group balances (RLS allows only if member)
SELECT * FROM group_user_balances WHERE group_id = 1;


-- ==========================================
-- 2. ADMIN ROLE DEMONSTRATION
-- ==========================================
-- Set PostgreSQL role for evaluation/demo
SET ROLE app_admin;

-- Set session variables for an admin user
SET app.user_id = '2';
SET app.role = 'ADMIN';

-- View Execution: View system-wide overview (Requires ADMIN/BANKER)
SELECT * FROM admin_system_overview;

-- Function Execution: Deactivate a user
-- (Will succeed because app.role = 'ADMIN')
SELECT deactivate_user(3);

-- RLS Bypass Demonstration: See all payments (even those not involved in)
SELECT * FROM payment LIMIT 5;


-- ==========================================
-- 3. BANKER ROLE DEMONSTRATION
-- ==========================================
-- Set PostgreSQL role for evaluation/demo
SET ROLE app_banker;

-- Set session variables for a banker
SET app.user_id = '6';
SET app.role = 'BANKER';

-- Function Execution: Adjust a user's balance
-- (Will succeed because app.role = 'BANKER')
SELECT adjust_balance(4, 500.00);

-- View Execution: Audit ledger
SELECT * FROM user_transaction_ledger ORDER BY created_at DESC LIMIT 10;


-- ==========================================
-- 4. INDEX USAGE DEMONSTRATION
-- ==========================================
-- Querying payments via indexed from_user_id (idx_payment_from)
EXPLAIN ANALYZE 
SELECT * FROM payment WHERE from_user_id = 1;

-- Querying expense splits via indexed group_id (idx_esg_group)
EXPLAIN ANALYZE 
SELECT * FROM expense_split_group WHERE group_id = 1 AND is_settled = FALSE;

-- Querying transactions via newly created indexed reference_id (idx_trans_ref)
EXPLAIN ANALYZE 
SELECT * FROM transactions WHERE reference_id = 10 AND transaction_type = 'PAYMENT';
