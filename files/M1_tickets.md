# M1 — Backend Foundation · Engine 1 (Gate Builder) · Accounts Page

**You own:** `backend/app/{main.py, schemas.py, store.py, service.py}`, `backend/app/engines/gate_builder.py`, `frontend/src/pages/Accounts.tsx`, `frontend/src/components/{AccountForm, PreviewCard, FiltersBar}.tsx`.
**You provide to others:** pydantic models and `State` (M3), `build_graph` (M2/M3), `/api/analysis` (M4), `PreviewCard` component (M3, M4).
**You need from others:** `graph_types.py` (M2-00), `catalog.json` (M3-00), `analyze_core` (M2-05), `/api/preview` and `/api/scenario` (M3).

## Agent prompt (paste with PRD.md)
> You are M1 on Chokepoint. You own the FastAPI foundation, the SQLite store, Engine 1 (`build_graph`) and the Accounts page. Follow PRD §5, §6 (Engine 1) and §7 exactly. Edit only files you own. No network or LLM calls. Add pytest tests for every function. Do not add networkx; it is not needed.

---

## Phase 0 — Contracts (T+0:00 → 0:35)

### M1-00 · Backend scaffold — P0 · 15m
**Depends on:** – · **Blocks:** M1-01, M2-01 (pytest harness), every backend ticket
**Do:**
- Create monorepo `chokepoint/{backend,frontend}`; push to GitHub; invite the team.
- `backend/`: FastAPI app `app.main:app`, router prefix `/api`, `GET /api/health`, CORS allow `http://localhost:5173` only.
- `requirements.txt`: fastapi, uvicorn, pydantic, numpy, pytest, httpx.
- `pytest.ini`, `tests/` folder with a smoke test, `.gitignore` (`.data/`, `node_modules`, `.venv`).
- README stub with run commands (`uvicorn app.main:app --reload`, `pytest`).
**Done when:** `uvicorn` boots; `curl localhost:8000/api/health` returns `{"ok":true}`; `pytest` passes; all four teammates have cloned and run it. **Announce in group chat.**

### M1-01 · Schemas, validation, store, CRUD — P0 · 20m
**Depends on:** M1-00 · **Blocks:** M1-02, M3-01, M3-02, M3-03
**Do:**
- `schemas.py`: pydantic models `Anchors`, `Account`, `Settings` (defaults from PRD §5.5), `State {anchors, accounts, settings, last_review_at, now}`, `CatalogEntry`, enums from §5.1. Exact field names from PRD §5.
- Validation (422 with a clear message): duplicate ids; `recovery`/`sso:`/`email_inbox:` pointing to unknown ids; `email:<id>` target not `type=email`; self-reference; `importance_override` outside 1–10.
- `store.py`: SQLite at `backend/.data/chokepoint.db`. Tables: `kv(key TEXT PRIMARY KEY, json TEXT)`, `snapshots(id, ts, score, el, label)`, `events(id, ts, kind, title, detail_json)`. Functions: `load_state()`, `save_state(state)`, `add_snapshot(score, el, label)`, `add_event(kind, title, detail)`, `reset()`.
- Routes: `GET /state`, `PUT /anchors`, `POST/PUT/DELETE /accounts`, `GET /catalog` (reads `data/catalog.json`; returns `[]` until M3-00 lands), `GET/PUT /settings`.
- `slugify(name)` for ids; `DELETE /accounts/{id}` must strip dangling references or return 409 listing dependents (choose 409 with the dependents list).
- `store.record(label)` hook that stores a snapshot with `score=None` for now; M1-05 fills it with real values.
**Done when:** CRUD round-trips in tests; each validation rule has a failing-input test; `GET /state` returns the empty default state. **Announce to M3 and M4.**

---

## Phase 1 — Engines (T+0:35 → 1:45)

### M1-02 · Engine 1: Gate Builder — P0 · 40m
**Depends on:** M1-01, M2-00 (graph types), M3-00 (catalog; use an inline 3-service test catalog until it lands) · **Blocks:** M1-03, M1-05, M3-04, M3-05
**Do:** Implement `build_graph(state, catalog, settings) -> Graph` exactly per PRD §6 Engine 1 (entries, capabilities, account methods 1–6). Node ids per §5.8. Method ids as `"{acct}#{kind}:{detail}"`. `order` = entries, caps, accounts, each sorted by id. Fill `fix_hints` and entry `fix_hint` as specified. Impact per §5.6 stored in `meta["impact"]`.
**Tests (≥10):**
- sim lock multiplies `E_SIM.p` by `sim_lock_mult`
- `breach_flag` raises `E_LEAK` p to ≥ `leak_flagged_min`; `leak_cap` respected
- device lock on → `CAP_DEVICE` and the `E_PHONE` method of `CAP_SMS` absent
- `hardware_key` → no `E_PHISH` node for that email account; password method requires `CAP_KEY`
- `recovery_bypasses_2fa=false` → recovery method includes the factor caps
- shared group → `CAP_PW:a` has one method per group member
- permission `email_inbox:gmail` on app X → `CAP_INBOX:gmail` has method `[ACC:X]`
- permission `sms` on app X → `CAP_SMS` has method `[ACC:X]`
- `sso:gmail` → method requires `ACC:gmail`
- impact: override wins; otherwise max of data and permission weights
**Done when:** all tests pass; persona (when M3-01 lands) builds in < 20 ms. Tell M2 and M3 as soon as `build_graph` is on `main`, even if M1-03 is not done.

