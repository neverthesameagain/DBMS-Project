-- =============================================================
-- Splitzy Pay — Common SQL Queries (spec-aligned schema)
-- =============================================================


-- -----------------------------------------------------------
-- AUTH & USERS
-- -----------------------------------------------------------

-- Login: look up user by email
SELECT user_id, first_name, last_name, email, hashed_password, current_balance
FROM   users
WHERE  email = 'aryan@splitzy.com';

-- User's UPI handles
SELECT upi_handle FROM upi_id WHERE user_id = 1;


-- -----------------------------------------------------------
-- GROUPS
-- -----------------------------------------------------------

-- All groups a user belongs to
SELECT g.group_id, g.group_name, gm.role, gm.joined_at,
       COUNT(gm2.user_id) AS member_count
FROM   groups        g
JOIN   group_members gm  ON gm.group_id = g.group_id AND gm.user_id = 1
JOIN   group_members gm2 ON gm2.group_id = g.group_id
GROUP  BY g.group_id, g.group_name, gm.role, gm.joined_at;

-- Members of a group with roles
SELECT u.user_id, u.first_name, u.last_name, u.email, gm.role, gm.joined_at
FROM   group_members gm
JOIN   users u ON u.user_id = gm.user_id
WHERE  gm.group_id = 1
ORDER  BY CASE gm.role WHEN 'Admin' THEN 1 WHEN 'Moderator' THEN 2 ELSE 3 END;


-- -----------------------------------------------------------
-- EXPENSE SPLIT GROUP (Group Expenses)
-- -----------------------------------------------------------

-- All expenses in a group (distinct expense events)
SELECT DISTINCT ON (esg.description, esg.paid_by, esg.created_at)
       esg.expense_id,
       esg.description,
       c.category_name,
       SUM(esg.amount) OVER (PARTITION BY esg.paid_by, esg.description, esg.created_at) AS total_amount,
       u.first_name || ' ' || u.last_name  AS paid_by_name,
       esg.created_at
FROM   expense_split_group esg
JOIN   users    u ON u.user_id = esg.paid_by
LEFT   JOIN category c ON c.category_id = esg.category_id
WHERE  esg.group_id = 1
ORDER  BY esg.created_at DESC;

-- What a specific user owes in a group (unsettled shares paid by others)
SELECT esg.expense_id,
       esg.description,
       u_payer.first_name || ' ' || u_payer.last_name AS paid_by_name,
       esg.amount AS your_share,
       esg.is_settled
FROM   expense_split_group esg
JOIN   users u_payer ON u_payer.user_id = esg.paid_by
WHERE  esg.group_id   = 1      -- :group_id
  AND  esg.paid_for   = 2      -- :user_id
  AND  esg.paid_by   <> 2      -- :user_id (exclude own payments)
  AND  esg.is_settled = FALSE;

