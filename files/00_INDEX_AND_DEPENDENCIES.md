# Chokepoint — Ticket Index, Phases & Dependency Map

Companion to `PRD.md`. Per-member files: `M1_tickets.md` · `M2_tickets.md` · `M3_tickets.md` · `M4_tickets.md`.
Estimates assume each member works with an AI coding agent (agent writes, human reviews/merges). `P0` = must ship, `P1` = only if G2 is green.

## Tracks

| Track | Focus | Engines / pages owned |
|---|---|---|
| **M1** | Backend foundation, Engine 1 (Gate Builder), Accounts page, ghost-preview panel | E1 · `/accounts` |
| **M2** | Engine 2 (Simulator, SPOFs, paths, explanations), analysis panels, baseline compare | E2 · Account Detail, SPOF panel |
| **M3** | Engine 3 (Fix Planner), Engine 4 (Scenario & Review), catalog + persona data, Fixes page | E3 · E4 · `/fixes` |
| **M4** | Frontend shell, graph, dashboard, scenarios, alerts, polish, demo prep | `/`, `/scenarios`, Graph, Alerts |

If you are 5 people: give the fifth person M4-04 (Scenarios page) and M4-05 (Alerts panel) from day one.

## Phase timeline (T = hackathon start)

| Phase | Window | Goal | Gate at end |
|---|---|---|---|
| **0 Contracts** | T+0:00 – 0:35 | Boot, schemas, graph types, catalog, mocks | **G0** |
| **1 Engines** | T+0:35 – 1:45 | Engines 1, 2 tested; fix library + review rules; graph + dashboard on mocks | **G1** |
| **2 Integrate** | T+1:45 – 2:45 | Real API everywhere; planner, scenarios, preview, apply | **G2** |
| **3 Harden** | T+2:45 – 3:20 | Ghost preview UI, P1 items, bug bash, polish | **G3 freeze** |
| **4 Ship** | T+3:20 – 4:00 | README, demo rehearsal, fallback recording, submit (20 min buffer) | Submit |

### Gate checklists
- **G0 (T+0:35):** `uvicorn` boots and `/api/health` responds · `schemas.py`, `graph_types.py`, `catalog.json` on `main` · frontend runs with `VITE_USE_MOCK=true` on all 4 routes · everyone can run `pytest`.
- **G1 (T+1:45):** `build_graph(persona)` works · `closure_det`, `closure_mc`, SPOFs, paths pass tests · persona golden cascades match PRD §9 · fix library + review rules unit-tested · `/api/analysis` returns real data (M1-05 may land a little after; do not block M3/M4 on it).
- **G2 (T+2:45):** PRD §9 end-to-end acceptance walk-through passes on the real API (ghost preview may still be in progress).
- **G3 (T+3:20):** feature freeze. Only bug fixes, copy, polish, README.

## All tickets at a glance

| ID | Title | Phase | Pri | Est | Depends on | Blocks |
|---|---|---|---|---|---|---|
| M1-00 | Backend scaffold | 0 | P0 | 15m | – | M1-01, M2-01, M3-* |
| M1-01 | Schemas, store, CRUD | 0 | P0 | 20m | M1-00 | M1-02, M3-01, M3-02, M3-03 |
| M1-02 | Engine 1 — Gate Builder | 1 | P0 | 40m | M1-01, M2-00, M3-00 | M1-03, M1-05, M3-04, M3-05 |
| M1-03 | Graph view export | 1 | P0 | 15m | M1-02 | M1-05, M4-02 (real data) |
| M1-05 | Orchestrator, `/analysis`, snapshot hooks | 2 | P0 | 20m | M1-02, M1-03, M2-05 | M2-07, M2-08, M3-06, M3-07, M4-01 (real), all UI integration |
| M1-06 | Accounts page + filters | 2 | P0 | 40m | M4-00, M4-03, M1-01, M3-00 | M1-07 |
| M1-07 | Ghost-preview panel | 3 | P0 | 15m | M3-06, M1-06, M4-06 | – |
| M1-08 | Import/export + threat editor | 3 | P1 | 20m | M1-01 | – |
| M1-09 | README + run script | 4 | P0 | 10m | G3 | – |
| M2-00 | Graph types + golden fixture | 0 | P0 | 10m | – | M1-02, M2-01 |
| M2-01 | Deterministic closure | 1 | P0 | 25m | M2-00, M1-00 | M2-02, M2-04, M3-05 |
| M2-02 | Monte Carlo + metrics | 1 | P0 | 30m | M2-01 | M2-03, M3-04, M3-05, M1-05 |
| M2-03 | SPOF finder | 1 | P0 | 15m | M2-02 | M2-05, M2-08 |
| M2-04 | Path explorer | 1 | P0 | 35m | M2-00, M2-01 | M2-05, M2-07 |
| M2-05 | Explanations + `analyze_core` | 1 | P0 | 20m | M2-03, M2-04 | M1-05 |
| M2-06 | Perf, cache, property tests | 2 | P0 | 15m | M2-05 | – |
| M2-07 | Account Detail drawer | 2 | P0 | 30m | M4-03, M2-04, M2-05, M1-05 | – |
| M2-08 | SPOF panel + crown-jewel path | 2 | P0 | 15m | M2-03, M4-01, M1-05 | – |
| M2-09 | Baseline compare | 3 | P1 | 30m | M3-04, M3-02 | – |
| M3-00 | Service catalog | 0 | P0 | 20m | – | M1-02, M1-06, M3-01, M3-02 |
| M3-01 | Demo persona + golden test | 1 | P0 | 15m | M3-00, M1-01 | all demos |
| M3-02 | Fix library | 1 | P0 | 30m | M1-01, M3-00 | M3-03, M3-04, M3-06, M3-07 |
| M3-03 | Review engine + events | 1 | P0 | 25m | M1-01, M3-02 | M4-05 |
| M3-04 | Planner (`/fixes`) | 2 | P0 | 35m | M2-02, M3-02, M1-02 | M3-05, M3-08, M2-09 |
| M3-05 | Scenario engine | 2 | P0 | 30m | M2-01, M2-02, M3-04, M1-02 | M4-04, M1-06 (path filter) |
| M3-06 | Preview endpoint | 2 | P0 | 15m | M3-02, M1-05 | M1-07, M4-06 |
| M3-07 | Apply fix + snapshots | 2 | P0 | 15m | M3-02, M1-05 | M3-08, M4-01 (trend) |
| M3-08 | Fixes page | 2 | P0 | 30m | M3-04, M3-07, M4-03 | – |
| M4-00 | Frontend scaffold, types, mocks | 0 | P0 | 25m | – | every UI ticket |
| M4-01 | Dashboard | 1 | P0 | 35m | M4-00 | M2-08 |
| M4-02 | Graph component | 1 | P0 | 45m | M4-00 | M4-04, M4-06 |
| M4-03 | Data layer | 1 | P0 | 20m | M4-00 | M1-06, M2-07, M3-08, M4-04, M4-05 |
| M4-04 | Scenarios page | 2 | P0 | 35m | M3-05, M4-02, M4-03 | – |
| M4-05 | Alerts panel | 2 | P0 | 25m | M3-03, M4-03 | – |
| M4-06 | Ghost rendering in graph | 2 | P0 | 10m | M4-02, M3-06 | M1-07 |
| M4-07 | Polish and empty states | 3 | P0 | 25m | G2 | – |
| M4-08 | Demo rehearsal + fallback recording | 4 | P0 | 20m | G3 | – |
| ALL-01 | Bug bash (PRD §9 walk-through) | 3 | P0 | 35m | G2 | G3 |
| ALL-02 | Freeze, rehearse, submit | 4 | P0 | 40m | G3 | – |

