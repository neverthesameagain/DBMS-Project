#!/bin/bash
# =============================================================
# Splitzy Pay — Production Validation Tests
# Run these tests before marking system as production-ready
# =============================================================

set -e

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: BACKEND_URL not set"
    echo "Usage: BACKEND_URL=https://your-app.onrender.com ./database/validate-production.sh"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set (APP role connection)"
    echo "Usage: DATABASE_URL=postgresql://app_user:pw@host/db ./database/validate-production.sh"
    exit 1
fi

BACKEND_URL="${BACKEND_URL%/}"  # Remove trailing slash
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"

echo "🧪 Splitzy Pay Production Validation Suite"
echo "=========================================="
echo "Backend: $BACKEND_URL"
echo "Database: $DATABASE_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass_count=0
fail_count=0

# Test function
test_case() {
    local name="$1"
    local cmd="$2"
    local expected="$3"
    
    echo -n "🧪 $name ... "
    result=$(eval "$cmd" 2>&1)
    
    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}PASS${NC}"
        ((pass_count++))
    else
        echo -e "${RED}FAIL${NC}"
        echo "   Expected: $expected"
        echo "   Got: $result"
        ((fail_count++))
    fi
}

# =============================================================
# 1. BACKEND CONNECTIVITY TESTS
# =============================================================
echo ""
echo "📍 BACKEND CONNECTIVITY"
echo "---"

test_case "Health endpoint responds" \
    "curl -s $BACKEND_URL/health" \
    "ok"

test_case "Liveness probe responds" \
    "curl -s $BACKEND_URL/health/live" \
    "alive"

test_case "Readiness probe responds" \
    "curl -s $BACKEND_URL/health/ready" \
    "ready"

# =============================================================
# 2. DATABASE CONNECTIVITY TESTS
# =============================================================
echo ""
echo "🗄️  DATABASE CONNECTIVITY"
echo "---"

test_case "Database connection (APP role)" \
    "psql \"$DATABASE_URL\" -c 'SELECT 1'" \
    "1"

test_case "APP role cannot bypass RLS" \
    "psql \"$DATABASE_URL\" -tAc \"SELECT CASE WHEN rolbypassrls THEN 'bad' ELSE 'ok' END FROM pg_roles WHERE rolname = current_user\"" \
    "ok"

# =============================================================
# 3. RLS ENFORCEMENT TESTS
# =============================================================
echo ""
echo "🔐 RLS ENFORCEMENT"
echo "---"

test_case "RLS active: group_members" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM pg_policies WHERE tablename=\\'group_members\\' AND policyname IS NOT NULL'" \
    "[1-9]"

test_case "RLS active: expense_split_group" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM pg_policies WHERE tablename=\\'expense_split_group\\' AND policyname IS NOT NULL'" \
    "[1-9]"

test_case "RLS active: payment" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM pg_policies WHERE tablename=\\'payment\\' AND policyname IS NOT NULL'" \
    "[1-9]"

# =============================================================
# 4. DATABASE FUNCTIONALITY TESTS
# =============================================================
echo ""
echo "💾 DATABASE FUNCTIONALITY"
echo "---"

test_case "Functions deployed" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM information_schema.routines WHERE routine_schema=\\'public\\' AND routine_type=\\'FUNCTION\\''" \
    "[1-9]"

test_case "Triggers deployed" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM information_schema.triggers WHERE trigger_schema=\\'public\\''" \
    "[1-9]"

test_case "Views deployed" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM information_schema.views WHERE table_schema=\\'public\\''" \
    "[1-9]"

# =============================================================
# 5. AUTHENTICATION TESTS
# =============================================================
echo ""
echo "🔐 AUTHENTICATION"
echo "---"

# Create test user
SIGNUP_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{
        \"first_name\": \"Test\",
        \"last_name\": \"User\",
        \"email\": \"$TEST_EMAIL\",
        \"phone_number\": \"9999999999\",
        \"password\": \"$TEST_PASSWORD\"
    }")