-- Net balance per member in a group
SELECT u.user_id,
       u.first_name || ' ' || u.last_name                                          AS name,
       COALESCE(SUM(CASE WHEN esg.paid_by  = u.user_id THEN esg.amount ELSE 0 END), 0)  AS total_paid,
       COALESCE(SUM(CASE WHEN esg.paid_for = u.user_id
                          AND esg.paid_by  <> u.user_id
                          AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0)     AS still_owes,
       COALESCE(SUM(CASE WHEN esg.paid_by  = u.user_id
                          AND esg.paid_for <> u.user_id
                          AND esg.is_settled = FALSE THEN esg.amount ELSE 0 END), 0)     AS is_owed
FROM   group_members gm
JOIN   users                u   ON u.user_id = gm.user_id
LEFT   JOIN expense_split_group esg ON esg.group_id = gm.group_id
                                   AND (esg.paid_by = u.user_id OR esg.paid_for = u.user_id)
WHERE  gm.group_id = 1
GROUP  BY u.user_id, u.first_name, u.last_name;


-- -----------------------------------------------------------
-- PERSONAL EXPENSE SPLIT (Budget Tracking)
-- -----------------------------------------------------------

-- User's budget vs actual spend per category
SELECT c.category_name,
       pes.allocated_amount,
       pes.amount_spent,
       pes.allocated_amount - pes.amount_spent AS remaining,
       pes.reminder_for,
       pes.duration
FROM   personal_expense_split pes
JOIN   category c ON c.category_id = pes.category_id
WHERE  pes.user_id = 1
ORDER  BY pes.allocated_amount DESC;


-- -----------------------------------------------------------
-- PAYMENTS
-- -----------------------------------------------------------

-- Payment history for a user (sent + received)
SELECT p.payment_id,
       s.first_name || ' ' || s.last_name  AS from_name,
       r.first_name || ' ' || r.last_name  AS to_name,
       c.category_name,
       p.amount,
       p.payment_type,
       p.status,
       p.note,
       p.created_at,
       CASE WHEN p.from_user_id = 1 THEN 'sent' ELSE 'received' END AS direction
FROM   payment   p
JOIN   users     s ON s.user_id = p.from_user_id
JOIN   users     r ON r.user_id = p.to_user_id
LEFT   JOIN category c ON c.category_id = p.category_id
WHERE  p.from_user_id = 1 OR p.to_user_id = 1
ORDER  BY p.created_at DESC;


-- -----------------------------------------------------------
-- TRANSACTIONS (Unified Ledger)
-- -----------------------------------------------------------

-- All transactions ordered by recency
SELECT t.transaction_id,
       t.transaction_type,
       t.reference_id,
       t.amount,
       t.created_at
FROM   transactions t
ORDER  BY t.created_at DESC
LIMIT  50;

-- Recent activity for dashboard (expenses + payments combined)
SELECT 'expense' AS kind,
       esg.expense_id     AS ref_id,
       esg.description    AS label,
       esg.amount,
       esg.created_at
FROM   expense_split_group esg
JOIN   group_members gm ON gm.group_id = esg.group_id AND gm.user_id = 1
WHERE  esg.paid_by = 1
UNION ALL
SELECT 'payment',
       p.payment_id,
       COALESCE(p.note, 'Payment'),
       p.amount,
       p.created_at
FROM   payment p
WHERE  p.from_user_id = 1 OR p.to_user_id = 1
ORDER  BY created_at DESC
LIMIT  20;


-- -----------------------------------------------------------
-- DASHBOARD STATS
-- -----------------------------------------------------------

-- You owe (splits where others paid and you haven't settled)
SELECT ROUND(SUM(esg.amount), 2) AS you_owe
FROM   expense_split_group esg
WHERE  esg.paid_for   = 1        -- :user_id
  AND  esg.paid_by   <> 1        -- :user_id
  AND  esg.is_settled = FALSE;

-- You are owed (splits where you paid and others haven't settled)
SELECT ROUND(SUM(esg.amount), 2) AS you_are_owed
FROM   expense_split_group esg
WHERE  esg.paid_by    = 1        -- :user_id
  AND  esg.paid_for  <> 1        -- :user_id
  AND  esg.is_settled = FALSE;

-- Monthly spend this calendar month
SELECT ROUND(SUM(esg.amount), 2) AS monthly_spend
FROM   expense_split_group esg
WHERE  esg.paid_by = 1           -- :user_id
  AND  esg.paid_for = 1          -- own share only
  AND  DATE_TRUNC('month', esg.created_at) = DATE_TRUNC('month', NOW());


-- -----------------------------------------------------------
-- ANALYTICS
-- -----------------------------------------------------------

-- Spending by category
SELECT c.category_name,
       ROUND(SUM(esg.amount), 2) AS total_spent
FROM   expense_split_group esg
JOIN   category c ON c.category_id = esg.category_id
WHERE  esg.paid_by = 1
GROUP  BY c.category_name
ORDER  BY total_spent DESC;

-- Monthly trend (last 6 months)
SELECT TO_CHAR(esg.created_at, 'Mon YYYY')  AS month,
       ROUND(SUM(esg.amount), 2)             AS total_spent
FROM   expense_split_group esg
WHERE  esg.paid_by = 1
  AND  esg.created_at >= NOW() - INTERVAL '6 months'
GROUP  BY DATE_TRUNC('month', esg.created_at), TO_CHAR(esg.created_at, 'Mon YYYY')
ORDER  BY DATE_TRUNC('month', esg.created_at);


-- -----------------------------------------------------------
-- FUTURE EXPENSES
-- -----------------------------------------------------------

-- Upcoming (not paid or cancelled)
SELECT fe.future_expense_id,
       c.category_name,
       fe.estimated_amount,
       fe.expected_date,
       fe.status
FROM   future_expense fe
LEFT   JOIN category c ON c.category_id = fe.category_id
WHERE  fe.user_id = 1
  AND  fe.status  = 'PLANNED'
ORDER  BY fe.expected_date NULLS LAST;
