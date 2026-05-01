# Splitzy Pay — Database

This folder contains everything needed to set up and populate the PostgreSQL database for Splitzy Pay.

---

## Files

| File | Purpose |
|---|---|
| `setup-splitzy-app-role.sql` | **Run once on Neon** — creates `splitzy_app` with `NOBYPASSRLS` + grants (backend must use this role, not `neondb_owner`) |
| `schema.sql` | One-shot setup: creates tables, constraints, indexes, functions, triggers, and views |
| `functions.sql` | Stored functions/procedures for balances, settlement math, group expense creation, and ledger trigger helpers |
| `triggers.sql` | Trigger definitions for automatic transactions, balance updates, budget spend updates, and initial balances |
| `views.sql` | Ledger and group-balance views |
| `rls.sql` | Optional PostgreSQL row-level security policies; backend must set `app.user_id` and `app.role` before enabling in production |
| `seed.sql` | Inserts sample users, groups, expenses, and payments for a dev/demo environment |
| `queries.sql` | Reference SQL for all common operations (mirrors what the backend API computes) |
| `verify-runtime-rls-manual.sql` | Manual checks for `splitzy_app`: session off/on and `payment` row counts |

---

## Neon roles (mandatory)

| Role | Use |
|------|-----|
| `neondb_owner` | Schema deploy only (`./deploy.sh` with owner `DATABASE_URL` in the shell). Has **BYPASSRLS** — **never** put this in `backend/.env`. |
| `splitzy_app` | Backend runtime (`DATABASE_URL` in Flask). **NOBYPASSRLS** — RLS policies always apply. Create via `setup-splitzy-app-role.sql`. |

The Flask app **refuses to start** if `DATABASE_URL` connects as a role with `rolbypassrls = true`.

---

## Database Schema Overview

```
users
 ├── groups              (created_by → users)
 │    └── group_members  (group_id + user_id)
 │    └── expenses       (group_id, paid_by → users)
 │         └── expense_splits  (expense_id, user_id → users)
 ├── payments            (from_user_id, to_user_id → users)
 └── future_expenses     (user_id → users)
```

### Tables at a Glance

| Table | Key Columns |
|---|---|
| `users` | `user_id`, `email`, `phone_number`, `current_balance`, `role`, `is_active` |
| `groups` | `group_id`, `group_name`, `created_by` |
| `group_members` | `group_id`, `user_id`, `role` (Admin/Member) |
| `expenses` | `expense_id`, `group_id`, `paid_by`, `amount`, `category` |
| `expense_splits` | `expense_id`, `user_id`, `share_amount`, `is_settled` |
| `payments` | `payment_id`, `from_user_id`, `to_user_id`, `amount` |
| `future_expenses` | `future_id`, `user_id`, `title`, `estimated_amount`, `due_date` |

---

## Hosting on Render (Recommended)

1. Go to [render.com](https://render.com) → **New** → **PostgreSQL**
2. Choose a name (e.g. `splitzy-db`), select the free tier, click **Create Database**
3. Copy the **External Database URL** — it looks like:
   ```
   postgresql://user:password@host:5432/splitzydb
   ```
4. Paste it into `backend/.env` as:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/splitzydb
   ```

---

## Alternative Platforms

| Platform | Free Tier | Notes |
|---|---|---|
| [Render](https://render.com) | ✅ 90-day free PostgreSQL | Easiest for this stack |
| [Supabase](https://supabase.com) | ✅ 500 MB free | Comes with a dashboard UI |
| [Neon](https://neon.tech) | ✅ Serverless, 512 MB free | Fastest cold starts |
| [Railway](https://railway.app) | ⚠️ Limited free credits | Simple deploys |

---

## Initializing the Database

### Option A — One-command deploy (`deploy.sh`)
Use the **owner** URL only in this shell (not in Flask):

```bash
export DATABASE_URL='postgresql://neondb_owner:PASSWORD@HOST/neondb?sslmode=require'
cd database
chmod +x deploy.sh   # once
./deploy.sh
```

Applies `schema.sql`, `functions.sql`, `triggers.sql`, `views.sql`, `rls.sql`, and `seed.sql` (if present), prints `current_user` / `rolbypassrls`, and reminds you that a bypassing role must not be used for runtime.

**Backend** `.env` must use **`splitzy_app`** (see `setup-splitzy-app-role.sql`).

### Option B — Using Flask-Migrate (recommended for dev)
```bash
cd backend
flask db migrate -m "initial"
flask db upgrade
```
> Flask-Migrate reads your `models.py` and generates the DDL automatically.
> Use `schema.sql` for cloud deployments where you don't run Flask migrations.

Admin user deletion is implemented as a soft delete (`users.is_active = FALSE`) so historical payments, expense splits, and ledger rows remain auditable.

---

## Notes on Seed Data

The seed file creates **4 users** (passwords are placeholder hashes — regenerate real bcrypt hashes via the `/api/users/create` endpoint or the signup page).

| User | Email | Opening Balance |
|---|---|---|
| Aryan Mathur | aryan@splitzy.com | ₹10,000 |
| Rahul Sharma | rahul@splitzy.com | ₹8,000 |
| Priya Verma | priya@splitzy.com | ₹12,000 |
| Amit Singh | amit@splitzy.com | ₹5,000 |

Two groups — **Goa Trip 2026** and **Room Expenses** — are pre-populated with expenses, splits, and payments.
