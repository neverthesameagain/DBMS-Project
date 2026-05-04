-- =============================================================
-- Splitzy Pay — Triggers
-- Run after database/functions.sql.
--
-- These triggers make PostgreSQL the source of truth for ledger and
-- balance correctness: every payment/expense insert enforces its own
-- transaction side effect, independent of backend behavior.
-- =============================================================

DROP TRIGGER IF EXISTS trg_set_initial_balance ON users;
CREATE TRIGGER trg_set_initial_balance
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_initial_balance();


DROP TRIGGER IF EXISTS trg_payment_transaction ON payment;
CREATE TRIGGER trg_payment_transaction
    BEFORE INSERT ON payment
    FOR EACH ROW
    EXECUTE FUNCTION create_transaction_for_payment();


DROP TRIGGER IF EXISTS trg_expense_transaction ON expense_split_group;
CREATE TRIGGER trg_expense_transaction
    AFTER INSERT ON expense_split_group
    FOR EACH ROW
    EXECUTE FUNCTION create_transaction_for_expense();


DROP TRIGGER IF EXISTS trg_update_balance_after_payment ON payment;
CREATE TRIGGER trg_update_balance_after_payment
    AFTER INSERT ON payment
    FOR EACH ROW
    EXECUTE FUNCTION update_balance_after_payment();


DROP TRIGGER IF EXISTS trg_update_budget_after_payment ON payment;
CREATE TRIGGER trg_update_budget_after_payment
    AFTER INSERT ON payment
    FOR EACH ROW
    EXECUTE FUNCTION update_budget_after_payment();


-- =============================================================
-- CONSTRAINT / VALIDATION TRIGGER
-- =============================================================

CREATE OR REPLACE FUNCTION prevent_negative_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_balance < 0 THEN
        -- Only ADMIN/BANKER can bypass this constraint
        IF app_is_admin() OR app_is_banker() THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Constraint Violation: Balance cannot drop below zero.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_negative_balance ON users;
CREATE TRIGGER trg_prevent_negative_balance
    BEFORE UPDATE OF current_balance ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_negative_balance();
