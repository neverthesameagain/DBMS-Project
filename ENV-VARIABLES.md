# 🔑 Environment Variables Reference

## Overview

This document lists all required environment variables for production deployment across three platforms: Neon (Database), Render (Backend), and Vercel (Frontend).

---

## 🗄️ Database Setup (Neon)

### Purpose
Create PostgreSQL roles and database. **Run once during setup.**

### SQL Commands

```sql
-- Connect to Neon with your superuser account

-- Create APP role (used by production app)
CREATE ROLE app_user WITH PASSWORD 'your-secure-password' NOLOGIN;
ALTER ROLE app_user SET search_path = public;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
ALTER ROLE app_user NOBYPASSRLS;  -- CRITICAL: No RLS bypass in production
```

### Connection Strings

From Neon dashboard, copy these connection strings:

| Variable | Format | Example |
|----------|--------|---------|
| `DATABASE_URL_OWNER` | `postgresql://user:password@host/dbname` | `postgresql://neon_owner@ep-xxx.us-east-1.neon.tech/splitzy_prod` |
| `DATABASE_URL_APP` | `postgresql://app_user:password@host/dbname` | `postgresql://app_user:pw123@ep-xxx.us-east-1.neon.tech/splitzy_prod` |

**Use:**
- `DATABASE_URL_OWNER` — Only for schema migrations (one-time in `deploy.sh`)
- `DATABASE_URL_APP` — Set as `DATABASE_URL` in Render backend

---

## 🧠 Backend Configuration (Render)

### Required Variables

Set these in Render dashboard → Environment:

#### 1. `DATABASE_URL` **[REQUIRED]**
- **Value:** PostgreSQL connection string using APP role
- **Format:** `postgresql://app_user:password@host:5432/dbname`
- **Example:** `postgresql://app_user:mypassword@ep-xxx.us-east-1.neon.tech/splitzy_prod`
- **DO NOT use:** OWNER role connection string
- **Generate:** Copy `DATABASE_URL_APP` from Neon dashboard

```bash
# Test locally
psql "postgresql://app_user:password@host/db" -c "SELECT 1"
```

#### 2. `JWT_SECRET_KEY` **[REQUIRED]**
- **Value:** 32+ character random string
- **Format:** Hexadecimal recommended
- **Example:** `5e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9`
- **Generate:**
  ```bash
  openssl rand -hex 32
  # Output: 5e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9...
  ```
- **DO NOT:** Share, commit to Git, or reuse

#### 3. `FRONTEND_URL` **[REQUIRED]**
- **Value:** Production frontend domain (Vercel)
- **Format:** `https://domain.com` (comma-separated if multiple)
- **Example:** `https://splitzy.vercel.app`
- **Trailing slash:** None
- **Purpose:** CORS policy enforcement

```python
# Used in backend/app/__init__.py
allowed_origins = [o.strip() for o in os.environ.get("FRONTEND_URL", "").split(",") if o.strip()]
```

#### 4. `FLASK_ENV` **[RECOMMENDED]**
- **Value:** `production` (do not use `development`)
- **Purpose:** Disables debug mode if `development` not explicitly set
- **Used in:** `backend/run.py` → `debug=True` only if `FLASK_ENV=development`

### Optional Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Server port (Render uses this) |
| `VERCEL` | Not set | Auto-detected by Render |

### Render Environment Setup

1. Go to Render dashboard
2. Select Web Service → Environment
3. Add variables:

```
DATABASE_URL=postgresql://app_user:password@host/db
JWT_SECRET_KEY=5e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
FRONTEND_URL=https://splitzy.vercel.app
FLASK_ENV=production
```

---

## 🎨 Frontend Configuration (Vercel)

### Required Variables

Set in Vercel dashboard → Settings → Environment Variables:

#### 1. `VITE_API_BASE_URL` **[REQUIRED]**
- **Value:** Backend production URL
- **Format:** `https://domain.com` (no trailing slash)
- **Example:** `https://splitzy-api.onrender.com`
- **Used in:** `frontend/src/lib/api.js`
  ```javascript
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001'
  });
  ```

### Vercel Environment Setup

1. Go to Vercel dashboard
2. Select project → Settings → Environment Variables
3. Add variable:

```
VITE_API_BASE_URL=https://splitzy-api.onrender.com
```

4. Select environments where it applies:
   - ✅ Production
   - ⭕ Preview (optional, for staging)
   - ⭕ Development (optional, use local .env)

---

## 📝 Local Development (.env files)

### Backend: `backend/.env`

```bash
# Flask Configuration
FLASK_APP=run.py
FLASK_ENV=development

# Database (local or remote)
DATABASE_URL=postgresql://postgres:password@localhost:5432/splitzy_local

# JWT Secret (any value for development)
JWT_SECRET_KEY=dev-secret-key-not-for-production

# Frontend URLs for CORS
FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174

# Port
PORT=5000
```

**Create from template:**
```bash
cp backend/.env.example backend/.env
# Edit .env with your local values
```

