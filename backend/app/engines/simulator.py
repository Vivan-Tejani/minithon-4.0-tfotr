from __future__ import annotations

import functools
import zlib
from typing import Any
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

def closure_det(graph: Graph, forced: set[str] | list[str] | None = None) -> dict[str, Any]:
    """Computes the deterministic takeover closure given a set of forced node IDs.

    Follows PRD §6 2a exact round semantics:
    - Capabilities are zero-cost (settled iteratively within rounds).
    - One hop per account round with snapshot semantics.
    - via[account_id] is the label of the first satisfied method in method order.

    Returns:
        {"hop": {node_id: int}, "via": {account_id: str}}
    """
    forced_set = set(forced) if forced else set()
    true_nodes: set[str] = set(forced_set)
    hop: dict[str, int] = {f: 0 for f in forced_set}
    via: dict[str, str] = {}

    def settle_caps() -> None:
        """Iteratively settles non-account nodes (capabilities/entries) at zero hop cost."""
        changed = True
        while changed:
            changed = False
            for n_id in graph.order:
                node = graph.nodes.get(n_id)
                if node is None or node.kind == "account" or n_id in true_nodes:
                    continue
                for m in node.methods:
                    if m.requires and all(req in true_nodes for req in m.requires):
                        true_nodes.add(n_id)
                        hop[n_id] = 0
                        changed = True
                        break

    settle_caps()
    r = 0
    while True:
        r += 1
        newly: list[tuple[str, str]] = []
        # Snapshot semantics: evaluate accounts against true_nodes at the start of this round
        for n_id in graph.order:
            node = graph.nodes.get(n_id)
            if node is None or node.kind != "account" or n_id in true_nodes:
                continue
            for m in node.methods:
                if m.requires and all(req in true_nodes for req in m.requires):
                    newly.append((n_id, m.label))
                    break

        if not newly:
            break

        for a_id, m_label in newly:
            true_nodes.add(a_id)
            hop[a_id] = r
            via[a_id] = m_label

        settle_caps()

    return {"hop": hop, "via": via}


def cascade_rounds(result: dict[str, Any]) -> list[dict[str, Any]]:
    """Groups deterministic closure results into sequential rounds for UI animation.

    Output format:
        [{"round": 1, "accounts": [{"id": "gmail", "via": "Recovery by SMS code"}]}, ...]
    """
    hop_dict: dict[str, int] = result.get("hop", {})
    via_dict: dict[str, str] = result.get("via", {})

    rounds_map: dict[int, list[dict[str, str]]] = {}
    for a_id, m_label in via_dict.items():
        r = hop_dict.get(a_id, 1)
        if r <= 0:
            continue
        clean_id = a_id.replace("ACC:", "")
        rounds_map.setdefault(r, []).append({"id": clean_id, "via": m_label})

    output: list[dict[str, Any]] = []
    for r in sorted(rounds_map.keys()):
        # Sort accounts deterministically within round
        sorted_accs = sorted(rounds_map[r], key=lambda x: x["id"])
        output.append({"round": r, "accounts": sorted_accs})

    return output


# =====================================================================
# Ticket M2-02: Monte Carlo Closure + Metrics + evaluate()
# =====================================================================

def sample_entries(
    graph: Graph,
    settings: Any,
    forced_ids: set[str] | None = None,
    trials: int | None = None,
) -> dict[str, np.ndarray]:
    """Samples entry point states using Common Random Numbers (CRN).

    Entry sampling uses np.random.default_rng([seed, zlib.crc32(entry_id.encode())])
    so that random worlds are identically reused across graph edits and fix evaluations.
    """
    if hasattr(settings, "seed"):
        seed = settings.seed
    elif isinstance(settings, dict):
        seed = settings.get("seed", 42)
    else:
        seed = 42

    if trials is None:
        if hasattr(settings, "trials"):
            trials = settings.trials
        elif isinstance(settings, dict):
            trials = settings.get("trials", 2000)
        else:
            trials = 2000

    forced_set = set(forced_ids) if forced_ids else set()
    entry_states: dict[str, np.ndarray] = {}

    for entry in graph.entries():
        entry_seed = [int(seed), zlib.crc32(entry.id.encode("utf-8"))]
        rng = np.random.default_rng(entry_seed)
        u = rng.random(trials)
        p = entry.p if entry.p is not None else 0.0
        state = u < p
        if entry.id in forced_set:
            state[:] = True
        entry_states[entry.id] = state

    return entry_states


