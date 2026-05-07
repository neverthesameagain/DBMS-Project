-- =============================================================
-- Patch: Banker external cash (no net change on banker wallet),
--        banker-initiated transfers, and audit payment types.
-- Apply once on existing databases after pulling latest code:
--   psql "$DATABASE_URL" -f database/patches/banker_payment_enhancements.sql
-- =============================================================

-- Relax payment_type CHECK (constraint name may vary between installs)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'payment'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%payment_type%'
  ) LOOP
    EXECUTE format('ALTER TABLE payment DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE payment ADD CONSTRAINT payment_payment_type_check
  CHECK (payment_type IN ('PERSONAL', 'GROUP', 'BANKER_ADD', 'BANKER_REMOVE', 'BANKER_TRANSFER'));

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

DROP POLICY IF EXISTS payment_insert_policy ON payment;
CREATE POLICY payment_insert_policy
ON payment
FOR INSERT
WITH CHECK (
    app_is_admin()
    OR from_user_id = app_user_id()
    OR (
        app_is_banker()
        AND payment_type IN ('BANKER_ADD', 'BANKER_REMOVE', 'BANKER_TRANSFER')
    )
);
