-- =============================================================
-- Splitzy Pay — Stored Functions
-- Run after tables are created.
--
-- Stored procedures/functions keep critical financial operations
-- atomic and explainable. The backend calls these instead of
-- duplicating split, ledger, or balance logic in Python.
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


CREATE OR REPLACE FUNCTION amount_user_owes(debtor_id INT, creditor_id INT)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(amount), 0)
    FROM expense_split_group
    WHERE paid_by = creditor_id
      AND paid_for = debtor_id
      AND is_settled = FALSE;
$$ LANGUAGE sql;


CREATE OR REPLACE FUNCTION settle_group_balance(user1 INT, user2 INT)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(
        CASE
            WHEN paid_by = user1 AND paid_for = user2 THEN amount
            WHEN paid_by = user2 AND paid_for = user1 THEN -amount
            ELSE 0
        END
    ), 0)
    FROM expense_split_group
    WHERE (paid_by = user1 AND paid_for = user2 OR paid_by = user2 AND paid_for = user1)
      AND is_settled = FALSE;
$$ LANGUAGE sql;


CREATE OR REPLACE FUNCTION create_group_expense(
    p_group_id INT,
    p_paid_by INT,
    p_paid_for INT[],
    p_amount NUMERIC,
    p_category_id INT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_split_amounts NUMERIC[] DEFAULT NULL
)
RETURNS SETOF expense_split_group AS $$
DECLARE
    member_count INT;
    idx INT;
    uid INT;
    share NUMERIC(12, 2);
    inserted_row expense_split_group%ROWTYPE;
BEGIN
    -- Design note:
    -- An "expense event" is represented by multiple payable split rows.
    -- Each row is a distinct obligation from one debtor to one payer, so
    -- each split receives its own ledger transaction via trigger. The UI
    -- groups rows by payer/description/time to show the original event.
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    member_count := COALESCE(array_length(p_paid_for, 1), 0);
    IF member_count = 0 THEN
        RAISE EXCEPTION 'At least one split member is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM group_members
        JOIN users u ON u.user_id = group_members.user_id
        WHERE group_members.group_id = p_group_id
          AND group_members.user_id = p_paid_by
          AND u.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Payer is not an active member of this group';
    END IF;

    IF p_split_amounts IS NOT NULL
       AND COALESCE(array_length(p_split_amounts, 1), 0) <> member_count THEN
        RAISE EXCEPTION 'Split amount count must match split member count';
    END IF;

    FOR idx IN 1..member_count LOOP
        uid := p_paid_for[idx];

        IF NOT EXISTS (
            SELECT 1 FROM group_members
            JOIN users u ON u.user_id = group_members.user_id
            WHERE group_members.group_id = p_group_id
              AND group_members.user_id = uid
              AND u.is_active = TRUE
        ) THEN
            RAISE EXCEPTION 'Split member % is not an active member of group %', uid, p_group_id;
        END IF;

        IF uid = p_paid_by THEN
            CONTINUE;
        END IF;

        IF p_split_amounts IS NULL THEN
            share := ROUND(p_amount / member_count, 2);
        ELSE
            share := ROUND(p_split_amounts[idx], 2);
        END IF;

        IF share <= 0 THEN
            CONTINUE;
        END IF;

        INSERT INTO expense_split_group (
            group_id,
            category_id,
            paid_by,
            paid_for,
            amount,
            description,
            is_settled
        )
        VALUES (
            p_group_id,
            p_category_id,
            p_paid_by,
            uid,
            share,
            p_description,
            FALSE
        )
        RETURNING * INTO inserted_row;

        RETURN NEXT inserted_row;
    END LOOP;

    RETURN;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_transaction_for_payment()
RETURNS TRIGGER AS $$
DECLARE
    tid INT;
BEGIN
    -- Trigger-owned transaction creation guarantees every payment has a
    -- ledger row even if a backend route forgets to create one.
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.from_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Sender account is inactive or missing';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.to_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'Recipient account is inactive or missing';
    END IF;

    IF NEW.payment_id IS NULL THEN
        NEW.payment_id := nextval(pg_get_serial_sequence('payment', 'payment_id'));
    END IF;

    INSERT INTO transactions(transaction_type, reference_id, amount)
    VALUES ('PAYMENT', NEW.payment_id, NEW.amount)
    RETURNING transaction_id INTO tid;

    NEW.transaction_id := tid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_transaction_for_expense()
RETURNS TRIGGER AS $$
BEGIN
    -- Each split row is a payable obligation and therefore receives its
    -- own immutable ledger entry. This favors auditability over compactness.
    INSERT INTO transactions(transaction_type, reference_id, amount)
    VALUES ('EXPENSE', NEW.expense_id, NEW.amount);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION update_balance_after_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Balances are derived from completed payment inserts inside the DB.
    -- Python must not mutate current_balance directly.
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


-- =============================================================
-- ROLE-ENFORCED FUNCTIONS
-- =============================================================

-- 1. USER: get_user_balance
CREATE OR REPLACE FUNCTION get_user_balance(p_user_id INT)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    IF app_user_id() != p_user_id AND NOT app_is_admin() AND NOT app_is_banker() THEN
        RAISE EXCEPTION 'Access Denied: You can only view your own balance.';
    END IF;

    SELECT current_balance INTO v_balance FROM users WHERE user_id = p_user_id;
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. ADMIN: deactivate_user
CREATE OR REPLACE FUNCTION deactivate_user(p_user_id INT)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT app_is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only ADMIN can deactivate users.';
    END IF;

    UPDATE users SET is_active = FALSE WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. BANKER: adjust_balance
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
