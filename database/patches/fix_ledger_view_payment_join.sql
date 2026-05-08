-- Fix duplicate PAYMENT rows in user_transaction_ledger (two txn rows matched reference_id).
-- Apply as DB owner:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/patches/fix_ledger_view_payment_join.sql

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
