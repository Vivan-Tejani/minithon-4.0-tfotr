"""Engine 3: Fix Planner - Lazy Greedy (CELF) Optimizer."""
from __future__ import annotations

import heapq
import zlib
from dataclasses import asdict
from typing import Any, Callable
import numpy as np

from backend.app.data.loader import CatalogEntry, Settings, State, load_catalog
from backend.app.engines.fix_library import Fix, apply_fix, generate_candidates
from backend.app.engines.scenario_review import account_impact

# Cache LRU for plans
_PLAN_CACHE: dict[str, dict[str, Any]] = {}


def clear_planner_cache() -> None:
    """Clear cached plan results."""
    _PLAN_CACHE.clear()


def _reference_build_graph(state: State, catalog: dict[str, CatalogEntry], settings: Settings) -> dict[str, Any]:
    """Reference implementation of PRD §6 Engine 1 build_graph."""
    entries: dict[str, float] = {}
    p_sim = settings.p_sim * (settings.sim_lock_mult if state.anchors.phone.sim_lock else 1.0)
    entries["E_SIM"] = p_sim
    entries["E_PHONE"] = settings.p_phone
    for a in state.accounts:
        cat = catalog.get(a.service_key)
        bc = (cat.get("breach_count_5y", 0) if isinstance(cat, dict) else getattr(cat, "breach_count_5y", 0)) if cat else 0
        p = min(settings.leak_cap, settings.leak_base + settings.leak_per_breach * bc)
        if a.breach_flag:
            p = max(p, settings.leak_flagged_min)
        entries[f"E_LEAK:{a.id}"] = p
        if a.type == "email" and a.second_factor != "hardware_key":
            entries[f"E_PHISH:{a.id}"] = settings.p_phish_email

    caps: dict[str, list[list[str]]] = {}
    sms_reqs = [["E_SIM"]]
    if not state.anchors.phone.device_lock:
        sms_reqs.append(["E_PHONE"])
    for x in state.accounts:
        if "sms" in x.permissions:
            sms_reqs.append([f"ACC:{x.id}"])
    caps["CAP_SMS"] = sms_reqs

    dev_reqs: list[list[str]] = []
    if not state.anchors.phone.device_lock:
        dev_reqs.append(["E_PHONE"])
    caps["CAP_DEVICE"] = dev_reqs
    caps["CAP_KEY"] = []

    groups: dict[str, list[str]] = {}
    for a in state.accounts:
        if a.password_group:
            groups.setdefault(a.password_group, []).append(a.id)

    for a in state.accounts:
        members = groups.get(a.password_group, [a.id]) if a.password_group else [a.id]
        caps[f"CAP_PW:{a.id}"] = [[f"E_LEAK:{m}"] for m in members]

    for a in state.accounts:
        if a.type == "email":
            inbox_reqs = [[f"ACC:{a.id}"]]
            for x in state.accounts:
                if f"email_inbox:{a.id}" in x.permissions:
                    inbox_reqs.append([f"ACC:{x.id}"])
            caps[f"CAP_INBOX:{a.id}"] = inbox_reqs

    accts: dict[str, list[list[str]]] = {}
    for a in state.accounts:
        cat = catalog.get(a.service_key)
        factor_caps = []
        if a.second_factor == "sms":
            factor_caps = ["CAP_SMS"]
        elif a.second_factor == "authenticator":
            factor_caps = ["CAP_DEVICE"]
        elif a.second_factor == "hardware_key":
            factor_caps = ["CAP_KEY"]

        methods: list[list[str]] = []
        if "password" in a.login_methods:
            methods.append([f"CAP_PW:{a.id}"] + factor_caps)
        if "sms_otp" in a.login_methods:
            methods.append(["CAP_SMS"])
        for m in a.login_methods:
            if m.startswith("sso:"):
                methods.append([f"ACC:{m.split(':', 1)[1]}"])

        bypasses = (cat.get("recovery_bypasses_2fa", True) if isinstance(cat, dict) else getattr(cat, "recovery_bypasses_2fa", True)) if cat else True
        rec_factor = [] if bypasses else factor_caps

        for r in a.recovery:
            if r.startswith("email:"):
                methods.append([f"CAP_INBOX:{r.split(':', 1)[1]}"] + rec_factor)
            elif r == "sms":
                methods.append(["CAP_SMS"] + rec_factor)

        if a.type == "email" and a.second_factor != "hardware_key":
            methods.append([f"E_PHISH:{a.id}"])

        accts[f"ACC:{a.id}"] = methods

    order = sorted(entries.keys()) + sorted(caps.keys()) + sorted(accts.keys())
    return {"entries": entries, "caps": caps, "accts": accts, "order": order}


