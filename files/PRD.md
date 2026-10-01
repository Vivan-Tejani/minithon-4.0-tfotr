# Chokepoint — PRD v1 (build-ready)

**Event:** TSEC TechNeXt Minithon 4.0 · **Problem:** Digital Footprint & Privacy Risk Auditor
**Build window:** 4 hours · **Team:** 4 tracks (M1–M4) · **Working name:** Chokepoint ("find the chokepoints in your digital life")

---

## 0. How to use this file with AI agents

Paste this block first, then paste your ticket:

> You are implementing one ticket of the Chokepoint project. Read the whole PRD. Rules:
> 1. Use the exact field names, IDs, enums, formulas and defaults in §5–§7. Do not rename or "improve" them.
> 2. Do not edit a file you do not own (see §11 ownership table). If a contract must change, stop and tell the owner.
> 3. No network calls, no LLM calls, no telemetry anywhere in the product. Everything runs on localhost.
> 4. Never store or request real passwords. Only password-group labels exist.
> 5. Build only what the ticket says. No extra features, no refactors, no new dependencies unless the ticket lists them.
> 6. Every backend function ships with at least one pytest. Every endpoint must match §7 exactly.
> 7. Finish by running the ticket's "Done when" checks and report which pass.

---

## 1. Product in one paragraph

Chokepoint is a **local-first privacy auditor**. The user lists their accounts and *how each one can be logged into or recovered*. We derive a **takeover graph** (entry points → gates → accounts), run a **correlated attack simulation** over it, and rank the **smallest set of fixes** that removes the most expected loss. Every edit and every fix can be **previewed before it is saved**.

It answers three questions no password checker answers: *What single thing, if lost, takes down the most of my life? How would an attacker most easily reach my most valuable account? Which 3 fixes should I do first?*

---

## 2. Traceability to the problem statement

| # | Problem-statement requirement | Our feature | Priority | Owner |
|---|---|---|---|---|
| 1 | Accounts & apps inventory, permissions, recovery, sign-in methods, reuse groups, no real passwords | Account form with catalog prefill; password-group *labels*; permissions list; demo persona | P0 | M1 |
| 2 | Exposure mapping & risk scoring (core) — risk spreads through connections | Engine 1 (gate builder) + Engine 2 (simulator): graph, per-account takeover probability, SPOFs, attack paths, privacy score | P0 | M1, M2 |
| 3 | Fix checklist ranked by risk removed | Engine 3 (planner): interaction-aware ranking, best-3 plan, quick wins, apply-fix updates score | P0 | M3 |
| 4 | Search & filters | Client-side text search + 5 filters + "falls if X is compromised" filter | P0 | M1 |
| 5 | Reminders & breach alerts | Engine 4 (scenario + review): simulated breach cascade hop-by-hop, attacker scenarios, review reminders | P0 | M3, M4 |
| 6 | Privacy dashboard | Score, riskiest accounts, SPOFs, graph, trend from snapshots | P0 | M4, M2 |

---

## 3. The one novel feature — Counterfactual Takeover Planner (CTP)

Three coupled ideas, one engine behind all of them.

1. **Gates, not edges.** Recovery is modelled as AND/OR logic: *password AND SMS code*, OR *recovery email*, OR *sign-in with Google*. So the model can show that "enabling SMS 2FA" does not stop a SIM-swapper, and that hardening one gate achieves nothing while an OR-route stays open. Gates are **derived** from a service catalog plus what the user enabled; the user never draws a graph.
2. **Correlated worlds.** All accounts are evaluated inside the *same* sampled attack worlds (one SIM swap hits every SMS-dependent account at once). Per-account scorers treat accounts independently and get this wrong.
3. **Counterfactual ranking + ghost preview.** Fix #2 is re-scored *given* fix #1 (greedy marginal gain, same random worlds), so redundant fixes drop down the list and the UI can say "worth 4.1 alone, 0.6 after SIM lock". The same machinery previews any account edit or fix before saving ("ghost node": new paths, change in score).

