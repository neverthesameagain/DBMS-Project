-- =============================================================
-- Splitzy Pay — Database Schema
-- PostgreSQL  |  Deploy on: Render / Supabase / Neon
-- Aligned with project specification
-- =============================================================
--
-- Expected NOTICE-level messages on full rebuild (all harmless):
--   • "trigger … does not exist, skipping" — DROP TRIGGER IF EXISTS runs before the
--     first CREATE TRIGGER on freshly recreated tables.
--   • "Drop cascades to view user_transaction_ledger" — DROP TABLE … CASCADE removes
--     dependent views; they are recreated later in this file (and views.sql).
--
SET client_min_messages TO WARNING;

-- Drop tables in reverse dependency order (safe re-run)
DROP TABLE IF EXISTS future_expense        CASCADE;
DROP TABLE IF EXISTS upi_id               CASCADE;
DROP TABLE IF EXISTS personal_expense_split CASCADE;
DROP TABLE IF EXISTS expense_split_group  CASCADE;
DROP TABLE IF EXISTS payment              CASCADE;
DROP TABLE IF EXISTS transactions         CASCADE;
DROP TABLE IF EXISTS group_members        CASCADE;
DROP TABLE IF EXISTS groups              CASCADE;
DROP TABLE IF EXISTS category             CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

