# M3 — Engine 3 (Fix Planner) · Engine 4 (Scenario & Review) · Data · Fixes Page

**You own:** `backend/app/engines/{fix_library.py, fix_planner.py, scenario_review.py}`, `backend/app/data/{catalog.json, persona.json}`, `backend/tests/test_{fix,planner,scenario,review,persona}*.py`, `frontend/src/pages/Fixes.tsx`, `frontend/src/components/FixCard.tsx`.
**You provide to others:** `catalog.json` (M1), `load_persona()` (M1), fix ids/titles (everyone), `/fixes`, `/scenario`, `/preview`, `/review`, `/events`, `/snapshots`.
**You need from others:** `State`/schemas (M1-01), `build_graph` (M1-02), `evaluate()`, `closure_det`, `find_spofs`, `paths_into` (M2), shared UI primitives (M4-00).

**Routing note:** M1 owns `main.py`. Put your routes in `backend/app/routes_m3.py` as a FastAPI `APIRouter` and ask M1 to `include_router` (one line) at G0, so you never edit `main.py`.

## Agent prompt (paste with PRD.md)
> You are M3 on Chokepoint. You own the fix library, the lazy-greedy planner, scenario cascades, the review rules, the service catalog and the demo persona. Follow PRD §5.4, §5.9, §6 (Engines 3 and 4), §7 and §9 exactly. Fix ids are deterministic strings from PRD §5.9. `apply_fix` is pure and idempotent. The planner must reuse the simulator's common random numbers. No network, no LLM. Add pytest tests for every function.

---

## Phase 0 — Contracts (T+0:00 → 0:35)

### M3-00 · Service catalog — P0 · 20m
**Depends on:** – · **Blocks:** M1-02, M1-06, M3-01, M3-02
**Do:** `catalog.json` with ~25 entries following PRD §5.4. Suggested keys: gmail, outlook (hotmail), yahoo_mail, amazon, flipkart, netflix, spotify, zomato, swiggy, instagram, facebook, x, linkedin, github, discord, reddit, dropbox, google_drive, canva, uber, upi_app (PhonePe/GPay-style), netbanking, photo_editor_app, generic_forum, generic_app.
Rules:
- `type` from the §5.1 enum; `login_methods_supported` ⊆ {password, sms_otp, sso}; `second_factors_supported` ⊆ {sms, authenticator, hardware_key} (hardware key only where realistic, e.g. gmail, github, dropbox).
- `recovery_bypasses_2fa`: `false` for netbanking and upi_app, `true` for most others.
- `breach_count_5y`: small integers, **illustrative**. Add a top-level `"_note": "breach counts are illustrative demo data"` and make sure M1's loader ignores keys starting with `_`.
**Done when:** a pydantic test loads every entry as `CatalogEntry`; ≥ 3 email-type, ≥ 3 entries with `recovery_bypasses_2fa=false`; no duplicate keys. **Tell M1 and M4.**

---

## Phase 1 — Engines (T+0:35 → 1:45)

### M3-01 · Demo persona + golden test — P0 · 15m
**Depends on:** M3-00, M1-01 · **Blocks:** every demo, G1
**Do:** `persona.json` = anchors + 12 accounts exactly as PRD §9 table (ids, login, 2FA, recovery, groups, permissions, data, `last_activity` dates: hotmail 2022-03-10, oldforum 2019-06-01, others within the last 60 days of 2026-10-01). `load_persona()` returns a `State`. `tests/test_persona_golden.py` asserts the PRD §9 cascade counts (E_SIM=9, gmail=7, leak of netflix=5, hotmail=2, E_PHONE=0) using `build_graph` + `closure_det` — mark `xfail` until M1-02 and M2-01 land, then flip to hard asserts.
**Calibration (tune seed data only, never engine rules):** baseline score 30–55; top SPOF is `E_SIM`. If the numbers miss, adjust `breach_flag`, `importance_override` or data held, and tell M2.
**Done when:** golden test green; M1 can call `load_persona()` from `POST /seed/demo`.

### M3-02 · Fix library — P0 · 30m
**Depends on:** M1-01, M3-00 · **Blocks:** M3-03, M3-04, M3-06, M3-07
**Do:** `Fix` dataclass `{id,type,title,target,effort,why}`. `generate_candidates(state, catalog)` and `apply_fix(state, fix_or_id)` per PRD §6 Engine 3 table. Deep-copy state; idempotent (applying twice = once); `delete:a` strips `recovery`, `sso:` and `email_inbox:` references to `a` and skips deletion when it would leave another account with no login method (then return the state unchanged). Title templates, e.g. "Turn on SIM lock (port-out PIN) with your carrier", "Switch {Name} 2FA from SMS to an authenticator app", "Remove SMS code recovery from {Name}", "Use a different password for each of: {members}", "Revoke '{perm}' from {Name}", "Delete unused account {Name}". `why` is one plain sentence.
**Tests:** one per fix type; idempotence; `generate_candidates` on persona includes `sim_lock`, `unique_pw:A`, `2fa:dropbox`, `delete:oldforum`, `rm_recovery:dropbox:email:hotmail`; no candidate for `device_lock` (already on).
**Done when:** tests pass. **Tell M2** (property tests) and M4 (titles).

### M3-03 · Review engine + events API — P0 · 25m
**Depends on:** M1-01, M3-02 · **Blocks:** M4-05
**Do:** `run_review(state, catalog, settings, as_of)` per PRD §6 Engine 4 table; stable item ids `"{kind}:{target}"`. Routes: `GET /review?as_of=`, `POST /review/complete` (sets `last_review_at`, adds event), `GET /events` (latest 50). Review runs write `kind=review` events once per item per `as_of` (no duplicates).
**Tests (persona, as_of 2026-10-01):** stale items for hotmail and oldforum; `unused_backup_email` for hotmail (dependents: dropbox, oldforum); `weak_2fa` includes upi and dropbox and amazon; `reuse` for groups A and B; `periodic_review` appears when `last_review_at` is older than 30 days; severity ordering high → low.

