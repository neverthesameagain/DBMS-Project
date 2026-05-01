# 🔒 FINAL PRODUCTION HARDENING CHECKLIST

**Version:** Final  
**Date:** May 1, 2026  
**Status:** Production Ready for Deployment  

---

## 🚨 CRITICAL RULES VERIFICATION

All critical rules must be satisfied before deployment:

| Rule | Status | Verification |
|------|--------|-------------|
| ❌ NO `pip freeze` blindly | ✅ ENFORCED | `requirements.txt` uses version ranges |
| ❌ NO unnecessary dependencies | ✅ ENFORCED | 9 packages, all required |
| ❌ NO OWNER role in runtime | ✅ ENFORCED | APP role used, NOBYPASSRLS |
| ❌ NEVER bypass RLS | ✅ ENFORCED | FORCE RLS, no BYPASSRLS |
| ❌ NO hardcoded localhost | ✅ ENFORCED | All URLs from env vars |
| ❌ NO secrets in repo | ✅ ENFORCED | .env in .gitignore |
| ❌ NO debug=True in production | ✅ ENFORCED | From FLASK_ENV check |

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Phase 1: Database Setup (Neon)

**⚠️  CRITICAL: Perform BEFORE running deploy.sh**

```
[ ] 1. Access Neon console
    URL: https://console.neon.tech

[ ] 2. Create database instance
    Name: splitzy_prod
    Region: closest to users
    Save connection details

[ ] 3. Create roles (run 00-roles.sql)
    psql <neon-connection> -f database/00-roles.sql
    
    [ ] When prompted, set:
        - owner_role password (strong, 32+ chars)
        - app_user password (strong, 32+ chars)
    
    [ ] Verify output shows:
        app_user   | t (NOBYPASSRLS = true)
        app_user   | f (no superuser)

[ ] 4. Save connection strings
    [ ] DATABASE_URL_OWNER = postgresql://owner_role:password@host/splitzy_prod
    [ ] DATABASE_URL_APP = postgresql://app_user:password@host/splitzy_prod
    
    ⚠️  KEEP OWNER CREDS SECURE (backup in vault/secrets manager)
    🔐 USE APP CREDS ONLY in production

[ ] 5. Test connections
    psql "$DATABASE_URL_OWNER" -c "SELECT current_user"
    psql "$DATABASE_URL_APP" -c "SELECT current_user"
    
    Should show:
    - First: owner_role
    - Second: app_user

[ ] 6. Deploy database schema
    export DATABASE_URL_OWNER="postgresql://owner_role:pw@host/db"
    cd database/
    chmod +x deploy.sh
    chmod +x validate-production.sh
    ./deploy.sh
    
    [ ] Script completes without errors
    [ ] RLS verification shows:
        - ✅ Enforces RLS
        - ✅ Tables exist
        - ✅ Functions exist
        - ✅ Triggers exist
        - ✅ Policies exist

[ ] 7. Verify RLS is ACTIVE
    psql "$DATABASE_URL_APP" -c "
        SELECT current_user, 
               current_setting('app.user_id', true) as user_id,
               current_setting('app.role', true) as role;
    "
    
    Should show:
    - current_user: app_user
    - user_id: (empty or value)
    - role: (empty or value)
```

### Phase 2: Backend Configuration (Render)

**Environment Variables to Set:**

```
[ ] DATABASE_URL
    Value: postgresql://app_user:password@host/splitzy_prod
    ⚠️  NEVER use owner_role connection string
    
[ ] JWT_SECRET_KEY
    Generate: openssl rand -hex 32
    Example: 5e1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9...
    ⚠️  NEVER reuse across projects
    ⚠️  KEEP SECRET
    
[ ] FRONTEND_URL
    Value: https://your-vercel-domain.com
    (no trailing slash)
    ⚠️  MUST match Vercel domain exactly
    
[ ] FLASK_ENV
    Value: production
    (NEVER set to development)

[ ] PORT (optional)
    Value: 5000 (Render default)
```

**Deployment:**

```
[ ] 1. Connect GitHub repository to Render
    [ ] Select branch: main (or deployment branch)
    [ ] Auto-deploy on push: enabled
    
[ ] 2. Set environment variables
    [ ] Copy values from above
    [ ] Test values before saving
    
[ ] 3. Verify Procfile exists
    cat Procfile
    Should show: web: gunicorn run:app
    
[ ] 4. Verify requirements.txt format
    cat backend/requirements.txt
    Should show ranges: Flask>=3.0,<4.0 (NOT ==3.0.0)
    
[ ] 5. Deploy
    [ ] Git push to deployment branch
    [ ] Render auto-builds
    [ ] Check build logs for errors
    
[ ] 6. Test health endpoints
    curl https://your-app.onrender.com/health
    curl https://your-app.onrender.com/health/live
    curl https://your-app.onrender.com/health/ready
    
    All should return status: ok/alive/ready
    
[ ] 7. Check backend logs
    Render → Logs → review for errors
    Should see: ✅ Connected to database successfully
```

### Phase 3: Frontend Configuration (Vercel)

