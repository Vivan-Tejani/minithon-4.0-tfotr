# M2 — Engine 2 (Simulator) · Analysis Panels · Baseline Compare

**You own:** `backend/app/engines/{graph_types.py, simulator.py, baseline.py}`, `backend/tests/test_simulator*.py`, `frontend/src/components/{AccountDetail, SpofPanel, CrownPath, BaselineCompare}.tsx`.
**You provide to others:** `graph_types.py` (M1), `evaluate()` (M3), `closure_det` (M3), `analyze_core` (M1), the SPOF/path/explanation text that the UI shows.
**You need from others:** `build_graph` (M1-02) for real graphs, `fix_library.apply_fix` (M3-02) for property tests and baseline, shared UI primitives (M4-00).

## Agent prompt (paste with PRD.md)
> You are M2 on Chokepoint. You own Engine 2: deterministic closure, correlated Monte Carlo, metrics, SPOFs, path explorer and template explanations. Follow PRD §5.7, §5.8, §6 (Engine 2) exactly. Entry sampling must use `np.random.default_rng([seed, zlib.crc32(entry_id.encode())])` so random worlds are reused across graph edits. Pure functions, no I/O, no network, no LLM. Add pytest tests for every function.

---

## Phase 0 — Contracts (T+0:00 → 0:35)

### M2-00 · Graph types + golden fixture — P0 · 10m
**Depends on:** – · **Blocks:** M1-02, M2-01
**Do:** `graph_types.py` with `Method`, `Node`, `Graph` exactly as PRD §5.7, plus helpers `Graph.accounts()`, `Graph.entries()`, `Graph.get(id)`. Add `tests/fixtures/mini_graph.py` — a hand-built graph:
- entries `E_SIM` (p 0.10), `E_PHONE` (p 0.20, no grants)
- `CAP_SMS` ← `[E_SIM]`
- `ACC:gmail` ← recovery `[CAP_SMS]`; `CAP_INBOX:gmail` ← `[ACC:gmail]`
- `ACC:canva` ← sso `[ACC:gmail]`; `ACC:netflix` ← recovery `[CAP_INBOX:gmail]`
- `ACC:vault` ← `[CAP_KEY]` (never)
Expected: forced `{E_SIM}` → gmail hop 1, canva hop 2, netflix hop 2; vault never.
**Done when:** file merged and M1 notified within 10 minutes (M1-02 waits on it).

---

## Phase 1 — Engines (T+0:35 → 1:45)

### M2-01 · Deterministic closure — P0 · 25m
**Depends on:** M2-00, M1-00 · **Blocks:** M2-02, M2-04, M3-05
**Do:** `closure_det(graph, forced) -> {"hop": {id:int}, "via": {account_id:str}}` with the exact round semantics in PRD §6 (caps zero-cost, one hop per account round, snapshot semantics per round, `via` = label of the first satisfied method in method order). Also `cascade_rounds(result)` → list of `{round, accounts:[{id,via}]}` for the UI.
**Tests:** mini_graph expectations; a cycle (app with `sms` permission whose compromise enables other SMS-gated accounts) terminates; empty forced set → empty result; forcing a cap node works (used for group SPOFs).
**Done when:** tests pass. **Tell M3** (scenarios start from this even before MC).

### M2-02 · Monte Carlo closure + metrics + `evaluate()` — P0 · 30m  ⭐ critical path
**Depends on:** M2-01 · **Blocks:** M2-03, M3-04, M3-05, M1-05
**Do:**
- `closure_mc(graph, entry_state, forced)` — vectorised bool arrays `(trials,)`; fixed-point sweeps over `graph.order` (max 12).
- `sample_entries(graph, settings, forced_ids)` — common random numbers: `u = default_rng([seed, crc32(id)]).random(trials)`; `state = u < p`; forced ids all-true.
- `metrics(graph, settings, forced=None, trials=None) -> {p:{acct:float}, el, worst, score}` per PRD §6 2c.
- `evaluate(graph, settings, forced=None, trials=None)` = thin public wrapper that M3 calls. Document its signature in the docstring.
**Tests:**
- same seed → identical results; different seed → close (|ΔEL| small)
- with every entry forced identically, `closure_mc` taken-set equals `closure_det` taken-set (property test)
- adding an independent isolated account does not change other accounts' P
- forcing a node never lowers any P
- performance: 12 accounts, 2000 trials < 50 ms
**Done when:** all pass. **Tell M3 and M1 immediately.**