**Honest claim (use this wording in the pitch):** attack graphs, Monte Carlo and greedy selection are established techniques. To our knowledge, consumer privacy tools (password checkers, breach lookups, per-account checklists) do not model account recovery as a correlated attack graph or rank fixes by interaction. We have not done an exhaustive literature search.

**Proof of novelty (P1, M2-09):** run a naive per-account additive scorer and Chokepoint on the same persona, apply each tool's top-3 fixes in our simulator, and show the difference. Caveat to state aloud: both are evaluated under our model, so this demonstrates the interaction effect, not independent validation.

---

## 4. Scope

**P0 (must ship):** everything in §2, plus ghost preview, scenarios, demo persona, trend from snapshots.

**P1 (only if G2 is green by T+2:45):** JSON import/export, editable threat-assumption table UI, +30-day clock simulation button, baseline comparison (M2-09), guided demo overlay.

**Explicitly OUT (do not build, do not discuss in standup):** user login/auth, real OAuth or email integrations, real breach APIs, password manager anchor, browser extension, mobile layout, Word/PDF report export, notifications by email/SMS, LLM-written explanations, multi-user, cloud deploy.

---

## 5. Domain model & contracts (frozen at gate G0)

### 5.1 Enums

| Name | Values |
|---|---|
| `type` | `email, social, shopping, finance, payments, storage, entertainment, professional, utility_app, forum, other` |
| `second_factor` | `none, sms, authenticator, hardware_key` |
| `login_methods` (list, OR) | `password`, `sms_otp`, `sso:<account_id>` |
| `recovery` (list, OR) | `sms`, `email:<account_id>` (referenced account must have `type=email`) |
| `permissions` (list) | `location, contacts, camera, microphone, photos, files, sms, email_inbox:<account_id>` |
| `data_held` (list) | `payment, government_id, health, financial_records, private_messages, work_data, photos, contacts, location_history, profile_only` |
| `effort` | `low, medium, high` |
| `band` | `low` (p < 0.15), `medium` (0.15 ≤ p < 0.40), `high` (p ≥ 0.40) — thresholds live in settings |

### 5.2 Anchor (single object)
```json
{"phone": {"sim_lock": false, "device_lock": true}}
```

### 5.3 Account
```json
{
  "id": "amazon", "name": "Amazon", "service_key": "amazon", "type": "shopping",
  "login_methods": ["password", "sms_otp"],
  "second_factor": "none",
  "recovery": ["email:gmail", "sms"],
  "password_group": "A",
  "permissions": [],
  "data_held": ["payment", "contacts"],
  "last_activity": "2026-09-10",
  "breach_flag": false,
  "importance_override": null
}
```
`id` = lowercase slug, unique. `password_group` = label string or `null` (unique password). `importance_override` = integer 1–10 or `null`.

### 5.4 Catalog entry (`backend/app/data/catalog.json`, ~25 services)
```json
{"key":"amazon","name":"Amazon","type":"shopping",
 "login_methods_supported":["password","sms_otp"],
 "second_factors_supported":["sms","authenticator"],
 "recovery_bypasses_2fa": true,
 "typical_permissions":["contacts"],
 "default_data_held":["payment","contacts"],
 "breach_count_5y": 1}
```
`breach_count_5y` values are **illustrative** (label them so in the UI tooltip: "illustrative demo data"). Do not claim they are verified.

### 5.5 Settings (threat assumptions; defaults; editable via API)
```json
{"horizon_years":5,"p_sim":0.10,"sim_lock_mult":0.25,"p_phone":0.20,"p_phish_email":0.15,
 "leak_base":0.05,"leak_per_breach":0.08,"leak_cap":0.60,"leak_flagged_min":0.80,
 "trials":2000,"seed":42,"band_low":0.15,"band_high":0.40,"stale_days":365,"backup_email_stale_days":180}
```
Probabilities are **model assumptions over a 5-year horizon**, not measured facts. The UI must say "model-based estimate".

