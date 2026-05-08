-- =============================================================
-- Budget trigger: only PERSONAL payments touch category spend.
-- Group settlements repay splits; banker flows are wallet plumbing.
--
-- Also refreshes group_user_balances view definition (unsettled-only
-- totals + expense_share_total + coherent net_balance).
--
-- Run as schema owner:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f database/patches/fix_budget_trigger_and_balance_view.sql
-- =============================================================

SET client_min_messages TO WARNING;

CREATE OR REPLACE FUNCTION update_budget_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED'
       AND NEW.category_id IS NOT NULL
       AND NEW.payment_type = 'PERSONAL' THEN
        UPDATE personal_expense_split pes
        SET amount_spent = amount_spent + NEW.amount
        FROM users u
        WHERE pes.user_id = NEW.from_user_id
          AND pes.category_id = NEW.category_id
          AND u.user_id = pes.user_id
          AND u.role = 'USER';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

RESET client_min_messages;
