"""Engine 2: Simulator for Chokepoint (Takeover Graph analysis).

Implements:
2a. Deterministic closure (closure_det) & cascade_rounds
2b. Monte Carlo closure (closure_mc) with Common Random Numbers (CRN)
2c. Metrics (P_i, EL, worst, score) & evaluate() wrapper
2d. SPOF finder (find_spofs)
2e. Path explorer (paths_into) & fix_effort
2f. Explanations (explain_account, headline) & analyze_core
M2-06. Analysis caching & clear_cache
"""
from __future__ import annotations

import functools
import zlib
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from app.engines.graph_types import Graph, Method, Node

# =====================================================================
# Ticket M2-06: Cache Utilities
# =====================================================================

_ANALYSIS_CACHE: dict[str, Any] = {}
_MAX_CACHE_SIZE = 64


def clear_cache() -> None:
    """Clears the analysis and metrics cache."""
    _ANALYSIS_CACHE.clear()


def _make_cache_key(state: Any, settings: Any) -> str:
    """Creates a deterministic string hash key for (state, settings)."""
    raw = f"{repr(state)}:{repr(settings)}"
    return str(zlib.crc32(raw.encode("utf-8")))


# =====================================================================
# Ticket M2-01: Deterministic Closure
# =====================================================================

def closure_det(graph: Graph, forced: Set[str] | List[str]) -> Dict[str, Any]:
    """Compute deterministic takeover closure per PRD §6 2a.

    Caps are zero-cost; accounts cost one hop per round with snapshot semantics.
    Returns: {"hop": {id: int}, "via": {account_id: str}}
    """
    if not forced:
        return {"hop": {}, "via": {}}

    true_set: Set[str] = set(forced)
    hop: Dict[str, int] = {f: 0 for f in forced}
    via: Dict[str, str] = {}

    def settle_caps():
        changed = True
        while changed:
            changed = False
            for nid, node in graph.nodes.items():
                if node.kind != "account" and nid not in true_set:
                    for m in node.methods:
                        if m.requires and all(r in true_set for r in m.requires):
                            true_set.add(nid)
                            hop[nid] = 0
                            changed = True
                            break

    settle_caps()
    accounts = graph.accounts()
    round_num = 0

    while True:
        round_num += 1
        newly: List[str] = []
        newly_via: Dict[str, str] = {}

        for a in accounts:
            if a.id not in true_set:
                for m in a.methods:
                    if m.requires and all(req in true_set for req in m.requires):
                        newly.append(a.id)
                        newly_via[a.id] = m.label
                        break

        if not newly:
            break

        for aid in newly:
            true_set.add(aid)
            hop[aid] = round_num
            via[aid] = newly_via[aid]

        settle_caps()

    return {"hop": hop, "via": via}