### 5.6 Impact weights
Data weights: `payment 10, government_id 9, health 8, financial_records 8, private_messages 6, work_data 5, photos 5, contacts 3, location_history 3, profile_only 1`.
Permission weights (what an attacker gains if the app is compromised): `sms 6, email_inbox 6, camera 4, microphone 4, photos 4, files 4, contacts 3, location 3`.
`impact(account) = importance_override ?? max(all data weights, all permission weights held)`; minimum 1.

### 5.7 Graph contract (Engine 1 → Engine 2/3/4). Owner of the file: **M2** (`engines/graph_types.py`)
```python
@dataclass(frozen=True)
class Method:
    id: str                       # "amazon#recovery:email:gmail"
    label: str                    # used in explanations: "Recovery email reset via Gmail"
    requires: tuple[str, ...]     # node ids; ALL must be true (AND)
    fix_hints: tuple[str, ...]    # fix ids that would remove this method

@dataclass
class Node:
    id: str
    kind: Literal["entry", "cap", "account"]
    label: str
    p: float | None = None                    # entries only
    methods: list[Method] = field(default_factory=list)   # OR of methods; [] = never true
    fix_hint: str | None = None               # entries only (e.g. "sim_lock")
    meta: dict = field(default_factory=dict)  # account: {impact,name,type}; entry: {group?}

@dataclass
class Graph:
    nodes: dict[str, Node]
    order: list[str]              # deterministic: entries, then caps, then accounts (each sorted by id)
```

### 5.8 Node ids
Entries: `E_SIM`, `E_PHONE`, `E_LEAK:<account_id>`, `E_PHISH:<account_id>`.
Caps: `CAP_SMS`, `CAP_DEVICE`, `CAP_KEY`, `CAP_INBOX:<account_id>`, `CAP_PW:<account_id>`.
Accounts: `ACC:<account_id>`.
Anchors are not nodes; they change entry probabilities and cap rules.

### 5.9 Fix ids (deterministic)
`sim_lock` · `device_lock` · `2fa:<acct>` · `rm_login:<acct>:sms_otp` · `rm_recovery:<acct>:sms` · `rm_recovery:<acct>:email:<email_acct>` · `unique_pw:<group>` · `revoke:<acct>:<permission>` · `delete:<acct>`

---

## 6. Engines

### Engine 1 — Gate Builder (`engines/gate_builder.py`, owner M1)
`build_graph(state, catalog, settings) -> Graph`. Pure function, no I/O.

**Entries**
| Id | p | Notes |
|---|---|---|
| `E_SIM` | `p_sim × (sim_lock_mult if sim_lock else 1)` | fix_hint `sim_lock` |
| `E_PHONE` | `p_phone` | fix_hint `device_lock`; grants nothing when `device_lock=true` (rules below) |
| `E_LEAK:a` (every account) | `min(leak_cap, leak_base + leak_per_breach × breach_count_5y)`; if `breach_flag`: `max(that, leak_flagged_min)` | credentials of service *a* leak |
| `E_PHISH:e` (every email-type account whose `second_factor != hardware_key`) | `p_phish_email` | phishing defeats SMS and authenticator codes; only hardware keys resist |

**Capabilities (zero-cost nodes)**
- `CAP_SMS`: methods `[E_SIM]`; `[E_PHONE]` only if `device_lock=false`; and for every account *x* holding permission `sms`: `[ACC:x]`.
- `CAP_DEVICE`: `[E_PHONE]` only if `device_lock=false`, else no methods.
- `CAP_KEY`: no methods (never true unless forced).
- `CAP_PW:a`: one method per member *k* of *a*'s password group (including *a*): `[E_LEAK:k]`. Unique password → only `[E_LEAK:a]`.
- `CAP_INBOX:e` (every email-type account *e*): `[ACC:e]`; and for every account *x* holding `email_inbox:e`: `[ACC:x]`.