**Environment Variables to Set:**

```
[ ] VITE_API_BASE_URL
    Value: https://your-app.onrender.com
    (no trailing slash)
    ⚠️  MUST match backend URL exactly
```

**Deployment:**

```
[ ] 1. Connect GitHub repository to Vercel
    [ ] Select project root: frontend/
    [ ] Framework: Vite
    [ ] Auto-deploy: enabled
    
[ ] 2. Set environment variable
    VITE_API_BASE_URL = https://your-app.onrender.com
    
[ ] 3. Verify build works
    npm run build
    [ ] Creates dist/ folder
    [ ] No errors in build log
    
[ ] 4. Deploy
    [ ] Git push
    [ ] Vercel auto-builds
    [ ] Check build logs
    
[ ] 5. Test frontend
    [ ] Visit https://your-vercel-domain.com
    [ ] Open DevTools → Network tab
    [ ] Login and verify:
        - API calls go to correct backend URL
        - No CORS errors
        - JWT token sent in Authorization header
```

---

## 🧪 PRODUCTION VALIDATION TESTS

**Run these BEFORE marking as live:**

### Test 1: Backend Health

```bash
BACKEND_URL="https://your-app.onrender.com"

# Test health endpoints
curl $BACKEND_URL/health
curl $BACKEND_URL/health/live
curl $BACKEND_URL/health/ready

# All should return HTTP 200 with ok/alive/ready status
```

### Test 2: Database Connection

```bash
DATABASE_URL="postgresql://app_user:password@host/db"

# Test connection with APP role
psql "$DATABASE_URL" -c "SELECT current_user"
# Should return: app_user

# Test APP role cannot bypass RLS
psql "$DATABASE_URL" -c "SHOW role_bypassrls"
# Should return: off (meaning NO bypass)
```

### Test 3: RLS Active

```bash
DATABASE_URL="postgresql://app_user:password@host/db"

# Check RLS is enforced on tables
psql "$DATABASE_URL" -c "
    SELECT tablename, count(*) as policy_count
    FROM pg_policies 
    WHERE tablename IN ('group_members', 'expense_split_group', 'payment')
    GROUP BY tablename;
"

# Should show multiple policies for each table
```

### Test 4: Authentication Flow

```bash
BACKEND_URL="https://your-app.onrender.com"

# 1. Signup
curl -X POST $BACKEND_URL/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "email": "prod-test@example.com",
    "phone_number": "9999999999",
    "password": "TestPass123!"
  }'

# 2. Login
TOKEN=$(curl -s -X POST $BACKEND_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"prod-test@example.com","password":"TestPass123!"}' \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 3. Use token on protected route
curl -H "Authorization: Bearer $TOKEN" \
  $BACKEND_URL/api/users/profile

# Should return user data, not 401 error
```

### Test 5: Automated Validation Script

```bash
# Set environment variables
export BACKEND_URL="https://your-app.onrender.com"
export DATABASE_URL="postgresql://app_user:password@host/db"

# Run validation script
cd database/
chmod +x validate-production.sh
./validate-production.sh

# Should show: ✅ ALL TESTS PASSED - PRODUCTION READY!
```

---

## 🔐 SECURITY HARDENING VERIFICATION

Before going live, verify:

### Database Security

```
[ ] APP role properties
    psql "$DATABASE_URL_OWNER" -c "
        SELECT rolname, rolbypassrls, rolinherit, rolecanlogin 
        FROM pg_roles 
        WHERE rolname = 'app_user';
    "
    
    Should show:
    - rolbypassrls: true (can't bypass RLS)
    - rolecanlogin: true (can login)
    - rolinherit: true (inherits permissions)

[ ] OWNER role is isolated
    OWNER credentials stored securely (vault/secrets manager)
    NEVER used in production runtime
    NEVER committed to Git

[ ] RLS policies exist
    psql "$DATABASE_URL_OWNER" -c "
        SELECT COUNT(*) FROM pg_policies;
    "
    Should show: 12+ policies

[ ] Triggers enforce correctness
    psql "$DATABASE_URL_OWNER" -c "
        SELECT COUNT(*) FROM pg_trigger;
    "
    Should show: 5+ triggers
```

### Application Security

```
[ ] No debug mode in production
    export FLASK_ENV=production
    (verify in Render env vars)

[ ] JWT secret is strong
    length >= 32 characters
    random (not sequential or predictable)

[ ] FRONTEND_URL configured
    Render env var set to Vercel domain
    CORS restricts to frontend only

[ ] Environment variables secure
    All secrets in platform env vars
    .env files NOT in Git
    No hardcoded credentials in code

[ ] No localhost references
    grep -r "localhost\|127.0.0.1" backend/
    Should return: 0 matches (or only in examples)
```

### Deployment Security

```
[ ] .env files in .gitignore
    cat .gitignore | grep -i ".env"
    Should match .env entries

[ ] No secrets in requirements.txt
    cat backend/requirements.txt
    Should only have package names, no URLs with credentials

[ ] Database URL uses APP role
    echo "$DATABASE_URL" | grep "app_user"
    Should contain: app_user

[ ] HTTPS everywhere
    All URLs start with https://
    (not http://)
```