def closure_mc(
    graph: Graph,
    entry_state: dict[str, np.ndarray],
    forced: set[str] | list[str] | None = None,
) -> dict[str, np.ndarray]:
    """Runs vectorized Monte Carlo fixed-point sweeps over boolean arrays (trials,).

    Performs monotone sweeps over graph.order until nothing changes (maximum 12 sweeps).
    """
    forced_set = set(forced) if forced else set()
    if entry_state:
        trials = len(next(iter(entry_state.values())))
    else:
        trials = 2000

    taken: dict[str, np.ndarray] = {}
    for n_id in graph.order:
        if n_id in forced_set:
            taken[n_id] = np.ones(trials, dtype=bool)
        elif n_id in entry_state:
            taken[n_id] = entry_state[n_id].copy()
        else:
            taken[n_id] = np.zeros(trials, dtype=bool)

    # Monotone fixed-point sweeps
    for _ in range(12):
        changed = False
        for n_id in graph.order:
            node = graph.nodes.get(n_id)
            if node is None or node.kind == "entry":
                continue
            curr = taken[n_id]
            if np.all(curr):
                continue

            method_conds: list[np.ndarray] = []
            for m in node.methods:
                if not m.requires:
                    method_conds.append(np.ones(trials, dtype=bool))
                else:
                    req_all = taken[m.requires[0]].copy()
                    for req in m.requires[1:]:
                        req_all &= taken[req]
                    method_conds.append(req_all)

            if method_conds:
                new_sat = method_conds[0]
                for cond in method_conds[1:]:
                    new_sat = new_sat | cond
                updated = curr | new_sat
                if not np.array_equal(updated, curr):
                    taken[n_id] = updated
                    changed = True

        if not changed:
            break

    return taken


def metrics(
    graph: Graph,
    settings: Any,
    forced: set[str] | list[str] | None = None,
    trials: int | None = None,
) -> dict[str, Any]:
    """Calculates privacy risk metrics: P_i, Expected Loss (EL), worst EL, and Privacy Score.

    Formulas per PRD §6 2c:
    - P_i = mean(taken_i)
    - EL = sum(P_i * impact_i)
    - worst = sum(impact_i)
    - score = round(100 * (1 - EL / worst))
    """
    forced_set = set(forced) if forced else set()
    entry_state = sample_entries(graph, settings, forced_ids=forced_set, trials=trials)
    taken = closure_mc(graph, entry_state, forced=forced_set)

    p_dict: dict[str, float] = {}
    el = 0.0
    worst = 0.0

    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        prob = float(np.mean(taken[acc.id]))
        p_dict[clean_id] = round(prob, 4)
        impact = float(acc.meta.get("impact", 1))
        el += prob * impact
        worst += impact

    if worst > 0:
        score = int(round(100.0 * (1.0 - (el / worst))))
        score = max(0, min(100, score))
    else:
        score = 100

    return {
        "p": p_dict,
        "el": round(el, 2),
        "worst": round(worst, 2),
        "score": score,
    }


def evaluate(
    graph: Graph,
    settings: Any,
    forced: set[str] | list[str] | None = None,
    trials: int | None = None,
) -> dict[str, Any]:
    """Public wrapper called by Engine 3 (Fix Planner) and Engine 4 (Scenario Engine).

    Args:
        graph: Takeover Graph
        settings: Settings object or dict (containing seed, trials, etc.)
        forced: Optional set of node IDs forced to True
        trials: Optional trial count override (e.g. 1000 for fast planner runs)

    Returns:
        dict: {"p": {account_id: float}, "el": float, "worst": float, "score": int}
    """
    return metrics(graph, settings, forced=forced, trials=trials)