def _reference_evaluate(
    graph: Any,
    state: State,
    settings: Settings,
    forced: set[str] | None = None,
    trials: int = 1000,
) -> dict[str, Any]:
    """Reference implementation of PRD §6 Engine 2 evaluate using CRN."""
    entries = graph["entries"]
    caps = graph["caps"]
    accts = graph["accts"]
    order = graph["order"]
    seed = settings.seed

    forced_set = set(forced or [])

    node_state: dict[str, np.ndarray] = {}
    for eid, p in entries.items():
        if eid in forced_set:
            node_state[eid] = np.ones(trials, dtype=bool)
        else:
            rng = np.random.default_rng([seed, zlib.crc32(eid.encode())])
            node_state[eid] = rng.random(trials) < p

    for cid in caps:
        node_state[cid] = np.ones(trials, dtype=bool) if cid in forced_set else np.zeros(trials, dtype=bool)
    for aid in accts:
        node_state[aid] = np.ones(trials, dtype=bool) if aid in forced_set else np.zeros(trials, dtype=bool)

    all_methods = {**caps, **accts}
    for _ in range(12):
        changed = False
        for nid in order:
            if nid in entries:
                continue
            cur = node_state[nid]
            if nid in forced_set:
                active = np.ones(trials, dtype=bool)
            else:
                active = np.zeros(trials, dtype=bool)
                for reqs in all_methods.get(nid, []):
                    req_active = np.ones(trials, dtype=bool)
                    for r in reqs:
                        req_active &= node_state[r]
                    active |= req_active
            new_val = cur | active
            if not np.array_equal(new_val, cur):
                node_state[nid] = new_val
                changed = True
        if not changed:
            break

    p_map: dict[str, float] = {}
    el = 0.0
    worst = 0.0
    for a in state.accounts:
        aid = f"ACC:{a.id}"
        p = float(np.mean(node_state[aid]))
        imp = account_impact(a)
        p_map[a.id] = p
        el += p * imp
        worst += imp
    score = round(100.0 * (1.0 - el / worst)) if worst > 0 else 100
    return {"p": p_map, "el": round(el, 3), "worst": worst, "score": score}


def evaluate_state(
    state: State,
    catalog: dict[str, CatalogEntry],
    settings: Settings,
    forced: set[str] | None = None,
    trials: int = 1000,
) -> dict[str, Any]:
    """Unified evaluator that delegates to M1/M2 when present, else reference."""
    try:
        try:
            from app.engines.gate_builder import build_graph
            from app.engines.simulator import evaluate
        except ImportError:
            from backend.app.engines.gate_builder import build_graph
            from backend.app.engines.simulator import evaluate
        g = build_graph(state, catalog, settings)
        return evaluate(g, settings, forced=forced, trials=trials)
    except Exception:
        g = _reference_build_graph(state, catalog, settings)
        return _reference_evaluate(g, state, settings, forced=forced, trials=trials)


