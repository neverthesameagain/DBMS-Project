-- =============================================================
-- When an expense_split_group row is deleted, drop its EXPENSE ledger row.
-- Run as schema owner after functions.sql / triggers.sql baseline:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/patches/expense_delete_cascade_ledger.sql
--
-- PostgreSQL emits NOTICE on "DROP TRIGGER IF EXISTS" when the trigger was
-- never created; that is normal on first run. Suppressed below.
-- =============================================================

SET client_min_messages TO WARNING;

CREATE OR REPLACE FUNCTION delete_transaction_for_expense()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM transactions
    WHERE transaction_type = 'EXPENSE'
      AND reference_id = OLD.expense_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_expense_delete_ledger ON expense_split_group;
CREATE TRIGGER trg_expense_delete_ledger
    BEFORE DELETE ON expense_split_group
    FOR EACH ROW
    EXECUTE FUNCTION delete_transaction_for_expense();

RESET client_min_messages;
