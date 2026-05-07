#!/bin/bash
# =============================================================
# Splitzy Pay — Database deployment
#
# Usage (deploy as Neon owner — BYPASSRLS is OK here only):
#   export DATABASE_URL='postgresql://neondb_owner:...'
#   cd database && ./deploy.sh
#
# Backend runtime MUST use splitzy_app (NOBYPASSRLS); see database/README.md.
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "⚠️ DATABASE_URL is not set in environment."
    ENV_FILE="$SCRIPT_DIR/../backend/.env"
    if [ -f "$ENV_FILE" ]; then
        echo "🔍 Found backend/.env, extracting DATABASE_URL..."
        # Extract DATABASE_URL, ignoring comments and stripping quotes
        export DATABASE_URL=$(grep -v '^#' "$ENV_FILE" | grep 'DATABASE_URL=' | sed 's/^DATABASE_URL=//' | tr -d '"'\''')
    fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "❌ Error: DATABASE_URL is not set and could not be found in backend/.env"
    echo "   export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'"
    exit 1
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1)

echo "🔄 Starting database deployment..."
echo "📍 Using DATABASE_URL (hostname hidden — check Neon dashboard if unsure)"

run_sql_file() {
    local label="$1"
    local file="$2"
    echo "📋 $label"
    "${PSQL[@]}" -f "$file"
    echo "✅ $label — OK"
}

run_sql_file "[1/7] schema.sql" "$SCRIPT_DIR/schema.sql"
run_sql_file "[2/7] functions.sql" "$SCRIPT_DIR/functions.sql"
run_sql_file "[3/7] triggers.sql" "$SCRIPT_DIR/triggers.sql"
run_sql_file "[4/7] views.sql" "$SCRIPT_DIR/views.sql"
run_sql_file "[5/7] rls.sql" "$SCRIPT_DIR/rls.sql"
run_sql_file "[6/7] roles.sql" "$SCRIPT_DIR/roles.sql"

if [ -f "$SCRIPT_DIR/seed.sql" ]; then
    run_sql_file "[7/7] seed.sql" "$SCRIPT_DIR/seed.sql"
else
    echo "📋 [7/7] seed.sql not found — skipping"
fi

echo ""
echo "🔍 Verifying deployment (counts)..."
"${PSQL[@]}" -c "
    SELECT 'tables' AS kind, count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'
    UNION ALL
    SELECT 'functions', count(*)::text FROM information_schema.routines WHERE routine_schema = 'public'
    UNION ALL
    SELECT 'views', count(*)::text FROM information_schema.views WHERE table_schema = 'public';
"

echo ""
echo "🔐 Post-deploy checks (session role + RLS)..."
"${PSQL[@]}" -c "
SELECT current_user AS connected_as, rolbypassrls AS must_be_false
FROM pg_roles
WHERE rolname = current_user;
"

"${PSQL[@]}" -c "
SELECT relname, relrowsecurity AS rls_on, relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN ('payment', 'expense_split_group', 'group_members')
ORDER BY relname;
"

ROLBYPASS="$("${PSQL[@]}" -tAc "SELECT rolbypassrls::text FROM pg_roles WHERE rolname = current_user" | tr -d '[:space:]')"
echo ""
if [ "$ROLBYPASS" = "t" ]; then
    echo "Deployment OK. This role must NOT be used for backend runtime."
elif [ "$ROLBYPASS" = "f" ]; then
    echo "Safe for runtime (RLS enforced)."
else
    echo "Could not read rolbypassrls for current_user (unexpected)."
fi

echo ""
echo "✅ deploy.sh finished successfully."