### Frontend: `frontend/.env`

```bash
# Development
VITE_API_BASE_URL=http://127.0.0.1:5001
```

**Or use automatic:**
```bash
cp frontend/.env.example frontend/.env
# For local dev, file already has correct value
```

---

## 🔄 Environment Variable Flow

```
┌─────────────────────────────────────────────────────────┐
│  1. Local Development (.env files)                      │
│  ├─ backend/.env                                        │
│  └─ frontend/.env                                       │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  2. Deployment                                          │
│  ├─ Render (Backend) → Environment Variables            │
│  │  ├─ DATABASE_URL (APP role from Neon)               │
│  │  ├─ JWT_SECRET_KEY (generated secret)               │
│  │  ├─ FRONTEND_URL (Vercel domain)                    │
│  │  └─ FLASK_ENV=production                            │
│  │                                                      │
│  └─ Vercel (Frontend) → Environment Variables          │
│     └─ VITE_API_BASE_URL (Render backend URL)          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Guidelines

### Generate Strong Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Alternative: OpenSSL on macOS
security rand 32 | od -An -tx1 | tr -d ' '

# Test password strength
echo "your-password" | wc -c  # Should be 20+ characters
```

### Protect Secrets

- ✅ Store in Render/Vercel environment variables
- ✅ Use different secrets for each environment
- ✅ Rotate secrets annually or after team changes
- ❌ Never commit `.env` files to Git
- ❌ Never share secrets in chat/email
- ❌ Never reuse secrets across projects

### Verify in Production

```bash
# Check env vars are set (run in Render terminal)
echo $DATABASE_URL
echo $JWT_SECRET_KEY
echo $FRONTEND_URL

# Verify database connection works
python -c "import psycopg2; psycopg2.connect('$DATABASE_URL')"
```

---

## 🚨 Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `DATABASE_URL` with OWNER role | `DATABASE_URL` with APP role |
| `FRONTEND_URL=localhost:3000` | `FRONTEND_URL=https://domain.com` |
| `JWT_SECRET_KEY=12345` | `JWT_SECRET_KEY=<32 random chars>` |
| `.env` committed to Git | `.env` in `.gitignore` |
| `FLASK_ENV=true` | `FLASK_ENV=production` |
| `VITE_API_BASE_URL` with trailing `/` | `VITE_API_BASE_URL` without `/` |

---

## ✅ Verification Commands

### Test Backend Connection

```bash
# Replace URL with actual Render backend
curl https://your-app.onrender.com/api/auth/status \
  -H "Content-Type: application/json"
```

### Test Database Connection

```bash
# From backend environment
psql $DATABASE_URL -c "SELECT current_user, current_database();"
```

### Test RLS Active

```bash
# From backend environment
psql $DATABASE_URL -c "SELECT current_setting('app.user_id', true);"
```

### Test JWT Works

```bash
# Get token
TOKEN=$(curl -s -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' | jq -r .access_token)

# Use token
curl https://your-app.onrender.com/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📋 Deployment Checklist

Before going live:

- [ ] `DATABASE_URL` set in Render (uses APP role, not OWNER)
- [ ] `JWT_SECRET_KEY` set in Render (32+ random chars)
- [ ] `FRONTEND_URL` set in Render (matches Vercel domain)
- [ ] `VITE_API_BASE_URL` set in Vercel (matches Render backend)
- [ ] `.env` files NOT committed to Git
- [ ] All env vars verified with test commands above
- [ ] RLS active on database (`NOBYPASSRLS` on APP role)
- [ ] Backend logs show no connection errors

---

## 🔄 Updating Environment Variables

### In Render

1. Dashboard → Web Service → Settings
2. Environment Variables
3. Click variable to edit
4. Save
5. Auto-redeploy or manually trigger

### In Vercel

1. Project Settings → Environment Variables
2. Click variable to edit
3. Save
4. Auto-redeploy or manually trigger

### Rotating JWT Secret (Security Update)

1. Generate new secret: `openssl rand -hex 32`
2. Update `JWT_SECRET_KEY` in Render
3. Restart backend (Render → Restart Service)
4. Existing tokens become invalid (users auto-logout)

---

## 📞 Troubleshooting

**Q: `DATABASE_URL not set` error**
- A: Check Render environment variables panel
- Verify connection string format
- Test with: `psql $DATABASE_URL -c "SELECT 1"`

**Q: CORS error from frontend**
- A: Check `FRONTEND_URL` in Render matches Vercel domain exactly
- Restart Render backend after updating
- Test: `curl -H "Origin: your-vercel-domain" backend-url`

**Q: JWT token invalid**
- A: Check `JWT_SECRET_KEY` is set and hasn't been rotated since token was issued
- Regenerate: `openssl rand -hex 32`
- Update in Render and restart

**Q: Frontend can't call backend API**
- A: Check `VITE_API_BASE_URL` in Vercel matches Render backend URL
- Verify Render backend is running
- Check browser console for full error message

---

**Last Updated:** May 1, 2026  
**Version:** 1.0 Production