**Account methods for `ACC:a`** (OR). `factor_caps`: `none→[]`, `sms→[CAP_SMS]`, `authenticator→[CAP_DEVICE]`, `hardware_key→[CAP_KEY]`.
1. `password` in login_methods → requires `[CAP_PW:a] + factor_caps`; fix_hints: `2fa:a` if factor ∈ {none, sms}; plus `unique_pw:<g>` if grouped.
2. `sms_otp` → `[CAP_SMS]`; hint `rm_login:a:sms_otp`.
3. `sso:p` → `[ACC:p]`; no hint.
4. each `email:e` in recovery → `[CAP_INBOX:e]` + (`factor_caps` if `catalog.recovery_bypasses_2fa == false`); hint `rm_recovery:a:email:e`.
5. `sms` in recovery → `[CAP_SMS]` + same factor rule; hint `rm_recovery:a:sms`.
6. if `a` is email-type and factor ≠ hardware_key → `[E_PHISH:a]`; hint `2fa:a`.

Validation (raise 422): unknown ids in `recovery`/`sso`/`email_inbox`, email recovery target not email-type, duplicate ids, self-reference.

**Graph view export** `to_view(graph, analysis)` → Cytoscape-ready `{nodes, edges}`. Show only: `E_SIM`, `E_PHONE`, one aggregated node per password group of size ≥ 2 (`GROUP:<label>`), and all accounts. Layers: 0 entries/groups, 1 accounts that other accounts depend on (hubs), 2 the rest. Edge `X→A` exists when X can supply a requirement of one of A's methods (collapse caps); edge `label` = the method label. Node fields: `{id,label,kind,layer,p,band,impact}`.

### Engine 2 — Simulator (`engines/simulator.py`, owner M2)
**2a. Deterministic closure** `closure_det(graph, forced:set[str]) -> {hop:{id:int}, via:{account_id:str}}`
```
true = set(forced); hop = {f:0 for f in forced}
settle_caps(): repeat until stable: for each non-account node n not in true:
                   if any(all(r in true for r in m.requires) for m in n.methods): true.add(n)
settle_caps(); r = 0
loop: r += 1
   newly = [a for a in accounts if a not in true and satisfied(a, true)]   # snapshot semantics
   if none: break
   for a in newly: true.add(a); hop[a] = r; via[a] = label of first satisfied method
   settle_caps()
```
Caps are zero-cost; each account costs one hop. Entries are true only if forced.

**2b. Monte Carlo** `closure_mc(graph, entry_state, forced)` — vectorised NumPy bool arrays of shape `(trials,)`; monotone fixed-point sweep over `graph.order` until nothing changes (max 12 sweeps).
Entry sampling (**common random numbers**): `u = np.random.default_rng([seed, zlib.crc32(entry_id.encode())]).random(trials)`; `state = u < p`. Because the stream depends only on seed + entry id, editing the graph or applying a fix reuses the same worlds; fix deltas are low-variance. Forced nodes are all-true.

**2c. Metrics** `metrics(graph, forced=None) -> {p:{acct:float}, el, worst, score}`
`P_i = mean(taken_i)` · `EL = Σ P_i·impact_i` · `worst = Σ impact_i` · `score = round(100 × (1 − EL/worst))`.