def plan(
    state: State,
    catalog: dict[str, CatalogEntry] | None = None,
    settings: Settings | None = None,
    forced: set[str] | None = None,
    k_full: int = 8,
    candidate_filter: Callable[[Fix], bool] | None = None,
) -> dict[str, Any]:
    """Lazy greedy (CELF) fix planner per PRD §6 Engine 3.

    Calculates standalone vs marginal risk reductions using common random numbers (CRN).
    Output: {plan, best3, quick_wins, base_score}.
    """
    cat_map = catalog if catalog is not None else load_catalog()
    st = settings or state.settings

    # Cache check
    cache_key = f"{state.model_dump_json()}::{str(st)}::{sorted(forced or [])}::{k_full}"
    if cache_key in _PLAN_CACHE and candidate_filter is None:
        return _PLAN_CACHE[cache_key]

    # Base evaluation
    base_ev = evaluate_state(state, cat_map, st, forced=forced, trials=1000)
    base_el = base_ev["el"]
    base_score = base_ev["score"]

    # 1. Generate candidates and filter if requested
    raw_candidates = generate_candidates(state, cat_map)
    candidates = (
        [c for c in raw_candidates if candidate_filter(c)]
        if candidate_filter
        else raw_candidates
    )
    candidates_by_id = {c.id: c for c in candidates}

    # 2. Standalone gains
    standalone_data: dict[str, tuple[float, int]] = {}
    for c in candidates:
        s_after = apply_fix(state, c, cat_map)
        ev_after = evaluate_state(s_after, cat_map, st, forced=forced, trials=1000)
        gain = max(0.0, round(base_el - ev_after["el"], 3))
        standalone_data[c.id] = (gain, ev_after["score"])

    # 3. Max-heap of standalone gains (filter out non-positive gains <= 0.01)
    heap: list[tuple[float, int, str]] = []
    for cid, (gain, _) in standalone_data.items():
        if gain > 0.01:
            heapq.heappush(heap, (-gain, 0, cid))

    # 4. Lazy greedy (CELF) loop
    curr_state = state
    curr_el = base_el
    round_num = 0
    greedy_picks: list[dict[str, Any]] = []
    selected_ids: set[str] = set()

    while heap and len(greedy_picks) < k_full:
        neg_gain, r, cid = heapq.heappop(heap)
        stale_gain = -neg_gain

        if r == round_num:
            # Verified top marginal gain in current round
            fix = candidates_by_id[cid]
            curr_state = apply_fix(curr_state, fix, cat_map)
            ev_new = evaluate_state(curr_state, cat_map, st, forced=forced, trials=1000)
            actual_gain = max(0.0, round(curr_el - ev_new["el"], 3))
            curr_el = ev_new["el"]

            stand_gain, _ = standalone_data[cid]
            note = (
                f"Worth {stand_gain:.1f} alone, {actual_gain:.1f} after earlier fixes"
                if actual_gain < 0.5 * stand_gain
                else None
            )

            greedy_picks.append(
                {
                    "id": fix.id,
                    "type": fix.type,
                    "title": fix.title,
                    "target": fix.target,
                    "effort": fix.effort,
                    "standalone_gain": stand_gain,
                    "marginal_gain": actual_gain,
                    "score_after": ev_new["score"],
                    "rank": len(greedy_picks) + 1,
                    "in_best3": len(greedy_picks) < 3,
                    "greedy": True,
                    "note": note,
                    "why": fix.why,
                }
            )
            selected_ids.add(cid)
            round_num += 1
        else:
            # Recompute marginal gain against current state
            fix = candidates_by_id[cid]
            st_test = apply_fix(curr_state, fix, cat_map)
            ev_test = evaluate_state(st_test, cat_map, st, forced=forced, trials=1000)
            new_gain = max(0.0, round(curr_el - ev_test["el"], 3))
            if new_gain > 0.01:
                heapq.heappush(heap, (-new_gain, round_num, cid))

    # 5. Remaining candidates (ordered by standalone gain, greedy=False)
    remaining_fixes = [
        c for c in candidates if c.id not in selected_ids and standalone_data.get(c.id, (0, 0))[0] > 0.01
    ]
    remaining_fixes.sort(key=lambda c: standalone_data[c.id][0], reverse=True)

    non_greedy_picks: list[dict[str, Any]] = []
    for c in remaining_fixes:
        s_gain, s_score = standalone_data[c.id]
        non_greedy_picks.append(
            {
                "id": c.id,
                "type": c.type,
                "title": c.title,
                "target": c.target,
                "effort": c.effort,
                "standalone_gain": s_gain,
                "marginal_gain": s_gain,
                "score_after": s_score,
                "rank": len(greedy_picks) + len(non_greedy_picks) + 1,
                "in_best3": False,
                "greedy": False,
                "note": None,
                "why": c.why,
            }
        )

    full_plan = greedy_picks + non_greedy_picks

    # best3: first three greedy picks
    best3 = [f["id"] for f in greedy_picks[:3]]

    # quick_wins: low-effort fixes sorted by marginal_gain desc (top 5)
    low_effort = [f for f in full_plan if f["effort"] == "low"]
    low_effort.sort(key=lambda f: f["marginal_gain"], reverse=True)
    quick_wins = [f["id"] for f in low_effort[:5]]

    result = {
        "plan": full_plan,
        "best3": best3,
        "quick_wins": quick_wins,
        "base_score": base_score,
    }

    if candidate_filter is None:
        _PLAN_CACHE[cache_key] = result

    return result