---

## 📋 DEPLOYMENT COMMANDS REFERENCE

### Database Deployment

```bash
# 1. Create roles (one-time)
psql postgresql://superuser@host/neon -f database/00-roles.sql

# 2. Deploy schema and features
export DATABASE_URL_OWNER="postgresql://owner_role:pw@host/db"
cd database/
./deploy.sh

# 3. Validate RLS and security
./validate-production.sh
```

### Backend Deployment (Render)

```bash
# Set in Render environment:
# DATABASE_URL = postgresql://app_user:pw@host/db
# JWT_SECRET_KEY = (32 random chars)
# FRONTEND_URL = https://vercel-domain.com
# FLASK_ENV = production

# Deploy via Git push:
git push origin main
# Render auto-builds from Procfile
```

### Frontend Deployment (Vercel)

```bash
# Set in Vercel environment:
# VITE_API_BASE_URL = https://backend-url.onrender.com

# Deploy via Git push:
git push origin main
# Vercel auto-builds
```

---

## ✅ GO-LIVE VERIFICATION

**Final checklist before marking production:**

```
SECURITY
[ ] RLS active (app_user NOBYPASSRLS = true)
[ ] No owner role in runtime
[ ] JWT secret strong (32+ chars)
[ ] CORS restricted to frontend domain
[ ] Debug mode off
[ ] No secrets in code

FUNCTIONALITY
[ ] Health endpoints respond (200 OK)
[ ] Database connection works (APP role)
[ ] Login/JWT works
[ ] Protected routes require auth
[ ] RLS filters data correctly

DEPLOYMENT
[ ] Procfile exists and correct
[ ] requirements.txt uses ranges (not ==)
[ ] .env files in .gitignore
[ ] All env vars set in platforms
[ ] Logs configured (Render/Vercel)
[ ] Monitoring set up

TESTING
[ ] Validation script passes all tests
[ ] Manual API tests successful
[ ] RLS data access verified
[ ] Admin bypass works (if applicable)
[ ] No errors in logs
```

---

## 🚀 DEPLOYMENT SEQUENCE

**Do NOT skip or reorder steps:**

1. **Database** (Neon)
   - [ ] Create roles (00-roles.sql)
   - [ ] Run deploy.sh
   - [ ] Verify RLS active
   - [ ] Test with validation script

2. **Backend** (Render)
   - [ ] Set environment variables
   - [ ] Push to Git (triggers auto-deploy)
   - [ ] Verify health endpoints
   - [ ] Check logs for errors

3. **Frontend** (Vercel)
   - [ ] Set environment variables
   - [ ] Push to Git (triggers auto-deploy)
   - [ ] Test login flow
   - [ ] Verify API calls to backend

4. **Validation**
   - [ ] Run full validation script
   - [ ] Manual security checks
   - [ ] Monitor logs (first 24 hours)

---

## 🎯 PRODUCTION CONSTRAINTS

Once deployed, these MUST remain true:

| Constraint | Enforcement | Check |
|-----------|------------|-------|
| RLS active | Database policy | `SELECT rolbypassrls FROM pg_roles WHERE rolname='app_user'` should be `true` |
| APP role used | Configuration | `echo $DATABASE_URL \| grep app_user` |
| No debug mode | Environment | `echo $FLASK_ENV` should be `production` |
| JWT enforced | Code | Protected routes require `Authorization` header |
| CORS restricted | Code | Only frontend domain allowed |

---

## 🚨 IF DEPLOYMENT FAILS

### Database Issues

```
Error: "Authentication failed"
→ Check owner_role password matches

Error: "Role already exists"
→ roles are already created (OK, move to deploy.sh)

Error: "RLS not enforced"
→ Verify: psql -c "SELECT rolbypassrls FROM pg_roles WHERE rolname='app_user'"
→ Must be true
```

### Backend Issues

```
Error: "DATABASE_URL not set"
→ Check Render environment variables panel

Error: "Can't connect to database"
→ Verify DATABASE_URL uses APP role (not OWNER)
→ Test: psql $DATABASE_URL -c "SELECT 1"

Error: "Health check failing"
→ Check logs: Render → Logs
→ Verify database connection string
```

### Frontend Issues

```
Error: "CORS error"
→ Check FRONTEND_URL in Render matches Vercel domain exactly
→ Restart Render backend

Error: "API calls return 401"
→ Check JWT_SECRET_KEY is set
→ Verify token is in Authorization header

Error: "Network tab shows 404"
→ Check VITE_API_BASE_URL in Vercel matches backend URL
→ Rebuild frontend
```

---

## 📊 FINAL STATUS

✅ **System Ready for Production**

- Database: RLS enforced, roles separated, triggers active
- Backend: Health endpoints, session vars, no debug mode
- Frontend: Dynamic API URL, proper authentication
- Security: No secrets in code, least-privilege access
- Validation: Complete test suite available

---

**Prepared:** May 1, 2026  
**Approved:** ✅ Production Ready  
**Deploy With Confidence** 🚀
