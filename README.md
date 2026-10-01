# Chokepoint

> **Find the chokepoints in your digital life.**

Chokepoint is a **local-first privacy auditor**. The user lists their accounts and *how each one can be logged into or recovered*. We derive a **takeover graph** (entry points → gates → accounts), run a **correlated attack simulation** over it, and rank the **smallest set of fixes** that removes the most expected loss. Every edit and every fix can be **previewed before it is saved**.

It answers three questions no password checker answers:
1. *What single thing, if lost, takes down the most of my life?*
2. *How would an attacker most easily reach my most valuable account?*
3. *Which 3 fixes should I do first?*

---

## Architecture Sketch

```
  User Accounts & Recovery Methods (State)
                    │
                    ▼
 ┌──────────────────────────────────────────────────┐
 │  Engine 1: Gate Builder (backend/app/engines/)   │
 │  - Derives AND/OR logic gates                    │
 │  - Maps credentials, recovery & SSO cascades     │
 └──────────────────┬───────────────────────────────┘
                    │ Takeover Graph (Graph)
                    ▼
 ┌──────────────────────────────────────────────────┐
 │  Engine 2: Simulator                             │
 │  - Deterministic Closure (cascade rounds)        │
 │  - Correlated Monte Carlo (CRN vectorized sweep) │
 │  - SPOF Finder & Backward Path Explorer          │
 └──────────────────┬───────────────────────────────┘
                    │ Analysis Metrics
                    ▼
 ┌──────────────────────────────────────────────────┐
 │  FastAPI Orchestrator (backend/app/service.py)   │
 │  - /api/analysis, /api/preview, /api/scenario    │
 │  - SQLite KV Store + Snapshots + Event Audit     │
 └──────────────────┬───────────────────────────────┘
                    │ JSON APIs
                    ▼
 ┌──────────────────────────────────────────────────┐
 │  Frontend (React + Vite + Tailwind + TS)         │
 │  - Accounts Page & Threat Inventory              │
 │  - Live Ghost Preview Panel (400ms debounce)     │
 │  - Multi-Filter & "Falls if Compromised" cascade │
 └──────────────────────────────────────────────────┘
```

---

## Quickstart & Running Locally

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 2. Run Both Servers with One Command
```bash
./run.sh
```
Or:
```bash
make dev
```
- **Backend API**: `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`)
- **Frontend App**: `http://localhost:5173`

### 3. Manual Steps (Optional)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Loading the Demo Persona

1. Open `http://localhost:5173/accounts`.
2. Click the **"Load Demo Persona"** button in the header.
3. This seeds the 12 realistic demo accounts (Gmail, Amazon, UPI, Netflix, Canva, etc.) with calibrated breach flags, SIM anchors, and shared password groups.
4. Watch the accounts table, risk bands, and threat metrics populate immediately!

---

## Testing

Run the comprehensive pytest suite covering CRUD, schema validations, Engine 1 Gate Builder rules, Cytoscape view exports, and simulation cascades:
```bash
make test
```
Or directly:
```bash
cd backend && python3 -m pytest
cd frontend && npm run build
```

---

## Privacy Statement

- **100% Local-First**: All evaluations, graphs, and simulation trials run entirely on your localhost.
- **Zero Real Passwords**: Only password-group *labels* exist (e.g., `Group A` or `SocialPass`). You never store, type, or transmit real passwords.
- **No Network / Telemetry Calls**: Chokepoint does not communicate with any external servers, analytics, or LLM APIs.
- **Illustrative Breach Counts**: Service catalog breach numbers are illustrative demo data.

---

## Model Assumptions & Caveats

All calculated probabilities and expected losses are **model-based estimates** derived under a 5-year threat horizon (SIM swap risk, physical theft rates, and credential breach probabilities), not measured historical facts. They are designed to illuminate interconnected security dependencies rather than absolute actuarial guarantees.

---

## Team & Roles

| Track | Focus |
|---|---|
| **M1** | Backend foundation, Engine 1 (Gate Builder), Accounts page, ghost-preview panel |
| **M2** | Engine 2 (Simulator, SPOFs, paths, explanations), analysis panels, baseline compare |
| **M3** | Engine 3 (Fix Planner), Engine 4 (Scenario & Review), catalog + persona data, Fixes page |
| **M4** | Frontend shell, graph, dashboard, scenarios, alerts, polish |