def cascade_rounds(det_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Format deterministic closure into rounds for the UI."""
    hop = det_result.get("hop", {})
    via = det_result.get("via", {})

    rounds_dict: Dict[int, List[Dict[str, str]]] = {}
    for node_id, r in hop.items():
        if r > 0 and node_id.startswith("ACC:"):
            acct_clean = node_id.replace("ACC:", "")
            rounds_dict.setdefault(r, []).append({
                "id": acct_clean,
                "via": via.get(node_id, "Compromised"),
            })

    cascade = []
    for r in sorted(rounds_dict.keys()):
        cascade.append({
            "round": r,
            "accounts": sorted(rounds_dict[r], key=lambda x: x["id"]),
        })
    return cascade


# =====================================================================
# Ticket M2-02: Monte Carlo Closure, Metrics & evaluate()
# =====================================================================

def sample_entries(
    graph: Graph,
    settings: Any,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
    forced_ids: Optional[Set[str]] = None,
) -> Dict[str, np.ndarray]:
    """Sample entry states using Common Random Numbers (CRN) per PRD §6 2b."""
    num_trials = trials or getattr(settings, "trials", 2000)
    forced_input = forced_ids if forced_ids is not None else forced
    forced_set = set(forced_input) if forced_input else set()
    entry_states: Dict[str, np.ndarray] = {}

    seed_val = getattr(settings, "seed", 42)

    for node in graph.entries():
        if node.id in forced_set:
            entry_states[node.id] = np.ones(num_trials, dtype=bool)
        else:
            crc = zlib.crc32(node.id.encode("utf-8"))
            rng = np.random.default_rng([seed_val, crc])
            u = rng.random(num_trials)
            prob = node.p if node.p is not None else 0.0
            entry_states[node.id] = u < prob

    return entry_states


def closure_mc(
    graph: Graph,
    entry_state: Dict[str, np.ndarray],
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
    forced_ids: Optional[Set[str]] = None,
) -> Dict[str, np.ndarray]:
    """Vectorized Monte Carlo fixed-point sweep per PRD §6 2b."""
    forced_input = forced_ids if forced_ids is not None else forced
    forced_set = set(forced_input) if forced_input else set()
    num_trials = trials
    if num_trials is None:
        if entry_state:
            num_trials = len(next(iter(entry_state.values())))
        else:
            num_trials = 2000

    node_states: Dict[str, np.ndarray] = {}

    for nid in graph.order:
        node = graph.nodes[nid]
        if nid in forced_set:
            node_states[nid] = np.ones(num_trials, dtype=bool)
        elif node.kind == "entry":
            node_states[nid] = entry_state.get(nid, np.zeros(num_trials, dtype=bool))
        else:
            node_states[nid] = np.zeros(num_trials, dtype=bool)

    # Monotone fixed-point sweep (max 12 sweeps)
    for _ in range(12):
        changed = False
        for nid in graph.order:
            node = graph.nodes[nid]
            if node.kind == "entry" or nid in forced_set:
                continue

            current = node_states[nid]
            if not node.methods:
                continue

            # Method evaluations (OR of ANDs)
            any_method = np.zeros(num_trials, dtype=bool)
            for m in node.methods:
                if not m.requires:
                    continue
                req_and = np.ones(num_trials, dtype=bool)
                for req in m.requires:
                    req_and &= node_states.get(req, np.zeros(num_trials, dtype=bool))
                any_method |= req_and

            new_state = current | any_method
            if not np.array_equal(current, new_state):
                node_states[nid] = new_state
                changed = True

        if not changed:
            break

    return node_states


def metrics(
    graph: Graph,
    settings: Any,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute takeover probabilities, Expected Loss (EL), worst EL, and score per PRD §6 2c."""
    num_trials = trials or getattr(settings, "trials", 2000)
    forced_set = set(forced) if forced else set()

    entry_states = sample_entries(graph, settings, forced=forced_set, trials=num_trials)
    node_states = closure_mc(graph, entry_states, forced=forced_set, trials=num_trials)

    p_dict: Dict[str, float] = {}
    el = 0.0
    worst = 0.0

    for a_node in graph.accounts():
        acct_id = a_node.meta.get("account_id", a_node.id.replace("ACC:", ""))
        impact = a_node.meta.get("impact", 1)
        p_val = float(np.mean(node_states.get(a_node.id, np.zeros(num_trials, dtype=bool))))
        p_dict[acct_id] = round(p_val, 4)
        el += p_val * impact
        worst += impact

    if worst <= 0.0:
        score = 100
    else:
        score = int(round(100.0 * (1.0 - (el / worst))))
        score = max(0, min(100, score))

    return {
        "p": p_dict,
        "el": round(el, 2),
        "worst": round(worst, 2),
        "score": score,
    }


def evaluate(
    graph: Graph,
    settings: Any,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
) -> Dict[str, Any]:
    """Public wrapper called by Engine 3 (Planner and Scenarios)."""
    return metrics(graph, settings, forced=forced, trials=trials)


# =====================================================================
# Ticket M2-04: Path Explorer & fix_effort
# =====================================================================

_EFFORT_RANK = {"low": 1, "medium": 2, "high": 3}


def fix_effort(fix_id: str) -> str:
    """Determine fix effort per PRD §6 Engine 3 table."""
    if fix_id in ("sim_lock", "device_lock"):
        return "low"
    if fix_id.startswith("rm_") or fix_id.startswith("revoke:"):
        return "low"
    if fix_id.startswith("2fa:") or fix_id.startswith("delete:"):
        return "medium"
    if fix_id.startswith("unique_pw:"):
        return "medium"
    return "low"


def paths_into(
    graph: Graph,
    target_account_id: str,
    max_hops: int = 4,
    limit: int = 5,
    settings: Any = None,
    band_low: float = 0.15,
    band_high: float = 0.40,
) -> List[Dict[str, Any]]:
    """Backward path explorer per PRD §6 2e.

    Outputs: [{entries, steps: [{node, hop, via}], likelihood, band, cut_fix_id}]
    """
    target_nid = target_account_id if target_account_id.startswith("ACC:") else f"ACC:{target_account_id}"
    if target_nid not in graph.nodes:
        target_nid = target_account_id
        if target_nid not in graph.nodes:
            return []

    if settings:
        if hasattr(settings, "band_low"):
            band_low = settings.band_low
            band_high = settings.band_high
        elif isinstance(settings, dict):
            band_low = settings.get("band_low", 0.15)
            band_high = settings.get("band_high", 0.40)

    memo: Dict[Tuple[str, frozenset[str]], List[Tuple[frozenset[str], Tuple[Dict[str, Any], ...], Tuple[str, ...], int]]] = {}

    def get_derivations(
        node_id: str,
        visited: frozenset[str],
    ) -> List[Tuple[frozenset[str], Tuple[Dict[str, Any], ...], Tuple[str, ...], int]]:
        key = (node_id, visited)
        if key in memo:
            return memo[key]

        node = graph.nodes.get(node_id)
        if node is None:
            return []

        if node.kind == "entry":
            hint = (node.fix_hint,) if node.fix_hint else ()
            return [(frozenset([node.id]), (), hint, 0)]

        results: List[Tuple[frozenset[str], Tuple[Dict[str, Any], ...], Tuple[str, ...], int]] = []
        new_visited = visited | {node_id}

        for m in node.methods:
            if not m.requires:
                continue

            if any(r in visited for r in m.requires):
                continue

            req_derivations = []
            valid_method = True
            for r in m.requires:
                r_derivs = get_derivations(r, new_visited)
                if not r_derivs:
                    valid_method = False
                    break
                req_derivations.append(r_derivs)

            if not valid_method:
                continue

            combos = [([], (), (), 0)]
            for r_derivs in req_derivations:
                next_combos = []
                for existing_entries, existing_steps, existing_hints, existing_hop in combos:
                    for r_entries, r_steps, r_hints, r_hop in r_derivs:
                        combined_entries = set(existing_entries) | set(r_entries)
                        combined_steps = list(existing_steps)
                        for st in r_steps:
                            if st not in combined_steps:
                                combined_steps.append(st)
                        combined_hints = list(existing_hints)
                        for h in r_hints:
                            if h not in combined_hints:
                                combined_hints.append(h)
                        next_combos.append((
                            combined_entries,
                            tuple(combined_steps),
                            tuple(combined_hints),
                            max(existing_hop, r_hop),
                        ))
                combos = next_combos

            for entries_set, steps_tuple, hints_tuple, current_hop in combos:
                if node.kind == "account":
                    new_hop = current_hop + 1
                    if new_hop > max_hops:
                        continue
                    clean_name = node.id.replace("ACC:", "")
                    step = {"node": clean_name, "hop": new_hop, "via": m.label}
                    new_steps = steps_tuple + (step,)
                    new_hints = hints_tuple + m.fix_hints
                    results.append((frozenset(entries_set), new_steps, new_hints, new_hop))
                else:
                    new_hints = hints_tuple + m.fix_hints
                    results.append((frozenset(entries_set), steps_tuple, new_hints, current_hop))

        results.sort(key=lambda d: (-len(d[0]), d[3]))
        memo[key] = results[:30]
        return memo[key]

    raw_derivations = get_derivations(target_nid, frozenset())

    paths: List[Dict[str, Any]] = []
    seen_entry_sets: Set[frozenset[str]] = set()

    sorted_derivs = sorted(raw_derivations, key=lambda d: (len(d[0]), d[3]))

    for entry_set, steps, hints, _ in sorted_derivs:
        if not entry_set:
            continue

        if any(es.issubset(entry_set) and es != entry_set for es in seen_entry_sets):
            continue
        if entry_set in seen_entry_sets:
            continue
        seen_entry_sets.add(entry_set)

        likelihood = 1.0
        for e_id in entry_set:
            e_node = graph.nodes.get(e_id)
            p = e_node.p if (e_node and e_node.p is not None) else 1.0
            likelihood *= p

        likelihood = round(likelihood, 4)

        if likelihood < band_low:
            band = "low"
        elif likelihood < band_high:
            band = "medium"
        else:
            band = "high"

        best_fix = ""
        best_rank = 999
        for h in hints:
            rank = _EFFORT_RANK.get(fix_effort(h), 2)
            if rank < best_rank:
                best_rank = rank
                best_fix = h

        if not best_fix:
            best_fix = "sim_lock" if "E_SIM" in entry_set else "device_lock"

        paths.append({
            "entries": sorted(list(entry_set)),
            "steps": list(steps),
            "likelihood": likelihood,
            "band": band,
            "cut_fix_id": best_fix,
        })

    paths.sort(key=lambda p: p["likelihood"], reverse=True)
    return paths[:limit]


# =====================================================================
# Ticket M2-03: SPOF Finder
# =====================================================================

def find_spofs(
    graph: Graph,
    settings: Any = None,
    accounts_by_id: Optional[Dict[str, Any]] = None,
    top: int = 8,
) -> List[Dict[str, Any]]:
    """Find Single Points of Failure per PRD §6 2d.

    Candidates: E_SIM, E_PHONE, each password group >= 2, each account.
    """
    trials = getattr(settings, "trials", 1500) if settings else 1500
    base_m = metrics(graph, settings, trials=trials)
    base_el = base_m["el"]

    candidates: List[Tuple[str, str, str, Set[str]]] = [
        ("E_SIM", "Your phone number (SIM swap)", "entry", {"E_SIM"}),
        ("E_PHONE", "Your phone (lost or stolen)", "entry", {"E_PHONE"}),
    ]

    # Password groups
    groups_members: Dict[str, List[str]] = {}
    for node in graph.nodes.values():
        if node.kind == "entry" and node.id.startswith("E_LEAK:"):
            grp = node.meta.get("group")
            if grp:
                groups_members.setdefault(str(grp), []).append(node.id)

    if accounts_by_id:
        for aid, a in accounts_by_id.items():
            grp = getattr(a, "password_group", None)
            if grp:
                cap_id = f"CAP_PW:{aid}"
                if cap_id in graph.nodes:
                    groups_members.setdefault(str(grp), []).append(cap_id)

    for grp, leak_nodes in groups_members.items():
        unique_nodes = list(dict.fromkeys(leak_nodes))
        if len(unique_nodes) >= 2:
            candidates.append((
                f"GROUP:{grp}",
                f"Shared password '{grp}'",
                "group",
                set(unique_nodes),
            ))

    for a_node in graph.accounts():
        acct_id = a_node.meta.get("account_id", a_node.id.replace("ACC:", ""))
        name = a_node.meta.get("name", acct_id)
        candidates.append((
            acct_id,
            f"{name} account",
            "account",
            {a_node.id},
        ))

    spofs: List[Dict[str, Any]] = []
    for cand_id, label, kind, forced_set in candidates:
        det_res = closure_det(graph, forced=forced_set)
        taken_accounts = [
            nid.replace("ACC:", "")
            for nid, h in det_res["hop"].items()
            if h > 0 and nid.startswith("ACC:") and (nid != f"ACC:{cand_id}" and nid != cand_id)
        ]
        falls_count = len(taken_accounts)

        mc_res = metrics(graph, settings, forced=forced_set, trials=trials)
        d_el = max(0.0, round(mc_res["el"] - base_el, 2))

        spofs.append({
            "id": cand_id,
            "label": label,
            "kind": kind,
            "falls": falls_count,
            "falls_ids": sorted(taken_accounts),
            "d_el": d_el,
        })

    # Sort by d_el desc, ties by falls desc
    spofs.sort(key=lambda s: (s["d_el"], s["falls"]), reverse=True)
    return spofs[:top]


# =====================================================================
# Ticket M2-05: Explanations, Headline & analyze_core
# =====================================================================

def explain_account(*args, **kwargs) -> Any:
    """Generate template-based explanation and facts reasons list (PRD §6 2f).

    Supports both:
    1. explain_account(acct, p_val, band, top_paths, catalog=None) -> (why_str, reasons_list)
    2. explain_account(name="...", band="...", p=..., top_paths=..., best_fix_title=..., reasons=...) -> why_str
    """
    if "name" in kwargs and ("best_fix_title" in kwargs or len(args) == 0):
        name = kwargs.get("name", "Account")
        band = kwargs.get("band", "low")
        p_val = kwargs.get("p", 0.0)
        pct = int(round(p_val * 100))
        top_paths = kwargs.get("top_paths", [])
        best_fix_title = kwargs.get("best_fix_title", "tightening account authentication")

        route_str = ""
        if top_paths:
            steps = [s["node"] for s in top_paths[0].get("steps", []) if "node" in s]
            if steps:
                route_str = f" Easiest route: {' -> '.join(steps)}."

        why = f"{name} has a {band} takeover likelihood ({pct}%).{route_str} Biggest single reduction: {best_fix_title}."
        return why

    acct = args[0] if len(args) > 0 else kwargs.get("acct")
    p_val = args[1] if len(args) > 1 else kwargs.get("p_val", kwargs.get("p", 0.0))
    band = args[2] if len(args) > 2 else kwargs.get("band", "low")
    top_paths = args[3] if len(args) > 3 else kwargs.get("top_paths", [])
    catalog = args[4] if len(args) > 4 else kwargs.get("catalog", None)

    name = getattr(acct, "name", str(acct))
    pct = int(round(p_val * 100))
    reasons: List[str] = []

    pw_group = getattr(acct, "password_group", None)
    if pw_group:
        reasons.append(f"reuses password in group '{pw_group}'")
    sec_factor = getattr(acct, "second_factor", "none")
    if sec_factor in ("none", "sms"):
        reasons.append(f"weak 2FA ({sec_factor})")
    breach = getattr(acct, "breach_flag", False)
    if breach:
        reasons.append("credentials flagged in breach")
    perms = getattr(acct, "permissions", [])
    for perm in perms:
        if perm in ("sms", "photos") or str(perm).startswith("email_inbox:"):
            reasons.append(f"permission '{perm}'")

    r1_text = ""
    r2_text = ""
    cut_title = "tightening account authentication"

    if top_paths:
        p0 = top_paths[0]
        steps = [s["node"] for s in p0.get("steps", []) if "node" in s]
        if steps:
            entries = p0.get("entries", [])
            if entries:
                r1_text = f" Easiest route: {' → '.join(entries)} → {' → '.join(steps)}."
            else:
                r1_text = f" Easiest route: {' → '.join(steps)}."
        else:
            r1_text = f" Easiest route: direct via {p0.get('entries', ['credentials'])[0]}."

        cut_fix = p0.get("cut_fix_id", "")
        if cut_fix == "sim_lock":
            cut_title = "turning on carrier SIM lock"
        elif cut_fix.startswith("2fa:"):
            cut_title = f"upgrading 2FA on {name}"
        elif cut_fix.startswith("rm_login:"):
            cut_title = f"removing SMS OTP login on {name}"

    if len(top_paths) > 1:
        p1 = top_paths[1]
        steps2 = [s["node"] for s in p1.get("steps", []) if "node" in s]
        if steps2:
            entries2 = p1.get("entries", [])
            if entries2:
                r2_text = f" Alternate route: {' → '.join(entries2)} → {' → '.join(steps2)}."
            else:
                r2_text = f" Alternate route: {' → '.join(steps2)}."

    sentence = f"{name} has a {band} takeover likelihood ({pct}%).{r1_text}{r2_text} Biggest single reduction: {cut_title}."
    return sentence, reasons


def headline(spofs: List[Dict[str, Any]], n_accounts: int) -> str:
    """Generate headline summary sentence from top SPOF per PRD §6 2f."""
    if not spofs:
        return "Your accounts have low exposure to cascading takeovers."
    top_spof = spofs[0]
    falls = top_spof["falls"]
    kind = top_spof.get("kind", "")
    sid = top_spof.get("id", "")

    if sid == "E_SIM":
        return f"Your phone number alone can take over {falls} of your {n_accounts} accounts."
    if sid == "E_PHONE":
        return f"Your physical phone alone can access {falls} of your {n_accounts} accounts."
    if kind == "group" or sid.startswith("GROUP:"):
        g_name = sid.replace("GROUP:", "")
        return f"One leaked password ('{g_name}') can take over {falls} of your {n_accounts} accounts."
    label = top_spof.get("label", sid)
    if label.endswith(" account"):
        label = label[:-8]
    return f"If {label} is compromised, {falls} of your other accounts fall."


def analyze_core(
    graph: Graph,
    state: Any,
    catalog: Optional[Any],
    settings: Any,
) -> Dict[str, Any]:
    """Execute complete core analysis per PRD §6 2f and §7."""
    accounts = getattr(state, "accounts", [])
    accounts_by_id = {a.id: a for a in accounts}
    trials = getattr(settings, "trials", 2000)
    band_low = getattr(settings, "band_low", 0.15)
    band_high = getattr(settings, "band_high", 0.40)

    mc_metrics = metrics(graph, settings, trials=trials)
    spof_list = find_spofs(graph, settings, accounts_by_id=accounts_by_id, top=8)
    head_txt = headline(spof_list, len(accounts))

    def get_band(p_val: float) -> str:
        if p_val < band_low:
            return "low"
        if p_val < band_high:
            return "medium"
        return "high"

    accounts_output = []
    max_impact = -1
    crown_acct_id = None
    crown_p = -1.0

    for acct in accounts:
        p_val = mc_metrics["p"].get(acct.id, 0.0)
        band_val = get_band(p_val)
        a_node = graph.get(f"ACC:{acct.id}")
        impact = a_node.meta.get("impact", 1) if a_node else 1

        top_p = paths_into(graph, acct.id, max_hops=4, limit=2, band_low=band_low, band_high=band_high)
        why_str, reasons_list = explain_account(acct, p_val, band_val, top_p, catalog)

        accounts_output.append({
            "id": acct.id,
            "name": acct.name,
            "p": round(p_val, 4),
            "band": band_val,
            "impact": impact,
            "why": why_str,
            "reasons": reasons_list,
            "top_paths": top_p,
        })

        if impact > max_impact or (impact == max_impact and p_val > crown_p):
            max_impact = impact
            crown_acct_id = acct.id
            crown_p = p_val

    crown_path_data = None
    if crown_acct_id:
        crown_paths = paths_into(graph, crown_acct_id, max_hops=4, limit=1, band_low=band_low, band_high=band_high)
        crown_path_data = {
            "target": crown_acct_id,
            "path": crown_paths[0] if crown_paths else None,
        }

    return {
        "score": mc_metrics["score"],
        "el": mc_metrics["el"],
        "worst": mc_metrics["worst"],
        "headline": head_txt,
        "accounts": accounts_output,
        "spofs": spof_list,
        "crown_path": crown_path_data,
    }
