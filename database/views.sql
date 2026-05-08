-- =============================================================
-- Splitzy Pay — Views
-- Run after tables, functions, and triggers are created.
-- =============================================================

CREATE OR REPLACE VIEW user_transaction_ledger AS
SELECT
    t.transaction_id,
    t.transaction_type,
    t.reference_id,
    t.amount,
    t.created_at,
    p.from_user_id AS from_user,
    p.to_user_id AS to_user,
    p.category_id,
    'PAYMENT' AS entry_type,
    p.note AS description
FROM payment p
JOIN transactions t ON t.transaction_id = p.transaction_id
    AND t.transaction_type = 'PAYMENT'
UNION ALL
SELECT
    t.transaction_id,
    t.transaction_type,
    t.reference_id,
    t.amount,
    t.created_at,
    esg.paid_by AS from_user,
    esg.paid_for AS to_user,
    esg.category_id,
    'EXPENSE' AS entry_type,
    esg.description
FROM expense_split_group esg
JOIN transactions t ON t.transaction_type = 'EXPENSE' AND t.reference_id = esg.expense_id
UNION ALL
SELECT
    NULL AS transaction_id,
    'FUTURE_EXPENSE' AS transaction_type,
    fe.future_expense_id AS reference_id,
    fe.estimated_amount AS amount,
    fe.created_at,
    fe.user_id AS from_user,
    NULL AS to_user,
    fe.category_id,
    'FUTURE_EXPENSE' AS entry_type,
    NULL AS description
FROM future_expense fe
WHERE fe.status = 'COMPLETED';


CREATE OR REPLACE VIEW group_user_balances AS
SELECT
    gm.group_id,
    u.user_id,
    u.first_name,
    u.last_name,
    COALESCE(SUM(CASE
        WHEN esg.paid_by = u.user_id AND esg.paid_for <> u.user_id AND esg.is_settled = FALSE
        THEN esg.amount ELSE 0 END), 0) AS total_paid,
    COALESCE(SUM(CASE
        WHEN esg.paid_for = u.user_id AND esg.paid_by <> u.user_id AND esg.is_settled = FALSE
        THEN esg.amount ELSE 0 END), 0) AS still_owes,
    COALESCE(SUM(CASE
        WHEN esg.paid_by = u.user_id AND esg.paid_for <> u.user_id AND esg.is_settled = FALSE
        THEN esg.amount ELSE 0 END), 0) AS is_owed,
    COALESCE(SUM(CASE WHEN esg.paid_for = u.user_id THEN esg.amount ELSE 0 END), 0) AS expense_share_total,
    COALESCE(SUM(CASE
        WHEN esg.paid_by = u.user_id AND esg.paid_for <> u.user_id AND esg.is_settled = FALSE
        THEN esg.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE
        WHEN esg.paid_for = u.user_id AND esg.paid_by <> u.user_id AND esg.is_settled = FALSE
        THEN esg.amount ELSE 0 END), 0) AS net_balance
FROM group_members gm
JOIN users u ON u.user_id = gm.user_id
LEFT JOIN expense_split_group esg ON esg.group_id = gm.group_id AND (esg.paid_by = u.user_id OR esg.paid_for = u.user_id)
GROUP BY gm.group_id, u.user_id, u.first_name, u.last_name;


-- =============================================================
-- VIEW: admin_system_overview
-- Provides a high-level summary of system financial health.
-- Only accessible by ADMIN/BANKER implicitly or via role checks.
-- =============================================================
CREATE OR REPLACE VIEW admin_system_overview AS
SELECT
    (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS total_active_users,
    (SELECT COALESCE(SUM(current_balance), 0) FROM users WHERE is_active = TRUE) AS total_system_capital,
    (SELECT COALESCE(SUM(amount), 0) FROM payment WHERE status = 'COMPLETED') AS total_payment_volume,
    (SELECT COALESCE(SUM(amount), 0) FROM expense_split_group WHERE is_settled = FALSE) AS total_active_debt;
