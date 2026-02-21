# Backend

Flask REST API for Splitzy Pay. Uses the **Application Factory pattern** (`create_app()` in `__init__.py`) to avoid circular imports and make the app testable.

---

## Structure

```
backend/
├── app/
│   ├── __init__.py       # create_app() — registers blueprints, CORS, extensions
│   ├── models.py         # SQLAlchemy models (10 tables)
│   ├── extensions.py     # db, bcrypt, jwt, migrate — initialised here, imported everywhere
│   └── routes/
│       ├── auth_routes.py      # /api/auth — signup, login, profile
│       ├── user_routes.py      # /api/users — create, search
│       ├── group_routes.py     # /api/groups — CRUD + members
│       ├── expense_routes.py   # /api/groups/:id/expenses + balances
│       ├── payment_routes.py   # /api/payments — send + history
│       ├── analytics_routes.py # /api/analytics — category + monthly
│       ├── future_routes.py    # /api/future-expenses — CRUD
│       └── dashboard_routes.py # /api/dashboard — stats + activity
├── migrations/           # Flask-Migrate versions
├── config.py             # Loads DATABASE_URL + JWT_SECRET_KEY from .env
├── run.py                # Entry point
├── requirements.txt
├── .env.example
└── README.md
```

---

## Setup

```bash
# 1. (Optional) create a virtual environment
python -m venv venv && source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create .env
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET_KEY

# 4. Start
flask run --port=5001
```

For **local dev without Postgres**, use SQLite:
```
DATABASE_URL=sqlite:///splitzy.db
JWT_SECRET_KEY=any-random-string
```
Tables are created automatically on first run via `db.create_all()`.

---

## API Reference

All routes are prefixed with `/api`. JWT-protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | No | Register new user |
| POST | `/login` | No | Returns JWT + user object |
| GET | `/profile` | ✅ | Get logged-in user's data |

### Users — `/api/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/create` | No | Alias for signup (used by frontend) |
| GET | `/search?q=` | No | Search users by email or phone |

### Groups — `/api/groups`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | ✅ | List user's groups |
| POST | `/create` | ✅ | Create a group |
| GET | `/:id` | ✅ | Group detail |
| GET | `/:id/members` | ✅ | List members with roles |
| POST | `/:id/members` | ✅ | Add a member |
| DELETE | `/:id/members/:uid` | ✅ | Remove a member |

### Expenses — `/api/groups/:id`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/expenses` | ✅ | All expense split rows for a group |
| POST | `/expenses` | ✅ | Add expense → creates one row per member |
| GET | `/balances` | ✅ | Net paid/owes per member |

### Payments — `/api/payments`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `` | ✅ | Payment history (sent + received) |
| POST | `` | ✅ | Send payment → creates Transaction ledger entry |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/api/analytics` | Category breakdown + monthly trend |
| GET | `/api/dashboard/stats` | you_owe, you_are_owed, monthly_spend, balance |
| GET | `/api/dashboard/activity` | Last 20 expenses + payments |
| GET/POST | `/api/future-expenses` | List / create future expenses |
| PATCH/DELETE | `/api/future-expenses/:id` | Update status / delete |

---

## Models (10 tables)

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | Core identity + balances |
| `Category` | `category` | Food, Travel, etc. |
| `Group` | `groups` | Expense group |
| `GroupMember` | `group_members` | Role: Admin / Moderator / Member |
| `PersonalExpenseSplit` | `personal_expense_split` | Budget vs actual per category |
| `UpiId` | `upi_id` | User UPI handles |
| `Transaction` | `transactions` | Unified ledger — one row per event |
| `Payment` | `payment` | PERSONAL or GROUP transfer |
| `ExpenseSplitGroup` | `expense_split_group` | One row per member per expense |
| `FutureExpense` | `future_expense` | Planned costs |