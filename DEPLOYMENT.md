# 🚀 Splitzy Pay — Production Deployment Guide

## Overview

This guide covers production deployment of Splitzy Pay with:
- **Database**: PostgreSQL (Neon) with RLS, triggers, and functions
- **Backend**: Flask (Render)
- **Frontend**: React + Vite (Vercel)

---

## 📋 Prerequisites

Before deployment:

- [ ] Neon PostgreSQL cluster created
- [ ] Render account with PostgreSQL support
- [ ] Vercel account
- [ ] GitHub repository connected
- [ ] Environment variables generated

---

## 🗂️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                        │
│              React + Vite (Static + API calls)              │
│              VITE_API_BASE_URL env variable                 │
└────────────┬────────────────────────────────────────────────┘
             │ HTTPS (API calls)
┌────────────▼────────────────────────────────────────────────┐
│                   Render (Backend)                          │
│            Flask + SQLAlchemy + Gunicorn                    │
│      DATABASE_URL (APP role) + JWT_SECRET_KEY               │
│      CORS: Vercel frontend domain only                      │
└────────────┬────────────────────────────────────────────────┘
             │ psycopg2-binary
┌────────────▼────────────────────────────────────────────────┐
│                 Neon (PostgreSQL)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Schema + Functions + Triggers + Views (OWNER role)  │  │
│  │ RLS Policies (app_user_id, app_role config vars)    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ APP Role (NOBYPASSRLS) — Production Runtime         │  │
│  │ - Read/Write via RLS policies only                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌍 1. Database Setup (Neon)

### 1.1 Create Database & Roles

```sql
-- Connect as Neon SUPERUSER (default psql connection)

-- Create APP role (NO BYPASSRLS, used in production)
CREATE ROLE app_user WITH PASSWORD 'your-secure-password' NOLOGIN;
ALTER ROLE app_user SET search_path = public;

-- Grant necessary privileges
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Ensure APP role cannot bypass RLS
ALTER ROLE app_user NOBYPASSRLS;

-- Verify
\du  -- List roles
\l   -- List databases
```

### 1.2 Deploy Schema & Data

```bash
cd database/

# Make script executable
chmod +x deploy.sh

# Set environment variables
export DATABASE_URL_OWNER="postgresql://neon-user@host/dbname"

# Run deployment
./deploy.sh
```

The script deploys in order:
1. **schema.sql** — Tables & constraints
2. **functions.sql** — Stored procedures
3. **triggers.sql** — Automatic balance/ledger updates
4. **views.sql** — User transaction ledger, group balances
5. **rls.sql** — Row-level security policies
6. **seed.sql** — (Optional) demo data

### 1.3 Verify Deployment

```sql
-- Check tables
\dt

-- Check RLS policies
\d group_members
\d expense_split_group
\d payment

-- Check functions
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

-- Check triggers
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Verify APP role has correct privileges
GRANT SELECT ON users TO app_user;
```

### 1.4 Get Connection Strings

From Neon dashboard, copy:

- **DATABASE_URL_OWNER**: Connection string for OWNER role (superuser/provider)
- **DATABASE_URL_APP**: Connection string for APP role (production app)

Example format:
```
postgresql://user:password@ep-example.us-east-1.neon.tech/dbname
```

---

## 🧠 2. Backend Setup (Render)

### 2.1 Clean Requirements

✅ Already in [backend/requirements.txt](../backend/requirements.txt)

```
Flask==3.0.0
Flask-SQLAlchemy==3.1.1
Flask-CORS==4.0.0
Flask-Migrate==4.0.5
Flask-Bcrypt==1.0.1
Flask-JWT-Extended==4.6.0
psycopg2-binary==2.9.9
python-dotenv==1.0.0
gunicorn==21.2.0
```

**NO:** `pip freeze` ❌  
**YES:** Hand-picked minimal set ✅

### 2.2 Procfile

✅ Already created: [Procfile](../Procfile)

```
web: gunicorn run:app
```

### 2.3 Flask Configuration

✅ Already configured: [backend/config.py](../backend/config.py)

Checks:
- ✅ `SQLALCHEMY_DATABASE_URI` from `DATABASE_URL` env var
- ✅ `JWT_SECRET_KEY` from env var
- ✅ Both required (raises RuntimeError if missing)

### 2.4 CORS Configuration

✅ Already configured: [backend/app/__init__.py](../backend/app/__init__.py)

