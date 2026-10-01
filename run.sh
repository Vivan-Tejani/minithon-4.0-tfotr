#!/usr/bin/env bash
set -e

echo "Starting Chokepoint Backend..."

# Trap to kill background processes on exit
cleanup() {
    echo "Stopping servers..."
    kill 0
}
trap cleanup EXIT

# 1. Start FastAPI backend on port 8000
echo "Launching FastAPI backend on http://localhost:8000..."
(cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &

# 2. Start Vite frontend on port 5173 if present
if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    echo "Launching Vite frontend on http://localhost:5173..."
    (cd frontend && npm run dev -- --host) &
fi

# Wait for background processes
wait
