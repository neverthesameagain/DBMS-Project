-- =============================================================
-- Splitzy Pay — Row Level Security Policies
-- RLS is used as a DB-level safety net so even a buggy route cannot
-- read another user's group expenses or payments. The Flask request
-- hook sets these values once per authenticated request:
--   SET app.user_id = '<user_id>';
--   SET app.role = 'USER' or 'ADMIN';
--
-- Missing session variables must never crash a SELECT. Policies use
-- current_setting(..., true) and NULLIF casts so anonymous/misconfigured
-- sessions simply see no protected rows. ADMIN bypass is explicit.
-- =============================================================

CREATE OR REPLACE FUNCTION app_user_belongs_to_group(p_group_id INT, p_user_id INT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
            SELECT 1
            FROM group_members gm
            WHERE gm.group_id = p_group_id
              AND gm.user_id = p_user_id
       );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION app_user_id()
RETURNS INT AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::INT;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS BOOLEAN AS $$
    SELECT current_setting('app.role', true) = 'ADMIN';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app_is_banker()
RETURNS BOOLEAN AS $$
    SELECT current_setting('app.role', true) = 'BANKER';
$$ LANGUAGE sql STABLE;

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_split_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment ENABLE ROW LEVEL SECURITY;

-- Default-deny hardening:
-- FORCE makes RLS apply even to the table owner, which matters when the
-- application connects with the schema owner account. Access is then only
-- possible through the explicit policies below.
ALTER TABLE group_members FORCE ROW LEVEL SECURITY;
ALTER TABLE expense_split_group FORCE ROW LEVEL SECURITY;
ALTER TABLE payment FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_members_access_policy ON group_members;
CREATE POLICY group_members_access_policy
ON group_members
FOR SELECT
USING (
    app_is_admin()
    OR app_user_belongs_to_group(
        group_members.group_id,
        app_user_id()
    )
);

DROP POLICY IF EXISTS group_members_insert_policy ON group_members;
CREATE POLICY group_members_insert_policy
ON group_members
FOR INSERT
WITH CHECK (
    app_is_admin()
    OR user_id = app_user_id()
    OR app_user_belongs_to_group(group_id, app_user_id())
);

DROP POLICY IF EXISTS group_members_update_policy ON group_members;
CREATE POLICY group_members_update_policy
ON group_members
FOR UPDATE
USING (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
)
WITH CHECK (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
);

DROP POLICY IF EXISTS group_members_delete_policy ON group_members;
CREATE POLICY group_members_delete_policy
ON group_members
FOR DELETE
USING (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
);

DROP POLICY IF EXISTS expense_group_access_policy ON expense_split_group;
CREATE POLICY expense_group_access_policy
ON expense_split_group
FOR SELECT
USING (
    app_is_admin()
    OR EXISTS (
        SELECT 1
        FROM group_members gm
        WHERE gm.group_id = expense_split_group.group_id
          AND gm.user_id = app_user_id()
    )
);

DROP POLICY IF EXISTS expense_insert_policy ON expense_split_group;
CREATE POLICY expense_insert_policy
ON expense_split_group
FOR INSERT
WITH CHECK (
    app_is_admin()
    OR (
        paid_by = app_user_id()
        AND app_user_belongs_to_group(group_id, app_user_id())
    )
);

DROP POLICY IF EXISTS expense_update_policy ON expense_split_group;
CREATE POLICY expense_update_policy
ON expense_split_group
FOR UPDATE
USING (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
)
WITH CHECK (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
);

DROP POLICY IF EXISTS expense_delete_policy ON expense_split_group;
CREATE POLICY expense_delete_policy
ON expense_split_group
FOR DELETE
USING (
    app_is_admin()
    OR app_user_belongs_to_group(group_id, app_user_id())
);

DROP POLICY IF EXISTS payment_party_access_policy ON payment;
CREATE POLICY payment_party_access_policy
ON payment
FOR SELECT
USING (
    app_is_admin()
    OR app_is_banker()
    OR from_user_id = app_user_id()
    OR to_user_id = app_user_id()
);

DROP POLICY IF EXISTS payment_insert_policy ON payment;
CREATE POLICY payment_insert_policy
ON payment
FOR INSERT
WITH CHECK (
    app_is_admin()
    OR from_user_id = app_user_id()
);