# =====================================================================
# Ticket M2-03: SPOF Finder
# =====================================================================

def find_spofs(
    graph: Graph,
    settings: Any,
    accounts_by_id: dict[str, Any] | None = None,
    top: int = 8,
) -> list[dict[str, Any]]:
    """Identifies Single Points of Failure (SPOFs) ranked by expected loss increase (d_el).

    Candidates per PRD §6 2d:
    - E_SIM
    - E_PHONE
    - Each password group with >= 2 members (forces each member's CAP_PW)
    - Each individual account

    Returns top candidates sorted by d_el descending, ties by falls descending.
    """
    base_metrics = metrics(graph, settings)
    base_el = base_metrics["el"]

    candidates: list[dict[str, Any]] = []

    # 1. Entry candidates
    if "E_SIM" in graph.nodes:
        candidates.append({
            "id": "E_SIM",
            "label": "Your phone number (SIM swap)",
            "kind": "entry",
            "forced": {"E_SIM"},
        })
    if "E_PHONE" in graph.nodes:
        candidates.append({
            "id": "E_PHONE",
            "label": "Your phone (lost or stolen)",
            "kind": "entry",
            "forced": {"E_PHONE"},
        })

    # 2. Password group candidates (>= 2 members)
    groups: dict[str, list[str]] = {}
    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        group = None
        if accounts_by_id and clean_id in accounts_by_id:
            raw_acc = accounts_by_id[clean_id]
            group = getattr(raw_acc, "password_group", None) if not isinstance(raw_acc, dict) else raw_acc.get("password_group")
        if not group:
            group = acc.meta.get("password_group")
        if group:
            groups.setdefault(str(group), []).append(clean_id)

    for g_label, members in groups.items():
        if len(members) >= 2:
            # Force every member's CAP_PW node
            pw_caps = set()
            for m in members:
                cap_id = f"CAP_PW:{m}"
                if cap_id in graph.nodes:
                    pw_caps.add(cap_id)
            if not pw_caps:
                # Fallback: force the accounts or entries if caps not directly named
                pw_caps = {f"ACC:{m}" for m in members}

            candidates.append({
                "id": f"GROUP:{g_label}",
                "label": f"Shared password '{g_label}'",
                "kind": "group",
                "forced": pw_caps,
                "group_label": g_label,
            })

    # 3. Account candidates
    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        name = acc.meta.get("name", clean_id)
        candidates.append({
            "id": acc.id,
            "label": f"{name} account",
            "kind": "account",
            "forced": {acc.id},
            "target_account_id": acc.id,
        })

    spofs: list[dict[str, Any]] = []
    for cand in candidates:
        forced_nodes = cand["forced"]
        det_res = closure_det(graph, forced=forced_nodes)
        taken_hops = det_res["hop"]

        # Collect fallen accounts
        fallen: set[str] = set()
        for nid, h in taken_hops.items():
            node = graph.nodes.get(nid)
            if node and node.kind == "account":
                fallen.add(nid)

        # Exclude candidate itself if it is an account
        if cand["kind"] == "account":
            fallen.discard(cand["id"])

        falls_ids = sorted([aid.replace("ACC:", "") for aid in fallen])
        falls = len(falls_ids)

        # Evaluate marginal EL change
        cand_metrics = metrics(graph, settings, forced=forced_nodes)
        d_el = round(max(0.0, cand_metrics["el"] - base_el), 2)

        spofs.append({
            "id": cand["id"].replace("ACC:", ""),
            "label": cand["label"],
            "kind": cand["kind"],
            "falls": falls,
            "falls_ids": falls_ids,
            "d_el": d_el,
        })

    # Sort by d_el desc, ties by falls desc
    spofs.sort(key=lambda s: (s["d_el"], s["falls"]), reverse=True)
    return spofs[:top]


