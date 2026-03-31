#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  Splitzy – single runner script
#  Usage: bash start.sh
# ─────────────────────────────────────────────
set -e

# Resolve the project root (directory where this script lives)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ── Colours ──────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

echo -e "${GREEN}╔══════════════════════════════╗${NC}"
echo -e "${GREEN}║   Splitzy – dev environment  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════╝${NC}"
echo ""

# ── Python virtual environment ────────────────
VENV_ACTIVATE=""
if [ -f "$BACKEND_DIR/.venv/bin/activate" ]; then
    VENV_ACTIVATE="$BACKEND_DIR/.venv/bin/activate"
elif [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
    VENV_ACTIVATE="$BACKEND_DIR/venv/bin/activate"
else
    echo -e "${RED}ERROR: No virtual environment found in backend/.venv or backend/venv${NC}"
    echo "  Create one with:  python3 -m venv $BACKEND_DIR/.venv"
    echo "  Then install:     $BACKEND_DIR/.venv/bin/pip install -r $BACKEND_DIR/requirements.txt"
    exit 1
fi

echo -e "${YELLOW}▶ Activating Python venv...${NC}"
source "$VENV_ACTIVATE"

# ── Start Flask backend ───────────────────────
echo -e "${YELLOW}▶ Starting Flask backend on http://127.0.0.1:5001 ...${NC}"
(cd "$BACKEND_DIR" && python run.py) &
BACKEND_PID=$!

# Give Flask a moment to boot and print the DB-connection message
sleep 2

# ── Start Vite frontend ───────────────────────
echo -e "${YELLOW}▶ Starting Vite frontend ...${NC}"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}Both servers are running.${NC}"
echo -e "  Backend : http://127.0.0.1:5001"
echo -e "  Frontend: http://localhost:5173"
echo ""
echo -e "Press ${RED}CTRL+C${NC} to stop both servers."

# ── Clean shutdown on CTRL+C ──────────────────
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill "$BACKEND_PID"  2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID"  2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
    echo -e "${GREEN}All servers stopped. Goodbye!${NC}"
}

trap cleanup INT TERM

# Keep the script alive until both children exit
wait "$BACKEND_PID" "$FRONTEND_PID"