**2d. SPOFs** `find_spofs(graph)`: candidates = `E_SIM`, `E_PHONE`, each password group with ≥2 members (force every member's `CAP_PW`), and each account. For each: `falls` = accounts taken in `closure_det` with only that candidate forced (excluding the candidate itself); `d_el = EL(MC with candidate forced) − EL(base)`. Return top 8 by `d_el`, with `falls_ids`.

**2e. Path explorer** `paths_into(graph, target, max_hops=4, limit=5)`
Backward expansion: an account/cap node's derivations are, for each method, the cross-product of derivations of its `requires`; an entry's derivation is itself. Track visiting set to avoid cycles; count a hop only when passing through an account node; per-node cap of 30 partial derivations (keep highest product of p). Dedupe by the frozenset of entries; drop supersets. `likelihood = Π p(entry)` over the entry set ("this route alone"). Output per path: `{entries, steps:[{node,hop,via}], likelihood, band, cut_fix_id}`. `cut_fix_id` = the lowest-effort hint among the path's method hints and entry hint (ties: first on the path). Sort by likelihood desc.
"Easiest path to the crown jewel" = top path into the account with max impact (ties: higher P).

**2f. Explanations** `explain_account(...)`: template-only, no LLM. Format:
`"{Name} has a {band} takeover likelihood ({pct}%). Easiest route: {step1} → {step2}. {Second route if any.} Biggest single reduction: {fix title}."` Include the reasons list: reuse group, missing/weak 2FA, breach history count, risky permissions. Provide `explain_score(...)` for the dashboard: one sentence naming the top SPOF.

### Engine 3 — Fix Planner (`engines/fix_library.py`, `engines/fix_planner.py`, owner M3)
**Library** `generate_candidates(state, catalog) -> list[Fix]` and `apply_fix(state, fix) -> state'` (pure, idempotent, returns a deep copy).
| Fix | Generated when | Effect | Effort |
|---|---|---|---|
| `sim_lock` | anchor sim_lock false | set true | low |
| `device_lock` | anchor device_lock false | set true | low |
| `2fa:a` | factor below best supported by catalog (none→authenticator, sms→authenticator, authenticator→hardware_key only if supported) | upgrade factor | medium |
| `rm_login:a:sms_otp` | `sms_otp` in login | remove it | low |
| `rm_recovery:a:…` | recovery contains that method and at least one other recovery or login method remains | remove it | low |
| `unique_pw:g` | group size ≥ 2 | set all members' group to null | medium (size ≤ 2), high (size ≥ 4) |
| `revoke:a:perm` | account holds permission | remove it | low |
| `delete:a` | account stale, or removing it lowers EL | remove account; strip dangling references (recovery/sso/email_inbox) | medium |

**Planner** `plan(state, catalog, settings, forced=None, k_full=8, candidate_filter=None)` — lazy greedy (CELF):
1. `base = metrics(build(state))`. For every candidate compute `standalone_gain = base.el − EL(apply)`.
2. Max-heap on standalone gain. Repeatedly pop the top, recompute its marginal gain against the already-applied set; accept if it is ≥ the next heap entry's stale gain, else push back. Accept only if gain > 0.01. Stop at `k_full` picks.
3. Remaining fixes are listed after the greedy picks, ordered by standalone gain, `greedy:false`.
4. Output per fix: `{id,type,title,target,effort,standalone_gain,marginal_gain,score_after,rank,in_best3,note,why}`; `note` = "Worth X alone, Y after earlier fixes" when `marginal < 0.5 × standalone`.
5. `best3` = first three greedy picks. `quick_wins` = effort `low`, sorted by marginal gain, top 5.
Use `trials=1000` inside the planner for speed (same seed and CRN). Performance budget: full plan ≤ 3 s for 15 accounts.

### Engine 4 — Scenario & Review (`engines/scenario_review.py`, owner M3)
**Scenarios** `run_scenario(state, catalog, settings, kind, target)`
| kind | target | forces |
|---|---|---|
| `entry` | `E_SIM` or `E_PHONE` | that entry |
| `breach` | account id (service breached) | `E_LEAK:<id>` |
| `compromise` | account id (phished email, malicious app, etc.) | `ACC:<id>` |
Returns `cascade` (grouped by hop round from `closure_det`, each account with `via` label), `falls`, `el_delta` (MC forced EL − base EL), `score_during` (score under forced scenario), `leaked_group` (password group exposed, if any), and `next_actions` = `plan(forced=…, candidate_filter=fixes whose target is in the cascade, the forced origin, the anchor involved, or the leaked group, k_full=5)`.

**Review** `run_review(state, catalog, settings, as_of)` → items (ids stable per rule+target):
| kind | rule | severity | fix_id |
|---|---|---|---|
| `stale_account` | `as_of − last_activity > stale_days` | high if it is a recovery/SSO target or in a reuse group, else low | `delete:<id>` |
| `unused_backup_email` | email-type, used as recovery/SSO target by ≥1 account, inactive > `backup_email_stale_days` | high | `rm_recovery:<dependent>:email:<id>` (first dependent) |
| `weak_2fa` | impact ≥ 8 and factor ∈ {none, sms} | high | `2fa:<id>` |
| `reuse` | group size ≥ 2 | medium | `unique_pw:<g>` |
| `periodic_review` | `as_of − last_review_at > 30 days` | low | none |
Items are also appended to the event log (`kind=review`). "Simulated notification" = in-app alerts panel; no real delivery.

---

## 7. API contract (owner of `main.py`/schemas: M1). JSON only. Base `/api`.

| Method & path | Body → Response (abridged) | Owner |
|---|---|---|
| `GET /health` | `{ok:true}` | M1 |
| `GET /state` | `{anchors, accounts[], settings, last_review_at, now}` | M1 |
| `PUT /anchors` | anchors → anchors (+snapshot) | M1 |
| `POST /accounts` · `PUT /accounts/{id}` · `DELETE /accounts/{id}` | Account → Account (+snapshot, event) | M1 |
| `GET /catalog` | catalog entries | M1 |
| `POST /seed/demo` | loads persona, resets history → `{ok:true}` | M3 data, M1 route |
| `GET /analysis` | see below | M1 composes, M2 engine |
| `GET /paths/{account_id}` | `{paths:[Path]}` (top 5) | M2 |
| `GET /fixes` | `{plan:[Fix], best3:[id], quick_wins:[id], base_score}` | M3 |
| `POST /fixes/{fix_id}/apply` | → `{score_before, score_after, state_version}` (+snapshot, event) | M3 |
| `POST /preview` | `{op:"upsert_account", account}` or `{op:"apply_fix", fix_id}` → Preview | M3 |
| `POST /scenario` | `{kind, target}` → Scenario | M3 |
| `GET /review?as_of=YYYY-MM-DD` | `{as_of, items[]}` | M3 |
| `POST /review/complete` | sets `last_review_at=as_of` | M3 |
| `GET /events` · `GET /snapshots` | event log · `[ {ts,score,el,label} ]` | M3 |
| `GET/PUT /settings` | threat table | M1 |
| `GET /compare` (P1) | baseline vs Chokepoint | M2 |
| `POST /import` · `GET /export` (P1) | state JSON | M1 |

**Analysis response**
```json
{"score":41,"el":18.3,"worst":31.0,"headline":"Your phone number alone can take over 9 of your 12 accounts.",
 "accounts":[{"id":"amazon","name":"Amazon","p":0.58,"band":"high","impact":10,"why":"…","reasons":["reuses password A","SMS login"],"top_paths":[Path]}],
 "spofs":[{"id":"E_SIM","label":"Your phone number (SIM swap)","kind":"entry","falls":9,"falls_ids":["gmail"],"d_el":5.2}],
 "crown_path":{"target":"upi","path":Path},
 "graph":{"nodes":[…],"edges":[…]}}
```
**Path:** `{"entries":["E_SIM"],"steps":[{"node":"gmail","hop":1,"via":"Recovery by SMS code"}],"likelihood":0.10,"band":"medium","cut_fix_id":"sim_lock"}`
**Preview:** `{"score_before":41,"score_after":37,"d_el":1.2,"new_paths":[Path],"new_spofs":[…],"ghost":{"nodes":[…],"edges":[…]}}` (`ghost` marks added nodes/edges with `ghost:true`).
**Scenario:** `{"scenario":{"kind","target","label"},"cascade":[{"round":1,"accounts":[{"id","via"}]}],"falls":9,"el_delta":5.2,"score_during":5,"leaked_group":"A","next_actions":[Fix]}`

Every mutating endpoint writes a snapshot `{ts,score,el,label}` (label e.g. "Applied: Turn on SIM lock") and an event.

---

## 8. UI spec (owner M4 for shell; page owners in §11)

Stack: Vite + React + TypeScript, Tailwind, TanStack Query, Cytoscape.js (direct, no wrapper), Recharts. Four routes: `/` Dashboard, `/accounts`, `/fixes`, `/scenarios`. A global bell opens the Alerts panel. A shared right-side **Account Detail** drawer opens from any account click.

- **Dashboard:** score gauge with `headline` sentence; KPI cards (accounts, high-risk count, SPOF count); riskiest accounts (top 5); SPOF panel; crown-jewel path card; graph; trend line chart (snapshots) that steps up as fixes are applied.
- **Graph:** layered layout with manual positions (layer = row), node colour by band (green/amber/red), size by impact, edge label on hover, click selects, `highlight(ids)` API for scenarios and filters, dashed style for `ghost:true`.
- **Accounts:** table + filters + add/edit drawer. Catalog prefill on service select (types, login/2FA options, permissions, data). While editing, a **Ghost Preview** panel debounces `POST /preview` and shows "Score 41 → 37, +2 new paths" and the new top path; the graph shows ghost nodes.
- **Filters:** text; risk band; service type; data held; 2FA method; last activity (<90d, 90–365d, >365d); plus "Falls if compromised…" dropdown (entries + hub accounts) that calls `/scenario` and highlights results.
- **Fixes:** ranked checklist, best-3 banner with projected score, quick-wins toggle, effort chip, "worth X alone / Y after earlier fixes" note, **Apply** button (updates score everywhere), **Preview** button.
- **Scenarios:** pick scenario kind and target (SIM swap, lost phone, service breached, account compromised); hop slider animating the cascade in the graph; leaked password group; next-actions list.
- **Alerts panel:** review items grouped by severity with "Fix" buttons; "Run review" and "Mark reviewed" buttons. P1: "+30 days" button that re-runs `/review?as_of=`.
- **Likelihood display:** bands (low/medium/high) with exact % in a hover tooltip. Footer note on every analysis view: "Model-based estimate, not a measured probability. Data stays on this device."

---

## 9. Demo persona & acceptance tests

Seed (`persona.json`, owner M3): anchors `sim_lock=false, device_lock=true`; 12 accounts:

| id | type | login | 2FA | recovery | pw group | notable |
|---|---|---|---|---|---|---|
| gmail | email | password | sms | sms | – | messages, contacts, photos |
| hotmail | email | password | none | – | A | stale (2022) |
| amazon | shopping | password, sms_otp | none | email:gmail, sms | A | payment |
| upi | payments | sms_otp | none | sms | – | payment (impact 10) |
| netflix | entertainment | password | none | email:gmail | A | profile_only |
| zomato | other | sms_otp | none | email:gmail | – | location_history |
| instagram | social | password | sms | email:gmail | B | photos, messages |
| linkedin | professional | sso:gmail | none | email:gmail | – | work_data |
| canva | utility_app | password, sso:gmail | none | – | B | profile_only |
| photoedit | utility_app | sso:gmail | none | – | – | permissions `photos`, `email_inbox:gmail` |
| dropbox | storage | password | none | email:hotmail | – | government_id, work_data |
| oldforum | forum | password | none | email:hotmail | A | stale (2019) |

**Expected from the rules (hand-derived; M3-01 must confirm by running the engine):** deterministic solo cascades (accounts falling, excluding origin): `E_SIM` = 9 (gmail, amazon, upi, zomato, netflix, instagram, linkedin, canva, photoedit); `ACC:gmail` = 7; leak of `netflix` (group A) = 5 (netflix, hotmail, amazon, oldforum, dropbox); `ACC:hotmail` = 2 (dropbox, oldforum); `E_PHONE` = 0 (device lock on).

**Calibration targets (tune seed data only, not engine rules):** baseline score between 30 and 55; top SPOF is `E_SIM`; best-3 plan raises the score by ≥ 20 points; the plan contains at least one pair where `marginal_gain < 0.5 × standalone_gain` (shows interaction).

**Engine property tests (M2):** `closure_det` and `closure_mc` (with all entries forced identically) produce the same taken-set; same seed → identical metrics; applying any fix never increases EL on the persona.

**End-to-end acceptance (all P0):** load persona → dashboard in < 1 s → open SIM-swap scenario and see 9 accounts fall over 2 rounds → Fixes page shows best-3 → apply first fix → score rises, trend gets a new point, graph recolours → add a new account and see Ghost Preview before saving → search "gmail" and apply the "SMS 2FA" filter → alerts panel lists stale and weak-2FA items.

---

## 10. Non-functional & privacy

- Analysis ≤ 400 ms for ≤ 40 accounts (cache by state hash); planner ≤ 3 s; preview ≤ 800 ms; results deterministic (fixed seed).
- Runs fully offline. CORS limited to `http://localhost:5173`. State in `backend/.data/chokepoint.db` (SQLite, one `kv(key,json)` table plus `snapshots` and `events` tables), git-ignored.
- No real passwords, no secrets, no analytics. Catalog breach counts are illustrative demo data.

---

## 11. Team, ownership, plan

| Track | Role | Owns |
|---|---|---|
| **M1** | Backend foundation + Engine 1 + Accounts page | `main.py, schemas.py, store.py, service.py, gate_builder.py`, `pages/Accounts.tsx`, ghost-preview panel |
| **M2** | Engine 2 + analysis panels | `graph_types.py, simulator.py, baseline.py`, `components/AccountDetail.tsx, SpofPanel.tsx, CrownPath.tsx` |
| **M3** | Engine 3 + Engine 4 + data | `fix_library.py, fix_planner.py, scenario_review.py, catalog.json, persona.json`, `pages/Fixes.tsx` |
| **M4** | Frontend shell, graph, dashboard, scenarios, alerts | `frontend/src/api/*, pages/Dashboard.tsx, pages/Scenarios.tsx, components/Graph.tsx, AlertsPanel.tsx` |

Git: monorepo `chokepoint/{backend,frontend}`; one branch per member; merge to `main` with rebase at each gate; never force-push `main`. Stand-up of 3 minutes at each gate.

| Gate | Time | Must be true |
|---|---|---|
| **G0 Contracts** | T+0:35 | Backend boots; `schemas.py`, `graph_types.py`, `catalog.json` merged; frontend runs on mocks for every §7 endpoint |
| **G1 Engines** | T+1:45 | Engine 1 + 2 tested; `/api/analysis` returns real data for the persona; Fix library + review rules unit-tested |
| **G2 End-to-end** | T+2:45 | All P0 pages work on real API; planner, scenarios, preview, apply, snapshots live |
| **G3 Freeze** | T+3:20 | No new features. Bug-fix, demo rehearsal, README, submission |
| Submit | T+4:00 | Buffer 20 min |

---

## 12. Risks and cut order

| Risk | Mitigation |
|---|---|
| Simulator slips | M1 builds against M2's golden fixture; M2-01 (deterministic closure) lands first so scenarios work even before MC |
| Planner too slow | Lazy greedy, `trials=1000`, cap `k_full=8`; cache by state hash |
| Frontend overloaded | M1 and M3 own two pages each; M4-05 (alerts) is stealable by whoever finishes first |
| Scores look arbitrary to judges | Settings table visible; "model-based estimate" label; explanation text shows the route |

**Cut order if behind (cut top first):** baseline comparison → +30-day clock → import/export → threat-table UI → guided demo overlay → path filter → trend polish. Never cut: gate builder, simulator, planner, scenarios, ghost preview, dashboard.

---

## 13. Demo script (3 minutes)

1. Load persona. "Score 41. One sentence: your phone number alone can take over 9 of 12 accounts."
2. SPOF panel → SIM swap scenario → slide the hop slider: Gmail falls first, then everything behind it.
3. Crown-jewel path card: easiest way into the UPI account, and the one fix that cuts it.
4. Fixes → best-3 plan. Point at the "worth 4.1 alone, 0.6 after SIM lock" note — that is the counterfactual planner.
5. Apply the first fix → score jumps, graph recolours, trend steps up.
6. Add a new account; show Ghost Preview before saving.
7. (P1) Baseline comparison: a per-account checklist would have told you to enable 2FA on Netflix first.