# =====================================================================
# Ticket M2-04: Path Explorer
# =====================================================================

def fix_effort(fix_id: str) -> str:
    """Returns the effort level ('low', 'medium', 'high') for a fix ID per PRD §6 Engine 3."""
    if not fix_id:
        return "low"
    if fix_id in ("sim_lock", "device_lock"):
        return "low"
    if fix_id.startswith("rm_login:") or fix_id.startswith("rm_recovery:") or fix_id.startswith("revoke:"):
        return "low"
    if fix_id.startswith("2fa:") or fix_id.startswith("delete:"):
        return "medium"
    if fix_id.startswith("unique_pw:"):
        return "medium"
    return "low"


_EFFORT_RANK = {"low": 1, "medium": 2, "high": 3}


def paths_into(
    graph: Graph,
    target_account_id: str,
    max_hops: int = 4,
    limit: int = 5,
    settings: Any = None,
) -> list[dict[str, Any]]:
    """Explores minimal attack paths into target_account_id via backward derivation search.

    Returns:
        list of {"entries": [str], "steps": [{"node": str, "hop": int, "via": str}],
                 "likelihood": float, "band": str, "cut_fix_id": str}
    """
    target_nid = target_account_id if target_account_id.startswith("ACC:") else f"ACC:{target_account_id}"
    if target_nid not in graph.nodes:
        target_nid = target_account_id
        if target_nid not in graph.nodes:
            return []

    band_low = 0.15
    band_high = 0.40
    if settings:
        if hasattr(settings, "band_low"):
            band_low = settings.band_low
            band_high = settings.band_high
        elif isinstance(settings, dict):
            band_low = settings.get("band_low", 0.15)
            band_high = settings.get("band_high", 0.40)

    # Recursive backward search with cycle avoidance
    # Derivation tuple: (frozenset[entry_ids], tuple[steps], tuple[fix_hints], max_account_hop)
    memo: dict[tuple[str, frozenset[str]], list[tuple[frozenset[str], tuple[dict[str, Any], ...], tuple[str, ...], int]]] = {}

    def get_derivations(
        node_id: str,
        visited: frozenset[str],
    ) -> list[tuple[frozenset[str], tuple[dict[str, Any], ...], tuple[str, ...], int]]:
        key = (node_id, visited)
        if key in memo:
            return memo[key]

        node = graph.nodes.get(node_id)
        if node is None:
            return []

        # Base case: Entry node
        if node.kind == "entry":
            hint = (node.fix_hint,) if node.fix_hint else ()
            return [(frozenset([node.id]), (), hint, 0)]

        results: list[tuple[frozenset[str], tuple[dict[str, Any], ...], tuple[str, ...], int]] = []
        new_visited = visited | {node_id}

        for m in node.methods:
            if not m.requires:
                continue

            # Check if any requirement is in visited (cycle)
            if any(r in visited for r in m.requires):
                continue

            # Cross-product of derivations of all required nodes
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

            # Compute cross product
            combos = [([], (), (), 0)]
            for r_derivs in req_derivations:
                next_combos = []
                for existing_entries, existing_steps, existing_hints, existing_hop in combos:
                    for r_entries, r_steps, r_hints, r_hop in r_derivs:
                        combined_entries = set(existing_entries) | set(r_entries)
                        # Merge steps
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

            # If current node is an account, add a step and increment hop
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

        # Cap partial derivations at 30 per node
        results.sort(key=lambda d: (-len(d[0]), d[3]))
        memo[key] = results[:30]
        return memo[key]

    raw_derivations = get_derivations(target_nid, frozenset())

    # Filter minimal derivations and drop supersets
    paths: list[dict[str, Any]] = []
    seen_entry_sets: set[frozenset[str]] = set()

    # Sort candidate derivations by fewest entries and lowest hop
    sorted_derivs = sorted(raw_derivations, key=lambda d: (len(d[0]), d[3]))

    for entry_set, steps, hints, _ in sorted_derivs:
        if not entry_set:
            continue

        # Drop supersets
        if any(es.issubset(entry_set) and es != entry_set for es in seen_entry_sets):
            continue
        if entry_set in seen_entry_sets:
            continue
        seen_entry_sets.add(entry_set)

        # Calculate likelihood = product of entry probabilities
        likelihood = 1.0
        for e_id in entry_set:
            e_node = graph.nodes.get(e_id)
            p = e_node.p if (e_node and e_node.p is not None) else 1.0
            likelihood *= p

        # Risk band
        if likelihood < band_low:
            band = "low"
        elif likelihood < band_high:
            band = "medium"
        else:
            band = "high"

        # Determine cut_fix_id: lowest effort hint, ties: first on the path
        best_fix = ""
        best_rank = 999
        for h in hints:
            rank = _EFFORT_RANK.get(fix_effort(h), 2)
            if rank < best_rank:
                best_rank = rank
                best_fix = h

        paths.append({
            "entries": sorted(list(entry_set)),
            "steps": list(steps),
            "likelihood": round(likelihood, 4),
            "band": band,
            "cut_fix_id": best_fix or "sim_lock",
        })

    # Sort final paths by likelihood descending, then fewest steps
    paths.sort(key=lambda p: (p["likelihood"], -len(p["steps"])), reverse=True)
    return paths[:limit]


