# Splitzy Pay — Final Features Summary

## Features Completed

- User authentication (signup, login, logout, JWT)
- Group creation, membership management, and roles
- Group expense splitting and settlement
- Personal expense budgets by category
- UPI ID management
- Payments (personal and group)
- Unified transaction ledger (DB + UI)
- Future expense planning and completion
- Analytics (category, monthly)
- Dashboard (stats, activity feed)
- Responsive React frontend with full flow

## SQL Functions Added

- `set_initial_balance()` — Trigger to set current_balance = opening_balance on user insert
- `amount_user_owes(debtor_id, creditor_id)` — Returns total owed from debtor to creditor
- `settle_group_balance(user1, user2)` — Returns net balance between two users across all groups

## Views

- `user_transaction_ledger` — Unified view of all user transactions (payments, group expenses, future expenses)
- `group_user_balances` — Per-group, per-user paid/owed/net balance summary

## Triggers

- `trg_set_initial_balance` — Ensures current_balance is always initialized from opening_balance

## API Routes

- `/api/auth` — signup, login, logout, profile
- `/api/users` — create, search
- `/api/groups` — CRUD, members, add member
- `/api/groups/:id/expenses` — add, list, balances
- `/api/payments` — send, history
- `/api/analytics` — category/monthly
- `/api/future-expenses` — CRUD
- `/api/dashboard` — stats, activity
- `/api/ledger` — unified transaction ledger (new)

## Frontend Pages

- Login
- Signup
- Dashboard
- Groups
- Group Details
- Payments
- Analytics
- Future Expenses
- **Ledger (new)**

## Demo Flow

Signup → Login → Create Group → Add Members → Add Expense → View Balances → Make Payment → See Ledger → Analytics

All flows tested and working for demo/viva.