- ✅ Reads `FRONTEND_URL` from env (comma-separated)
- ✅ Falls back to localhost for dev
- ✅ Applies only to `/api/*` routes
- ✅ `supports_credentials=True` for JWT

### 2.5 RLS Integration

✅ Already configured: [backend/app/__init__.py](../backend/app/__init__.py)

Sets PostgreSQL session variables:
- `app.user_id` — From JWT token
- `app.role` — From database `users.role`

RLS policies use these to filter data at the database level.

### 2.6 Production Settings

✅ Already fixed: [backend/run.py](../backend/run.py)

- ✅ `debug=True` **only when** `FLASK_ENV=development`
- ✅ `host='0.0.0.0'` (listen on all interfaces)
- ✅ `port` from `PORT` env var (default: 5000)
- ✅ **NO hardcoded localhost**

### 2.7 Deploy to Render

1. **Create Web Service**
   - Connect GitHub repository
   - Build command: `pip install -r backend/requirements.txt`
   - Start command: `gunicorn run:app` (from Procfile)
   - Environment: `us-east` (or closest)

2. **Set Environment Variables**
   ```
   DATABASE_URL = postgresql://app_user:password@host/dbname
   JWT_SECRET_KEY = (generate: openssl rand -hex 32)
   FRONTEND_URL = https://your-vercel-domain.com
   FLASK_ENV = production
   ```

3. **Deploy**
   - Push to GitHub (main branch)
   - Render auto-deploys

4. **Verify**
   ```bash
   curl https://your-app.onrender.com/api/auth/status
   # Should return JSON, not error
   ```

---

## 🎨 3. Frontend Setup (Vercel)

### 3.1 API Base URL Configuration

✅ Already configured: [frontend/src/lib/api.js](../frontend/src/lib/api.js)

Uses Vite env variable:
```javascript
baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001'
```

### 3.2 Environment Files

✅ Created:
- [frontend/.env.example](../frontend/.env.example)
- [frontend/.env.production](../frontend/.env.production)

### 3.3 Build Configuration

✅ Ready: [frontend/vite.config.js](../frontend/vite.config.js)

Already has React plugin enabled.

### 3.4 Deploy to Vercel

1. **Connect Repository**
   - Visit vercel.com
   - Import project from GitHub
   - Select `frontend` directory as root

2. **Build Settings**
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`

3. **Environment Variables**
   ```
   VITE_API_BASE_URL = https://your-app.onrender.com
   ```

4. **Deploy**
   - Vercel auto-deploys on push to main

5. **Verify**
   - Visit https://your-vercel-domain.com
   - Open browser DevTools → Network
   - Login and check API calls go to Render backend

---

## 🔐 4. Security Checklist

- [ ] **Database**: APP role has `NOBYPASSRLS`
- [ ] **Database**: RLS policies enabled on protected tables
- [ ] **Backend**: `debug=True` **only in development**
- [ ] **Backend**: `DATABASE_URL` uses APP role (not OWNER)
- [ ] **Backend**: `JWT_SECRET_KEY` is 32+ random characters
- [ ] **Backend**: `FRONTEND_URL` set to production domain
- [ ] **Frontend**: No API base URL hardcoded (uses `VITE_API_BASE_URL`)
- [ ] **Frontend**: `.env` files not committed to Git
- [ ] **Backend**: `.env` files not committed to Git
- [ ] **Secrets**: NEVER in code, always in environment

### 4.1 Generate JWT Secret

```bash
openssl rand -hex 32
```

Output example: `5e1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o`

Set as `JWT_SECRET_KEY` in Render.

---

## 🧪 5. Production Validation

### 5.1 Test Backend Connectivity

```bash
# Replace with your Render URL
curl https://your-app.onrender.com/api/auth/status \
  -H "Content-Type: application/json"
```

Expected: JSON response (not error)

### 5.2 Test RLS Is Active

```bash
# Connect with APP role
psql postgresql://app_user:password@host/dbname

-- Try to read data (should be empty, RLS active)
SELECT COUNT(*) FROM group_members;

-- Try to read data with session variable set
SELECT set_config('app.user_id', '1', false);
SELECT * FROM group_members LIMIT 1;
-- Should still be restricted
```

### 5.3 Test JWT & RLS Integration

```bash
# Sign up + login to get JWT token
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Copy token from response
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# Use token to access protected route
curl https://your-app.onrender.com/api/users/profile \
  -H "Authorization: Bearer $TOKEN"