## Cross-member handoffs (who must tell whom)

| When this lands | Owner | Tell | What changes for them |
|---|---|---|---|
| M2-00 graph types | M2 | M1 | Start coding `build_graph` against the dataclasses |
| M3-00 catalog | M3 | M1, M4 | Prefill and builder use real catalog; M4 can drop mock catalog |
| M1-01 schemas + CRUD | M1 | M3, M4 | Fix library and review use `State`; M4 mock types match |
| M2-02 `evaluate()` | M2 | M3 | Planner and scenarios can call the real simulator |
| M2-05 `analyze_core` | M2 | M1 | M1-05 can assemble `/analysis` |
| M1-05 `/analysis` real | M1 | M4, M2 | Flip `VITE_USE_MOCK=false` for Dashboard, Graph, Account Detail |
| M3-04 `/fixes` real | M3 | M4 (M3-08 is M3's own) | Dashboard banner can show best-3 projected score |
| M3-05 `/scenario` real | M3 | M4, M1 | Scenarios page and Accounts path filter go live |
| M3-06 `/preview` real | M3 | M1, M4 | Ghost panel and ghost rendering go live |

## Critical path
`M1-00 → M1-01 → M1-02 ∥ M2-00 → M2-01 → M2-02 → M3-04 → M3-05 → M4-04` and `M2-02/M2-05 → M1-05 → (all real-data UI)`.
If anything on this path slips more than 10 minutes, the owner says so immediately in the group chat; the others pick up unblocked work from "Plan B if blocked" in their file.

## Working agreements
- One PR per ticket, titled with the ticket id (e.g. `M2-04 path explorer`). Self-merge if tests pass and the PR touches only your owned files.
- A contract change (PRD §5, §7, graph types) needs a message to the owner and a note in the group chat before merging.
- Rebase on `main` at every gate. Never force-push `main`.
- Every ticket's "Done when" must be run, not assumed. Paste the command output in the PR.
- If you finish early, check the "Stealable" list in the other members' files, then ask.

## ALL-01 — Bug bash (Phase 3, 35 min, everyone)
Walk the PRD §9 end-to-end acceptance path on a fresh `POST /seed/demo`. Each person takes one lens: M1 data entry and filters; M2 numbers and explanations make sense; M3 fixes, scenarios, review; M4 visuals and flow. Log bugs as one-line items in a shared doc tagged with the owning ticket; fix P0 bugs first. Anything cosmetic that takes more than 10 minutes is dropped.

## ALL-02 — Freeze, rehearse, submit (Phase 4, 40 min)
1. Tag `v1-freeze`. No new features.
2. M1 finishes README (M1-09); M4 runs the demo checklist (M4-08).
3. Rehearse the PRD §13 script twice with a timer. Assign speaker roles: one narrates, one drives, one handles questions.
4. Record a 3-minute fallback screen capture (M4-08).
5. Submit with 20 minutes of buffer. Include repo link, README, recording, and a one-slide architecture picture if the form allows.

## Definition of done (project)
Every §2 row works on the persona; PRD §9 acceptance path passes twice in a row; `pytest` green; frontend builds with `npm run build`; no console errors on the 4 routes; privacy and "model-based estimate" notes visible.