-- =============================================================
-- 1. USERS
-- =============================================================
CREATE TABLE users (
    user_id          SERIAL PRIMARY KEY,
    first_name       VARCHAR(50)    NOT NULL,
    last_name        VARCHAR(50)    NOT NULL,
    email            VARCHAR(120)   NOT NULL UNIQUE,
    phone_number     VARCHAR(20)    NOT NULL UNIQUE,
    date_of_birth    DATE,
    gender           VARCHAR(10)    CHECK (gender IN ('male', 'female', 'other')),
    hashed_password  VARCHAR(128)   NOT NULL,
    opening_balance  NUMERIC(12, 2) DEFAULT 0.00,
    current_balance  NUMERIC(12, 2) DEFAULT 0.00,
    role             VARCHAR(10)    NOT NULL DEFAULT 'USER'
                         CHECK (role IN ('USER', 'ADMIN', 'BANKER')),
    is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- 2. CATEGORY
--    Used by expenses, payments, personal splits, and future expenses.
-- =============================================================
CREATE TABLE category (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(80) NOT NULL UNIQUE
);

-- =============================================================
-- 3. GROUPS
-- =============================================================
CREATE TABLE groups (
    group_id    SERIAL PRIMARY KEY,
    group_name  VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- 4. GROUP MEMBERS
--    Roles: Admin > Moderator > Member
-- =============================================================
CREATE TABLE group_members (
    group_id   INTEGER NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(user_id)   ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'Member'
                   CHECK (role IN ('Admin', 'Moderator', 'Member')),
    joined_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- =============================================================
-- 5. PERSONAL EXPENSE SPLIT
--    Per-user monthly budget allocation per category.
--    Answers: "How much of my Food budget have I used this month?"
-- =============================================================
CREATE TABLE personal_expense_split (
    user_id          INTEGER        NOT NULL REFERENCES users(user_id)     ON DELETE CASCADE,
    category_id      INTEGER        NOT NULL REFERENCES category(category_id) ON DELETE CASCADE,
    allocated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  -- budget set by user
    amount_spent     NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_spent >= 0),  -- actual spend tracked
    reminder_for     DATE,           -- date to remind user about this budget
    duration         INTEGER        DEFAULT 30 CHECK (duration > 0),
    PRIMARY KEY (user_id, category_id)
);

-- =============================================================
-- 6. UPI IDs
--    A user can have multiple UPI identifiers.
-- =============================================================
CREATE TABLE upi_id (
    upi_id   SERIAL PRIMARY KEY,
    user_id  INTEGER     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    upi_handle VARCHAR(100) NOT NULL UNIQUE  -- e.g. aryan@okicici
);

-- =============================================================
-- 7. TRANSACTIONS  (Unified Financial Ledger)
--    Payments generate one transaction. Group expenses generate one
--    transaction per split row because each split is an auditable payable
--    obligation from a debtor to a payer. The UI groups split rows back
--    into the visible expense event.
--    reference_id points to the relevant table's PK.
-- =============================================================
CREATE TABLE transactions (
    transaction_id   SERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('EXPENSE', 'PAYMENT')),
    reference_id     INTEGER     NOT NULL,   -- FK enforced at app layer (polymorphic)
    amount           NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
-- 8. PAYMENT
--    Records any transfer of money between two users.
--    payment_type: PERSONAL | GROUP | BANKER_ADD | BANKER_REMOVE | BANKER_TRANSFER
--    status      : PENDING → COMPLETED | FAILED
-- =============================================================
CREATE TABLE payment (
    payment_id     SERIAL PRIMARY KEY,
    from_user_id   INTEGER        NOT NULL REFERENCES users(user_id)        ON DELETE RESTRICT,
    to_user_id     INTEGER        NOT NULL REFERENCES users(user_id)        ON DELETE RESTRICT,
    category_id    INTEGER        REFERENCES category(category_id)          ON DELETE SET NULL,
    amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    upi_ref        VARCHAR(100),
    payment_type   VARCHAR(20)    NOT NULL DEFAULT 'PERSONAL'
                       CHECK (payment_type IN ('PERSONAL', 'GROUP', 'BANKER_ADD', 'BANKER_REMOVE', 'BANKER_TRANSFER')),
    status         VARCHAR(20)    NOT NULL DEFAULT 'COMPLETED'
                       CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    note           VARCHAR(200),
    transaction_id INTEGER        NOT NULL REFERENCES transactions(transaction_id)   ON DELETE RESTRICT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (from_user_id <> to_user_id)
);

-- =============================================================
-- 9. EXPENSE SPLIT GROUP
--    Each row = one person's share of one group expense.
--    paid_by = who fronted the cash
--    paid_for = who this split belongs to (the debtor)
--    One expense event → multiple rows (one per group member).
-- =============================================================
CREATE TABLE expense_split_group (
    expense_id     SERIAL PRIMARY KEY,
    payment_id     INTEGER        REFERENCES payment(payment_id)   ON DELETE SET NULL,
    group_id       INTEGER        NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    category_id    INTEGER        REFERENCES category(category_id)  ON DELETE SET NULL,
    paid_by        INTEGER        NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    paid_for       INTEGER        NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description    VARCHAR(200),
    is_settled     BOOLEAN        DEFAULT FALSE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (paid_by <> paid_for)
);

-- =============================================================
-- 10. FUTURE EXPENSE
--     Planned expenditures with category and status tracking.
-- =============================================================
CREATE TABLE future_expense (
    future_expense_id SERIAL PRIMARY KEY,
    user_id           INTEGER        NOT NULL REFERENCES users(user_id)        ON DELETE CASCADE,
    category_id       INTEGER        REFERENCES category(category_id)          ON DELETE SET NULL,
    estimated_amount  NUMERIC(12, 2) NOT NULL CHECK (estimated_amount > 0),
    expected_date     DATE,
    status            VARCHAR(20)    NOT NULL DEFAULT 'PLANNED'
                          CHECK (status IN ('PLANNED', 'COMPLETED', 'CANCELLED')),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================
CREATE INDEX idx_group_members_group  ON group_members USING HASH(group_id);
CREATE INDEX idx_group_members_user   ON group_members USING HASH(user_id);
CREATE INDEX idx_esg_group            ON expense_split_group USING HASH(group_id);
CREATE INDEX idx_esg_paid_by          ON expense_split_group USING HASH(paid_by);
CREATE INDEX idx_esg_paid_for         ON expense_split_group USING HASH(paid_for);
CREATE INDEX idx_payment_from         ON payment USING HASH(from_user_id);
CREATE INDEX idx_payment_to           ON payment USING HASH(to_user_id);
CREATE INDEX idx_future_user          ON future_expense USING HASH(user_id);
CREATE INDEX idx_upi_user             ON upi_id USING HASH(user_id);
CREATE INDEX idx_pes_user             ON personal_expense_split USING HASH(user_id);
CREATE INDEX idx_trans_type           ON transactions(transaction_type, created_at); -- B-Tree for sorting
CREATE INDEX idx_trans_ref            ON transactions USING HASH(reference_id);
CREATE INDEX idx_payment_txn          ON payment USING HASH(transaction_id);


-- =============================================================
-- TRIGGER: Set initial balance on user insert
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

DROP TRIGGER IF EXISTS trg_set_initial_balance ON users;
CREATE TRIGGER trg_set_initial_balance
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_initial_balance();

DROP TRIGGER IF EXISTS trg_staff_no_wallet_balance ON users;
CREATE TRIGGER trg_staff_no_wallet_balance
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION enforce_staff_no_wallet_balance();


-- =============================================================
-- FUNCTION: amount_user_owes
-- Returns total amount debtor owes creditor (unsettled)
-- =============================================================
CREATE OR REPLACE FUNCTION amount_user_owes(debtor_id INT, creditor_id INT)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(amount), 0)
    FROM expense_split_group
    WHERE paid_by = creditor_id
      AND paid_for = debtor_id
      AND is_settled = FALSE;
$$ LANGUAGE sql;


-- =============================================================
-- FUNCTION: settle_group_balance
-- Returns net balance between two users in all groups
-- =============================================================
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


-- =============================================================
-- FUNCTION: create_group_expense
-- Inserts all split rows atomically. Transaction rows are created
-- by trg_expense_transaction for each inserted split row.
-- Stored procedures keep core DBMS business logic in PostgreSQL instead
-- of duplicating financial rules in the Flask API layer.
-- =============================================================
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
    -- Design note: each split row is a distinct debt obligation, so each
    -- receives its own transaction row for auditability.
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


-- =============================================================
-- FUNCTION: create_transaction_for_payment
-- Guarantees payment ledger entries at DB level.
-- =============================================================
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


-- =============================================================
-- FUNCTION: create_transaction_for_expense
-- Guarantees group expense split ledger entries at DB level.
-- =============================================================
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


-- =============================================================
-- FUNCTION: update_balance_after_payment
-- Keeps wallet balances in DB instead of backend code.
-- =============================================================
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


-- =============================================================
-- FUNCTION: update_budget_after_payment
-- Keeps category budget spend in DB instead of backend code.
-- =============================================================
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
-- VIEW: user_transaction_ledger
-- Unified ledger: payments, group expenses, future expenses (paid)
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
JOIN transactions t ON t.transaction_type = 'PAYMENT' AND t.reference_id = p.payment_id
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


-- =============================================================
-- VIEW: group_user_balances
-- For each group, user: total paid, owed, net
-- =============================================================
CREATE OR REPLACE VIEW group_user_balances AS
SELECT
    gm.group_id,
    u.user_id,
    u.first_name,
    u.last_name,
    COALESCE(SUM(CASE WHEN esg.paid_by = u.user_id THEN esg.amount ELSE 0 END), 0) AS total_paid,
    COALESCE(SUM(CASE WHEN esg.paid_for = u.user_id AND esg.paid_by <> u.user_id AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0) AS still_owes,
    COALESCE(SUM(CASE WHEN esg.paid_by = u.user_id AND esg.paid_for <> u.user_id AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0) AS is_owed,
    COALESCE(SUM(CASE WHEN esg.paid_by = u.user_id THEN esg.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN esg.paid_for = u.user_id AND esg.paid_by <> u.user_id AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN esg.paid_by = u.user_id AND esg.paid_for <> u.user_id AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0) AS net_balance
FROM group_members gm
JOIN users u ON u.user_id = gm.user_id
LEFT JOIN expense_split_group esg ON esg.group_id = gm.group_id AND (esg.paid_by = u.user_id OR esg.paid_for = u.user_id)
GROUP BY gm.group_id, u.user_id, u.first_name, u.last_name;

RESET client_min_messages;