# =====================================================================
# Ticket M2-05: Explanations + analyze_core
# =====================================================================

def headline(spofs: list[dict[str, Any]], n_accounts: int) -> str:
    """Generates the primary dashboard headline sentence from the top SPOF."""
    if not spofs:
        return f"Evaluated {n_accounts} accounts with no single points of failure found."

    top_spof = spofs[0]
    falls = top_spof.get("falls", 0)
    kind = top_spof.get("kind", "")
    spof_id = top_spof.get("id", "")
    label = top_spof.get("label", "")

    if kind == "entry":
        if "SIM" in label or spof_id == "E_SIM":
            return f"Your phone number alone can take over {falls} of your {n_accounts} accounts."
        return f"Your {label.lower()} alone can take over {falls} of your {n_accounts} accounts."
    elif kind == "group":
        g_name = top_spof.get("group_label") or label.replace("Shared password '", "").replace("'", "")
        return f"One leaked password ('{g_name}') can take over {falls} of your {n_accounts} accounts."
    else:
        clean_name = label.replace(" account", "")
        return f"If {clean_name} is compromised, {falls} of your other accounts fall."


def explain_account(
    name: str,
    band: str,
    p: float,
    top_paths: list[dict[str, Any]],
    best_fix_title: str | None = None,
    reasons: list[str] | None = None,
) -> str:
    """Generates a plain-English explanation sentence for an account per PRD §6 2f."""
    pct = int(round(p * 100))
    routes_text = ""
    if top_paths:
        first_steps = " -> ".join([s["node"] for s in top_paths[0]["steps"]]) or "direct access"
        routes_text = f"Easiest route: {first_steps}."
        if len(top_paths) > 1:
            second_steps = " -> ".join([s["node"] for s in top_paths[1]["steps"]]) or "alternative access"
            routes_text += f" Second route: {second_steps}."

    fix_text = f" Biggest single reduction: {best_fix_title}." if best_fix_title else ""
    return f"{name} has a {band} takeover likelihood ({pct}%). {routes_text}{fix_text}".strip()


