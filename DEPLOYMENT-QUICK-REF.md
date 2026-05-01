# 📋 Deployment Quick Reference

## 🎯 TL;DR: Deploy in 3 Steps

### Step 1: Deploy Database (Neon)

```bash
# Set credentials for Neon OWNER role
export DATABASE_URL_OWNER="postgresql://user:password@host/dbname"

# Deploy all database components
cd database/
chmod +x deploy.sh
./deploy.sh

# Verify in psql
psql $DATABASE_URL_OWNER -c "\d"
```

**What deploys:**
- ✅ Tables (schema.sql)
- ✅ Functions (functions.sql)
- ✅ Triggers (triggers.sql)
- ✅ Views (views.sql)
- ✅ RLS Policies (rls.sql)

---

### Step 2: Deploy Backend (Render)

1. **Connect GitHub** → Choose this repo
2. **Set environment variables:**

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://app_user:password@neon-host/db` |
   | `JWT_SECRET_KEY` | `openssl rand -hex 32` |
   | `FRONTEND_URL` | `https://your-vercel-domain.com` |
   | `FLASK_ENV` | `production` |

3. **Deploy:**
   - Render auto-builds from Git push
   - Uses `Procfile` automatically
   - Backend ready at `https://your-app.onrender.com`

---

### Step 3: Deploy Frontend (Vercel)

1. **Connect GitHub** → Choose this repo
2. **Set root directory:** `frontend/`
3. **Set environment variable:**

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | `https://your-app.onrender.com` |

4. **Deploy:**
   - Vercel auto-builds from Git push
   - Frontend ready at `https://your-vercel-domain.com`

---

## ✅ Verification Checklist

```bash
# 1. Backend is running
curl https://your-app.onrender.com/api/auth/status

# 2. Frontend calls correct API
# Open browser console at https://your-vercel-domain.com
# Network tab should show API calls to your-app.onrender.com

# 3. RLS is active on database
psql "postgresql://app_user:password@host/db" -c "SELECT COUNT(*) FROM group_members;"

# 4. JWT works
TOKEN=$(curl -s -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | jq -r .access_token)

curl https://your-app.onrender.com/api/users/profile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔐 Security Quick Check

- ✅ Database: APP role has `NOBYPASSRLS`
- ✅ Backend: Uses APP role connection (not OWNER)
- ✅ Backend: `debug=False` in production
- ✅ Backend: `JWT_SECRET_KEY` is 32+ random chars
- ✅ CORS: Only allows Vercel frontend domain
- ✅ `.env` files: NOT committed to Git

---

## 📦 Deployment Files

| File | Purpose |
|------|---------|
| [Procfile](./Procfile) | Render start command |
| [backend/requirements.txt](./backend/requirements.txt) | Python dependencies (no pip freeze) |
| [backend/config.py](./backend/config.py) | Database & JWT from env vars |
| [backend/run.py](./backend/run.py) | Flask entrypoint (debug mode from env) |
| [backend/.env.example](./backend/.env.example) | Backend env var template |
| [frontend/.env.example](./frontend/.env.example) | Frontend env var template |
| [frontend/.env.production](./frontend/.env.production) | Production-only frontend vars |
| [database/deploy.sh](./database/deploy.sh) | Database deployment script |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Full deployment guide |

---

## 🚨 If Something Goes Wrong

1. **Backend won't start:** Check logs at `Render → Logs`
   - Missing `DATABASE_URL`? Set it
   - DB connection fails? Test: `psql $DATABASE_URL -c "SELECT 1"`

2. **Frontend calls fail (CORS):** Check backend logs
   - Wrong `FRONTEND_URL`? Update in Render and restart
   - Test: `curl -H "Origin: your-vercel-domain" https://your-app.onrender.com`

3. **RLS blocks all data:** Check database
   - APP role missing permission? `GRANT SELECT ON table TO app_user;`
   - Session vars not set? Verify Flask hook runs before DB query

4. **JWT token invalid:** Regenerate secret
   - `openssl rand -hex 32` → set as `JWT_SECRET_KEY` in Render
   - Restart backend

---

## 📞 Important Links

- **Render Dashboard:** https://render.com/dashboard
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Neon Console:** https://console.neon.tech
- **Full Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Questions?** See full guide in [DEPLOYMENT.md](./DEPLOYMENT.md)