# Should return authenticated user data (RLS applied)
```

### 5.4 Test CORS

```bash
# From browser at https://your-vercel-domain.com
# Open DevTools → Console

fetch('https://your-app.onrender.com/api/users/profile', {
  method: 'GET',
  headers: {'Authorization': 'Bearer YOUR_TOKEN'},
  credentials: 'include'
})
.then(r => r.json())
.then(console.log)
.catch(console.error)

# Should succeed, not CORS error
```

---

## 📚 6. Required Environment Variables

### Backend (Render)

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | App role connection string | `postgresql://app_user:pw@host/db` |
| `JWT_SECRET_KEY` | 32+ random characters | `5e1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o` |
| `FRONTEND_URL` | Frontend production domain | `https://splitzy.vercel.app` |
| `FLASK_ENV` | Always `production` | `production` |

### Frontend (Vercel)

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_BASE_URL` | Backend production URL | `https://splitzy-api.onrender.com` |

### Database Setup Only (Neon)

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL_OWNER` | Owner role connection string | Schema migrations & setup |

---

## 🚨 7. Common Issues & Fixes

### Issue: `CORS error` when calling API

**Check:**
```bash
# Verify FRONTEND_URL in Render
echo $FRONTEND_URL  # Should match Vercel domain

# Verify header in Render app
curl https://your-app.onrender.com -I \
  -H "Origin: https://your-vercel-domain.com"
# Should have: Access-Control-Allow-Origin: https://your-vercel-domain.com
```

### Issue: `401 Unauthorized` even with valid JWT

**Check:**
```bash
# Token might be expired or malformed
# Regenerate JWT_SECRET_KEY in Render
openssl rand -hex 32
# Update in Render environment
# Restart backend (pull latest)
```

### Issue: `RLS policy violated` when accessing data

**Check:**
```sql
-- Verify RLS policies exist
SELECT * FROM pg_policies WHERE tablename = 'group_members';

-- Verify APP role has SELECT permission
GRANT SELECT ON group_members TO app_user;

-- Verify session variables are set correctly
SELECT current_setting('app.user_id', true);
SELECT current_setting('app.role', true);
```

### Issue: Database connection fails in production

**Check:**
```bash
# Test connection from backend
psql "$DATABASE_URL" -c "SELECT 1"

# Verify URL format is correct (should work)
# Verify Neon firewall allows Render IP range
# Check Neon status page for incidents
```

---

## 📤 8. Deployment Checklist

Before going live:

- [ ] Database deployed (schema + RLS + functions + triggers)
- [ ] Backend deployed to Render with correct env vars
- [ ] Frontend deployed to Vercel with `VITE_API_BASE_URL`
- [ ] All three systems can communicate (tested with curl/browser)
- [ ] JWT secret is set and strong
- [ ] `.env` files are NOT in Git
- [ ] RLS is active (test with APP role)
- [ ] CORS allows frontend origin
- [ ] No localhost references in production code
- [ ] Monitoring set up (Render/Vercel logs)

---

## 🔄 9. Maintenance & Updates

### Deploy Code Changes

```bash
git push origin main  # Render & Vercel auto-deploy
```

### Deploy Database Changes

```bash
# New migration
flask db migrate -m "add column X"
flask db upgrade  # Manual run against OWNER connection

# Or use deploy.sh script for manual updates
DATABASE_URL_OWNER=... ./database/deploy.sh
```

### Rotate JWT Secret (Security)

1. Generate new secret
   ```bash
   openssl rand -hex 32
   ```
2. Update `JWT_SECRET_KEY` in Render
3. Existing tokens become invalid (users re-login automatically)
4. Restart backend

### Monitor Logs

- **Render**: Dashboard → Logs
- **Vercel**: Dashboard → Deployments → Logs
- **Neon**: Dashboard → Query Performance → Logs

---

## 📞 Support

For issues:
1. Check logs: Render → Logs, Vercel → Logs, Neon → Logs
2. Test connectivity: `curl` backend from frontend
3. Verify env vars: All three set correctly
4. Check RLS: Run SQL verification queries
5. Review GitHub commits: What changed in last deploy?

---

**Deployed successfully? 🎉 Monitor in production:**
- Database query performance (Neon)
- Backend error rates (Render)
- Frontend build performance (Vercel)
