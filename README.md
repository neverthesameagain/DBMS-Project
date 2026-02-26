# Splitzy Pay

A full-stack financial management and expense-splitting application built as a DBMS course project.

---

## What it does

- Make **UPI payments** between users within the app
- Create **expense groups** and split costs equally or unequally
- Track **who owes whom** with per-member balance calculations
- Set **personal category budgets** (Food, Travel, etc.) and monitor spend vs allocation
- Generate **analytics** — category breakdowns and monthly spending trends
- Plan **future expenses** with status tracking (Planned → Paid / Cancelled)
- Every transaction is recorded in a **unified financial ledger**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, React Router v7, Tailwind CSS v3, Chart.js, Axios |
| Backend | Python / Flask, SQLAlchemy ORM, Flask-JWT-Extended, Flask-Bcrypt, Flask-CORS |
| Database | PostgreSQL (production) / SQLite (local dev) |
| Auth | JWT — stateless tokens, bcrypt password hashing |

---

## Project Structure

```
DBMS-Project/
├── backend/          # Flask REST API (port 5001)
├── frontend/         # React/Vite app (port 5173)
├── database/         # PostgreSQL schema, seed data, reference queries
│   ├── schema.sql
│   ├── seed.sql
│   ├── queries.sql
│   └── README.md
└── .gitignore
```

See the `README.md` in each subfolder for detailed setup instructions.

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) PostgreSQL — SQLite works for local dev

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # fill in DATABASE_URL + JWT_SECRET_KEY
flask run --port=5001
```

For local dev with no Postgres, set:
```
DATABASE_URL=sqlite:///splitzy.db
JWT_SECRET_KEY=any-secret-string
```

The first run auto-creates all tables via `db.create_all()`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — sign up and explore.

---

## Database

The `database/` folder (gitignored) contains:
- **`schema.sql`** — PostgreSQL DDL for all 10 tables
- **`seed.sql`** — realistic demo data
- **`queries.sql`** — reference SQL mirroring all API logic

To initialise a cloud PostgreSQL database:
```bash
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/seed.sql   # optional
```

Recommended free providers: [Neon](https://neon.tech) · [Supabase](https://supabase.com) · [Render](https://render.com)

---

## Deployment

| Service | What |
|---|---|
| [Render](https://render.com) | Backend (Flask) + PostgreSQL |
| [Vercel](https://vercel.com) | Frontend (React/Vite) |