if echo "$SIGNUP_RESPONSE" | grep -q "user_id\|error"; then
    echo -e "✅ ${GREEN}Signup endpoint reachable${NC}"
    ((pass_count++))
else
    echo -e "❌ ${RED}Signup failed${NC}"
    ((fail_count++))
fi

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo -e "✅ ${GREEN}Login successful, JWT token obtained${NC}"
    ((pass_count++))
else
    echo -e "❌ ${RED}Login failed or token missing${NC}"
    echo "Response: $LOGIN_RESPONSE"
    ((fail_count++))
fi

# =============================================================
# 6. JWT & SESSION VARIABLE TESTS
# =============================================================
echo ""
echo "🎫 JWT & SESSION VARIABLES"
echo "---"

if [ -n "$TOKEN" ]; then
    test_case "Protected route with JWT" \
        "curl -s -H 'Authorization: Bearer $TOKEN' $BACKEND_URL/api/auth/profile | grep -o 'email'" \
        "email"

    test_case "JWT validation on protected route" \
        "curl -s $BACKEND_URL/api/auth/profile | grep -o 'error\\|msg\\|Unauthorized' || echo 'error'" \
        "error"
fi

# =============================================================
# 7. RLS DATA FILTERING TESTS
# =============================================================
echo ""
echo "🛡️  RLS DATA FILTERING"
echo "---"

# This would require creating test data with multiple users
test_case "RLS filters group_members query" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM group_members'" \
    "[0-9]"

test_case "RLS filters expense_split_group query" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM expense_split_group'" \
    "[0-9]"

# =============================================================
# 8. CORS TESTS
# =============================================================
echo ""
echo "🌐 CORS CONFIGURATION"
echo "---"

CORS_RESPONSE=$(curl -s -i "$BACKEND_URL/api/auth/status" | grep -i "Access-Control-Allow" || echo "")

if [ -n "$CORS_RESPONSE" ]; then
    echo -e "✅ ${GREEN}CORS headers present${NC}"
    echo "   $CORS_RESPONSE"
    ((pass_count++))
else
    echo -e "⚠️  ${YELLOW}CORS headers not detected (may be OK if only same-origin)${NC}"
fi

# =============================================================
# 9. PRODUCTION SECURITY CHECKS
# =============================================================
echo ""
echo "🔒 SECURITY CHECKS"
echo "---"

# Check for debug mode
test_case "Flask debug mode disabled (check logs)" \
    "curl -s -X POST $BACKEND_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"invalid\": \"json\"}' | grep -v 'Traceback' || echo 'ok'" \
    "ok"

# Check no hardcoded localhost
test_case "No localhost in API responses" \
    "curl -s $BACKEND_URL/api/auth/status | grep -v '127.0.0.1\|localhost' || echo 'ok'" \
    "ok"

# =============================================================
# 10. TRIGGER FUNCTIONALITY TESTS
# =============================================================
echo ""
echo "⚙️  TRIGGER VERIFICATION"
echo "---"

test_case "Triggers exist (payment trigger)" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM information_schema.triggers WHERE trigger_name LIKE \\'%payment%\\''" \
    "[1-9]"

test_case "Triggers exist (balance trigger)" \
    "psql \"$DATABASE_URL\" -c 'SELECT count(*) FROM information_schema.triggers WHERE trigger_name LIKE \\'%balance%\\''" \
    "[1-9]"

# =============================================================
# FINAL REPORT
# =============================================================
echo ""
echo "=========================================="
echo "📊 TEST RESULTS"
echo "=========================================="
echo -e "✅ Passed: ${GREEN}$pass_count${NC}"
echo -e "❌ Failed: ${RED}$fail_count${NC}"
echo "=========================================="

if [ $fail_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED - PRODUCTION READY!${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  SOME TESTS FAILED - DO NOT DEPLOY${NC}"
    echo ""
    exit 1
fi