---

## Phase 2 — Integrate (T+1:45 → 2:45)

### M3-04 · Planner and `GET /fixes` — P0 · 35m  ⭐ critical path
**Depends on:** M2-02 (`evaluate`), M3-02, M1-02 · **Blocks:** M3-05, M3-08, M2-09
**Do:** `plan(state, catalog, settings, forced=None, k_full=8, candidate_filter=None)` — lazy greedy (CELF) per PRD Engine 3. Use `trials=1000` with the same seed (common random numbers). Output per fix `{id,type,title,target,effort,standalone_gain,marginal_gain,score_after,rank,in_best3,greedy,note,why}`; `best3` = first three greedy picks; `quick_wins` = low-effort fixes sorted by marginal gain, top 5. `GET /fixes` returns `{plan, best3, quick_wins, base_score}`; cache with M2-06's helper keyed by state hash.
**Tests:** greedy order's cumulative EL is never worse than ranking by standalone gain; a fix made redundant by an earlier pick has `marginal_gain < 0.5 × standalone_gain` and a `note`; no-op fixes dropped; deterministic across calls; < 3 s on persona.
**Done when:** persona best-3 raises the score ≥ 20 points and at least one interaction note appears (PRD §9 calibration). **Tell M4 and M2.**

### M3-05 · Scenario engine and `POST /scenario` — P0 · 30m
**Depends on:** M2-01, M2-02, M3-04, M1-02 · **Blocks:** M4-04, M1-06 path filter
**Do:** `run_scenario(state, catalog, settings, kind, target)` per PRD Engine 4: forced ids by kind (`entry`→`E_SIM|E_PHONE`; `breach`→`E_LEAK:<id>`; `compromise`→`ACC:<id>`), cascade via `closure_det` + `cascade_rounds`, `el_delta`, `score_during` (metrics with `forced`), `leaked_group`, `next_actions` = `plan(forced=…, candidate_filter=…, k_full=5)`. Validate `kind`/`target` (422 otherwise). Add a `scenario` event.
**Tests (persona):** SIM swap → 9 falls over 2 rounds, gmail in round 1, canva in round 2; lost phone → 0 falls with device lock on; breach `netflix` → `leaked_group="A"`, falls include dropbox in round 2; `next_actions[0]` for SIM swap is `sim_lock` or an account-level SMS removal (assert it is not empty and targets the cascade).

### M3-06 · Preview endpoint (ghost) — P0 · 15m
**Depends on:** M3-02, M1-05, M2-03, M2-04 · **Blocks:** M1-07, M4-06
**Do:** `POST /preview`: `op=upsert_account` (validate, apply to a copy of state) or `op=apply_fix`. Compute before/after `analyze`, return `{score_before, score_after, d_el, new_paths (top 3 paths into the changed account or into accounts whose p increased by > 0.05), new_spofs, ghost:{nodes,edges}}`. `ghost` = nodes/edges present in after-view but not before-view, each with `ghost:true`; for an edited existing account, also mark the changed account's new incoming edges. Never writes to the store or snapshots.
**Tests:** changing gmail 2FA to `none` lowers the score; applying `sim_lock` returns `score_after > score_before` and an empty `ghost`; endpoint is read-only (state unchanged afterwards).

### M3-07 · Apply fix + snapshots — P0 · 15m
**Depends on:** M3-02, M1-05 · **Blocks:** M3-08, M4-01 (trend)
**Do:** `POST /fixes/{fix_id}/apply` (404 unknown; no-op returns same score), saves state, clears cache, records snapshot labelled "Applied: {title}", adds `fix_applied` event, returns `{score_before, score_after, state_version}`. `GET /snapshots` returns ordered `[{ts,score,el,label}]`.
**Tests:** apply raises score on persona; snapshots increase by one; applying twice adds no second snapshot.

### M3-08 · Fixes page — P0 · 30m
**Depends on:** M3-04, M3-07, M4-03 · **Do:** `Fixes.tsx` + `FixCard.tsx`: best-3 banner ("Do these 3 → score 41 → 68"), quick-wins toggle, ranked list with rank, title, effort chip, "worth X alone / Y after earlier fixes" note when present, target chip (opens Account Detail), **Preview** (uses M1's `PreviewCard` with op `apply_fix`; fall back to a simple inline score diff until it exists) and **Apply** buttons. After Apply: invalidate queries, animate the score change, show a toast "Score 41 → 52".
**Done when:** applying the first fix updates the dashboard score and trend; applied fixes disappear from the list; no layout jump on re-rank.

---

## Phase 3 — Harden (T+2:45 → 3:20)
Bug-bash tickets only (ALL-01). Priority checks for you: persona golden numbers unchanged after any engine edit; `/fixes` < 3 s; scenario `next_actions` make sense when read aloud; review items have working fix buttons.

---

## Plan B if blocked
- Waiting on `evaluate()`: write planner logic against a fake `evaluate` (sum of impacts for a toy graph) and unit-test the CELF mechanics; swap at G1.
- Planner too slow: `k_full=5`, `trials=800`, restrict candidates to fixes whose target appears in some top-3 path of any account.
- `/preview` blocked on M1-05: compute the diff with `build_graph` + `evaluate` directly (skip the view) and add `ghost` later.

## Stealable by others if you are ahead
M4-05 (Alerts panel UI) once M3-03 is done; M2-09 baseline UI card.
