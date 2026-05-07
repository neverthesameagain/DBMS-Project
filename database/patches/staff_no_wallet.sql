-- =============================================================
-- Patch: ADMIN/BANKER have no internal wallet (balances forced zero;
--        payment triggers only move money for role USER).
-- Apply after schema / banker patches:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/patches/staff_no_wallet.sql
-- =============================================================

CREATE OR REPLACE FUNCTION set_initial_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IN ('ADMIN', 'BANKER') THEN
        NEW.opening_balance := 0;
        NEW.current_balance := 0;
    ELSE
        NEW.current_balance := NEW.opening_balance;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION enforce_staff_no_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IN ('ADMIN', 'BANKER') THEN
        NEW.opening_balance := 0;
        NEW.current_balance := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_staff_no_wallet_balance ON users;
CREATE TRIGGER trg_staff_no_wallet_balance
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION enforce_staff_no_wallet_balance();


CREATE OR REPLACE FUNCTION update_balance_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' THEN
        IF NEW.payment_type = 'BANKER_ADD' THEN
            UPDATE users
            SET current_balance = current_balance + NEW.amount
            WHERE user_id = NEW.to_user_id
              AND role = 'USER';
        ELSIF NEW.payment_type = 'BANKER_REMOVE' THEN
            UPDATE users
            SET current_balance = current_balance - NEW.amount
            WHERE user_id = NEW.from_user_id
              AND role = 'USER';
        ELSE
            UPDATE users
            SET current_balance = current_balance - NEW.amount
            WHERE user_id = NEW.from_user_id
              AND role = 'USER';

            UPDATE users
            SET current_balance = current_balance + NEW.amount
            WHERE user_id = NEW.to_user_id
              AND role = 'USER';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION update_budget_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND NEW.category_id IS NOT NULL THEN
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


CREATE OR REPLACE FUNCTION adjust_balance(p_user_id INT, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    IF NOT app_is_banker() THEN
        RAISE EXCEPTION 'Access Denied: Only BANKER can manually adjust funds.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = p_user_id AND role = 'USER' AND is_active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Balance adjustments apply to active standard user accounts only.';
    END IF;

    UPDATE users
    SET current_balance = current_balance + p_amount
    WHERE user_id = p_user_id
      AND role = 'USER'
    RETURNING current_balance INTO v_new_balance;

    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'User not found or not eligible for balance adjustment.';
    END IF;

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;


UPDATE users
SET opening_balance = 0, current_balance = 0
WHERE role IN ('ADMIN', 'BANKER');