### M1-03 · Graph view export — P0 · 15m
**Depends on:** M1-02 · **Blocks:** M1-05, M4-02 (real data)
**Do:** `to_view(graph, p_by_account, ghost_ids=frozenset()) -> {nodes, edges}` per PRD §6. Show `E_SIM`, `E_PHONE`, one `GROUP:<label>` node per password group with ≥ 2 members, and all accounts. Layers: 0 entries/groups, 1 hubs (accounts that appear in another account's requirements, directly or via a cap), 2 the rest. Edge `X→A` when X supplies a requirement of one of A's methods (collapse caps; an account feeding `CAP_SMS` or `CAP_INBOX:e` links to every account depending on that cap). Edge `label` = method label. Node fields `{id,label,kind,layer,p,band,impact,ghost}`.
**Done when:** tests on the 5-node fixture and the persona (group node exists for A and B; E_SIM has edges to gmail, amazon, upi, zomato; gmail has edges to the six accounts that use it).

---

## Phase 2 — Integrate (T+1:45 → 2:45)

### M1-05 · Orchestrator, `/analysis`, snapshot hooks — P0 · 20m  ⭐ critical path
**Depends on:** M1-02, M1-03, M2-05 (`analyze_core`) · **Blocks:** M2-07, M2-08, M3-06, M3-07, real-data UI
**Do:**
- `service.py`: `analyze(state) -> dict` = `build_graph` → `simulator.analyze_core(graph, state, catalog, settings)` → add `graph: to_view(...)`. Cache with M2-06's helper when available (key = hash of state+settings).
- `GET /analysis` returns the PRD §7 shape. `GET /state` unchanged.
- Fill `store.record(label)` so every mutating route (`PUT /anchors`, accounts CRUD, `POST /seed/demo`) stores a snapshot with real `score` and `el` and adds an `account_changed` event.
- `POST /seed/demo` route: calls M3's `load_persona()` (stub until M3-01), resets history, records first snapshot "Demo persona loaded".
- Save one real response as `backend/tests/fixtures/analysis_persona.json` and send it to M4 to replace the mock.
**Done when:** `curl /api/analysis` after seeding returns score, 12 accounts with `why`, spofs, graph; snapshots endpoint shows ≥ 1 point. **Announce to M4 and M2.**
**Plan B if blocked on M2-05:** return `analyze_core` stubbed from M2-02 metrics only (score, accounts p/band, graph) and fill the rest later.

### M1-06 · Accounts page, search & filters — P0 · 40m
**Depends on:** M4-00, M4-03, M1-01, M3-00 · **Blocks:** M1-07
**Do (`pages/Accounts.tsx`, `AccountForm.tsx`, `FiltersBar.tsx`):**
- Table: name, type, 2FA, group chip, risk band chip (tooltip shows exact %, "model-based estimate"), data chips, last activity. Row click opens the shared Account Detail drawer (M2-07); "Edit" opens the form.
- Anchors card: SIM lock and device lock switches → `PUT /anchors`.
- Form: service select (catalog prefill sets type, login options, second-factor options limited to `second_factors_supported`, permissions, data held); login methods; second factor; recovery (SMS toggle + email-account picker limited to email-type accounts); password group (text input with datalist of existing labels; helper text: "Label only — never type a real password"); permissions chips; data held chips; last activity date; breach flag; optional importance override.
- Search + filters (client-side, using `/analysis` bands): text; risk band; service type; data held; 2FA method; last activity buckets (<90d, 90–365d, >365d). Path filter dropdown "Falls if … is compromised": options = SIM swap, lost phone, each email-type account, each password group → calls `POST /scenario` and highlights matching rows with a count (soft dependency on M3-05; hide the control until the endpoint answers).
- Delete with confirmation; show the 409 dependents list if blocked.
**Done when:** add, edit, delete work against the real API; filters combine (AND) correctly; form blocks invalid refs with the server message; persona renders 12 rows.

---

## Phase 3 — Harden (T+2:45 → 3:20)

### M1-07 · Ghost-preview panel — P0 · 15m
**Depends on:** M3-06 (`/preview`), M1-06, M4-06 (ghost rendering) · **Blocks:** –
**Do:** `PreviewCard.tsx` (props: `request: PreviewRequest`). Debounced (400 ms) `POST /preview`. Shows "Score 41 → 37 (−4)", ΔEL, the top new path in plain English, and a "no change" state. On result, calls the graph's `setGhost(preview.ghost)`; clears on unmount. Mount in `AccountForm` (op `upsert_account`) and export it for M3-08 (op `apply_fix`).
**Done when:** editing an account's 2FA from SMS to none shows a worse score and a new path before saving; cancelling the form removes the ghost nodes.

### M1-08 · Import/export + threat-table editor — **P1** · 20m
**Depends on:** M1-01 · **Do:** `GET /export` (state JSON), `POST /import` (validates through `State`), buttons on Accounts page; Settings drawer editing the §5.5 table with 0–1 range validation and "Reset to defaults". **Done when:** export → reset → import restores the same score; changing `p_sim` changes the headline.

---

## Phase 4 — Ship (T+3:20 → 4:00)

### M1-09 · README + run script — P0 · 10m
README: what it is (one paragraph from PRD §1), architecture sketch, run steps (backend, frontend), "Load demo persona", privacy statement (local-first, no real passwords, no network calls), model assumptions and the "model-based estimate" caveat, team and roles. Add `make dev` (or a one-line script) that starts both servers.

---

## Plan B if blocked
- Waiting on M2-00/M2-05: code Engine 1 against your own tiny local dataclasses with identical shape, then swap the import.
- Waiting on M3-00: use a 3-service inline test catalog.
- Waiting on M1-05 (you are the blocker for others): ship the `/analysis` stub first (score + accounts + graph only), then enrich.

## Stealable by others if you are ahead
M4-05 (Alerts panel) is the one to take; ask M4.