### M2-03 · SPOF finder — P0 · 15m
**Depends on:** M2-02 · **Blocks:** M2-05, M2-08
**Do:** `find_spofs(graph, settings, accounts_by_id, top=8)` per PRD 2d. Candidates: `E_SIM`, `E_PHONE`, `GROUP:<label>` (force every member's `CAP_PW:*`), each account. `falls` from `closure_det` (excluding the candidate when it is an account), `d_el` from MC. Labels: `E_SIM` → "Your phone number (SIM swap)"; `E_PHONE` → "Your phone (lost or stolen)"; group → "Shared password '{g}'"; account → "{Name} account". Output `{id,label,kind,falls,falls_ids,d_el}` sorted by `d_el` desc, ties by `falls`.
**Tests:** persona expectations (PRD §9): E_SIM falls 9, gmail 7, group A 5, hotmail 2, E_PHONE 0; E_SIM ranks first once calibrated.

### M2-04 · Path explorer — P0 · 35m
**Depends on:** M2-00, M2-01 · **Blocks:** M2-05, M2-07
**Do:** `paths_into(graph, target_account_id, max_hops=4, limit=5)` per PRD 2e. Each path returns `{entries, steps:[{node,hop,via}], likelihood, band, cut_fix_id}`. `steps` are ordered root-to-target with `hop` counted per account. Implement `fix_effort(fix_id)` locally (copy the effort table from PRD §6 Engine 3: `sim_lock, device_lock, rm_*, revoke` = low; `2fa, delete` = medium; `unique_pw` = medium) to choose `cut_fix_id` without depending on M3.
**Tests:** mini_graph: paths into canva = `[E_SIM → gmail → canva]`, likelihood 0.10, cut fix = `sim_lock`; cycle safety; superset paths dropped; limit respected; shared-entry routes are not double-counted as separate minimal sets.
**Done when:** persona path into `upi` is a single-hop `E_SIM` route with `cut_fix_id="rm_login:upi:sms_otp"` or `sim_lock` (lowest effort, first on path).

### M2-05 · Explanations + `analyze_core` — P0 · 20m
**Depends on:** M2-03, M2-04 · **Blocks:** M1-05
**Do:**
- `explain_account(...)` template per PRD 2f; `reasons[]` from facts: reuse group (and who shares it), factor none/sms, breach count or flag, risky permissions (`sms`, `email_inbox`), stale activity.
- `headline(spofs, n_accounts)`: if top SPOF is an entry: "Your phone number alone can take over {falls} of your {n} accounts."; group: "One leaked password ('{g}') can take over {falls} of your {n} accounts."; account: "If {Name} is compromised, {falls} of your other accounts fall."
- `analyze_core(graph, state, catalog, settings) -> {score, el, worst, headline, accounts[], spofs[], crown_path}` where `accounts[]` carry `{id,name,p,band,impact,why,reasons,top_paths(≤2)}` and `crown_path` = top path into the max-impact account (ties by higher P).
**Done when:** persona output reads naturally (read three `why` strings aloud); every string is template-based (no LLM). **Tell M1** the exact import path.

---

## Phase 2 — Integrate (T+1:45 → 2:45)

### M2-06 · Performance, cache, property tests — P0 · 15m
**Depends on:** M2-05 · **Do:** `cache.py`-style helper in `simulator.py`: `cached(key_fn)` LRU (size 64) keyed by a stable hash of `(state, settings)`; expose `clear_cache()` called on any mutation. Benchmark test: `analyze_core` on the persona < 400 ms; on a synthetic 40-account graph < 400 ms (if over, lower default `trials` to 1500 and document). Property tests once M3-02 exists: for every candidate fix on the persona, `EL(after) ≤ EL(before) + 0.05` (CRN noise margin).

### M2-07 · Account Detail drawer — P0 · 30m
**Depends on:** M4-03, M2-04, M2-05, M1-05 · **Do:** `AccountDetail.tsx` — shared right-side drawer opened by selecting any account (graph, table, lists). Sections: header (name, band chip with % tooltip, impact); "Why" sentence; reasons chips; "Ways in" — top 3 paths as step chains (`E_SIM → Gmail → Canva`) each with likelihood band and a "Cut this path" button (links to the fix id; opens Preview via `PreviewCard` from M1-07 when available); "What this account can unlock" (list of accounts that fall if it is compromised, from SPOF/scenario). Fetches `GET /paths/{id}` for the full top 5.
**Done when:** opens from the table and the graph; shows ≥ 2 distinct paths for `upi` and `canva` on the persona; works with mocks too.

### M2-08 · SPOF panel + crown-jewel path — P0 · 15m
**Depends on:** M2-03, M4-01, M1-05 · **Do:** `SpofPanel.tsx` (list of top 5: icon by kind, label, "falls N accounts", ΔEL bar; click highlights the cascade in the graph via `highlight(falls_ids)`) and `CrownPath.tsx` ("Easiest way into {target}": step chain + likelihood band + cut-fix button). M4 mounts both on the Dashboard; agree on props with M4 at G0.

---

## Phase 3 — Harden (T+2:45 → 3:20)

### M2-09 · Baseline comparison (novelty proof) — **P1** · 30m
**Depends on:** M3-04, M3-02, M2-02 · **Do:**
- `baseline.py`: `naive_account_score(account)` = `30·[factor==none] + 15·[factor==sms] + 25·[in reuse group] + 15·[breach_count>0 or flag] + 3·len(permissions)`, capped at 100. `naive_plan(state)` = per-account fixes only (`2fa`, `unique_pw`, `revoke`, `delete`) ranked by the drop in the **sum of naive scores**; no knowledge of SIM or recovery edges; top 3.
- `GET /compare` → `{naive:{plan:[fix ids], el_removed, score_after}, ours:{plan, el_removed, score_after}}`; both plans are applied with `apply_fix` and scored by our simulator.
- `BaselineCompare.tsx` card: two columns, "A per-account checklist would say… / Chokepoint says…", with the EL-removed numbers and the caveat line "Both plans are scored by our model; this shows interaction effects, not independent validation."
**Done when:** on the persona the two top-3 lists differ and ours removes more EL; if not, report to the team (do not tweak the naive scorer to look worse).

---

## Plan B if blocked
- Waiting on `build_graph`: test with `mini_graph` and a second hand-built graph; swap to real graphs at G1.
- MC too slow: reduce `trials` to 1500; vectorise the sweep before touching semantics.
- UI tickets blocked on M4: build components against `mocks/` JSON with props only.

## Stealable by others if you are ahead
M3-03 (review engine) tests; M4-02 graph tooltips.