def analyze_core(
    graph: Graph,
    state: Any,
    catalog: Any,
    settings: Any,
) -> dict[str, Any]:
    """Core analysis orchestrator for Engine 2.

    Returns:
        dict matching PRD §7 GET /analysis:
        {"score": int, "el": float, "worst": float, "headline": str,
         "accounts": [AccountAnalysis], "spofs": [Spof], "crown_path": CrownPath}
    """
    accounts_by_id = {}
    if hasattr(state, "accounts"):
        for a in state.accounts:
            aid = getattr(a, "id", None)
            if aid:
                accounts_by_id[aid] = a

    # 1. Base metrics
    base = metrics(graph, settings)
    score = base["score"]
    el = base["el"]
    worst = base["worst"]
    p_by_account = base["p"]

    # 2. SPOFs
    spofs = find_spofs(graph, settings, accounts_by_id=accounts_by_id, top=8)

    # 3. Headline
    num_accounts = len(graph.accounts())
    hd = headline(spofs, num_accounts)

    # 4. Password group lookup for reasons
    group_members: dict[str, list[str]] = {}
    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        g = None
        if clean_id in accounts_by_id:
            raw_acc = accounts_by_id[clean_id]
            g = getattr(raw_acc, "password_group", None) if not isinstance(raw_acc, dict) else raw_acc.get("password_group")
        if not g:
            g = acc.meta.get("password_group")
        if g:
            group_members.setdefault(str(g), []).append(clean_id)

    # 5. Account analysis items
    accounts_analysis: list[dict[str, Any]] = []
    max_impact = -1.0
    crown_acc_id = ""
    crown_top_path = None

    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        p = p_by_account.get(clean_id, 0.0)

        # Risk band
        band_low = getattr(settings, "band_low", 0.15) if hasattr(settings, "band_low") else 0.15
        band_high = getattr(settings, "band_high", 0.40) if hasattr(settings, "band_high") else 0.40
        if p < band_low:
            band = "low"
        elif p < band_high:
            band = "medium"
        else:
            band = "high"

        impact = int(acc.meta.get("impact", 1))
        name = acc.meta.get("name", clean_id)

        # Top paths
        all_paths = paths_into(graph, clean_id, max_hops=4, limit=2, settings=settings)

        # Crown jewel tracking (highest impact, tie break by higher p)
        if impact > max_impact or (impact == max_impact and p > p_by_account.get(crown_acc_id, 0.0)):
            max_impact = impact
            crown_acc_id = clean_id
            crown_top_path = all_paths[0] if all_paths else None

        # Build reasons list from facts
        reasons: list[str] = []
        raw_obj = accounts_by_id.get(clean_id)
        if raw_obj:
            pw_group = getattr(raw_obj, "password_group", None) if not isinstance(raw_obj, dict) else raw_obj.get("password_group")
            if pw_group and len(group_members.get(str(pw_group), [])) > 1:
                others = [m for m in group_members[str(pw_group)] if m != clean_id]
                reasons.append(f"reuses password group '{pw_group}' with {', '.join(others)}")

            second_factor = getattr(raw_obj, "second_factor", "none") if not isinstance(raw_obj, dict) else raw_obj.get("second_factor", "none")
            if second_factor == "none":
                reasons.append("no second factor")
            elif second_factor == "sms":
                reasons.append("SMS 2FA vulnerable to SIM swap")

            breach_flag = getattr(raw_obj, "breach_flag", False) if not isinstance(raw_obj, dict) else raw_obj.get("breach_flag", False)
            if breach_flag:
                reasons.append("flagged in known breach")

            perms = getattr(raw_obj, "permissions", []) if not isinstance(raw_obj, dict) else raw_obj.get("permissions", [])
            for perm in perms:
                if perm == "sms":
                    reasons.append("app has permission to read SMS")
                elif str(perm).startswith("email_inbox"):
                    reasons.append(f"app has permission to read email inbox ({perm})")

        why_text = explain_account(name, band, p, all_paths, reasons=reasons)

        accounts_analysis.append({
            "id": clean_id,
            "name": name,
            "p": p,
            "band": band,
            "impact": impact,
            "why": why_text,
            "reasons": reasons,
            "top_paths": all_paths,
        })

    # Crown path object
    crown_path_obj = {
        "target": crown_acc_id or (accounts_analysis[0]["id"] if accounts_analysis else ""),
        "path": crown_top_path,
    }

    return {
        "score": score,
        "el": el,
        "worst": worst,
        "headline": hd,
        "accounts": accounts_analysis,
        "spofs": spofs,
        "crown_path": crown_path_obj,
    }
