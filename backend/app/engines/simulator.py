"""Engine 2: Simulator for Chokepoint.

Implements:
2a. Deterministic closure (closure_det) & cascade_rounds
2b. Monte Carlo closure (closure_mc) with Common Random Numbers
2c. Metrics (P_i, EL, worst, score) & evaluate() wrapper
2d. SPOF finder (find_spofs)
2e. Path explorer (paths_into)
2f. Explanations & analyze_core
"""
from __future__ import annotations

import zlib
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np

from app.engines.graph_types import Graph, Node
from app.schemas import Account, CatalogEntry, Settings, State


def closure_det(graph: Graph, forced: Set[str]) -> Dict[str, Any]:
    """Compute deterministic takeover closure per PRD §6 2a.

    Caps are zero-cost; accounts cost one hop per round with snapshot semantics.
    Returns: {"hop": {id: int}, "via": {account_id: str}}
    """
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


def sample_entries(
    graph: Graph,
    settings: Settings,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
) -> Dict[str, np.ndarray]:
    """Sample entry states using Common Random Numbers (CRN) per PRD §6 2b."""
    num_trials = trials or settings.trials
    forced_set = forced or set()
    entry_states: Dict[str, np.ndarray] = {}

    for node in graph.entries():
        if node.id in forced_set:
            entry_states[node.id] = np.ones(num_trials, dtype=bool)
        else:
            seed_val = settings.seed
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
    trials: int = 2000,
) -> Dict[str, np.ndarray]:
    """Vectorized Monte Carlo fixed-point sweep per PRD §6 2b."""
    forced_set = forced or set()
    node_states: Dict[str, np.ndarray] = {}

    for nid in graph.order:
        node = graph.nodes[nid]
        if nid in forced_set:
            node_states[nid] = np.ones(trials, dtype=bool)
        elif node.kind == "entry":
            node_states[nid] = entry_state.get(nid, np.zeros(trials, dtype=bool))
        else:
            node_states[nid] = np.zeros(trials, dtype=bool)

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
            any_method = np.zeros(trials, dtype=bool)
            for m in node.methods:
                if not m.requires:
                    continue
                req_and = np.ones(trials, dtype=bool)
                for req in m.requires:
                    req_and &= node_states.get(req, np.zeros(trials, dtype=bool))
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
    settings: Settings,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute takeover probabilities, Expected Loss (EL), worst EL, and score per PRD §6 2c."""
    num_trials = trials or settings.trials
    forced_set = forced or set()

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
    settings: Settings,
    forced: Optional[Set[str]] = None,
    trials: Optional[int] = None,
) -> Dict[str, Any]:
    """Public wrapper called by Engine 3 (Planner and Scenarios)."""
    return metrics(graph, settings, forced=forced, trials=trials)


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
    band_low: float = 0.15,
    band_high: float = 0.40,
) -> List[Dict[str, Any]]:
    """Backward path explorer per PRD §6 2e.

    Outputs: [{entries, steps: [{node, hop, via}], likelihood, band, cut_fix_id}]
    """
    target_node_id = f"ACC:{target_account_id}" if not target_account_id.startswith("ACC:") else target_account_id
    if target_node_id not in graph.nodes:
        return []

    # Derivations exploration: BFS/backward expansion from target
    # A path is a combination of entries that can trigger the target
    # Let's find simple minimal entry subsets with intermediate account steps
    raw_paths: List[Dict[str, Any]] = []

    def get_band(p_val: float) -> str:
        if p_val < band_low:
            return "low"
        if p_val < band_high:
            return "medium"
        return "high"

    # Backward search on methods
    visited_methods: Set[str] = set()

    def explore(
        curr_id: str,
        visited_nodes: Tuple[str, ...],
        current_steps: Tuple[Dict[str, Any], ...],
        hop_count: int,
    ) -> List[Dict[str, Any]]:
        if hop_count > max_hops or curr_id in visited_nodes:
            return []

        curr_node = graph.nodes.get(curr_id)
        if not curr_node:
            return []

        if curr_node.kind == "entry":
            return [{
                "entries": [curr_id],
                "steps": list(current_steps),
                "hints": [curr_node.fix_hint] if curr_node.fix_hint else [],
                "p_prod": curr_node.p or 0.1,
            }]

        results = []
        new_visited = visited_nodes + (curr_id,)

        for m in curr_node.methods:
            sub_results_per_req: List[List[Dict[str, Any]]] = []
            for req in m.requires:
                # Add step if curr_node is account
                new_steps = current_steps
                next_hop = hop_count
                if curr_node.kind == "account":
                    acct_id_clean = curr_node.id.replace("ACC:", "")
                    step_entry = {
                        "node": acct_id_clean,
                        "hop": hop_count + 1,
                        "via": m.label,
                    }
                    new_steps = (step_entry,) + current_steps
                    next_hop = hop_count + 1

                req_paths = explore(req, new_visited, new_steps, next_hop)
                if not req_paths:
                    sub_results_per_req = []
                    break
                sub_results_per_req.append(req_paths[:10])

            if sub_results_per_req:
                # Combine first result for each req
                combined_entries = set()
                combined_hints = list(m.fix_hints)
                combined_steps = list(new_steps)
                p_prod = 1.0

                for r_list in sub_results_per_req:
                    if r_list:
                        top_sub = r_list[0]
                        combined_entries.update(top_sub["entries"])
                        combined_hints.extend(top_sub.get("hints", []))
                        p_prod *= top_sub.get("p_prod", 1.0)
                        for st in top_sub.get("steps", []):
                            if st not in combined_steps:
                                combined_steps.append(st)

                results.append({
                    "entries": sorted(combined_entries),
                    "steps": sorted(combined_steps, key=lambda s: s.get("hop", 0)),
                    "hints": combined_hints,
                    "p_prod": p_prod,
                })

        return results

    raw_candidates = explore(target_node_id, (), (), 0)

    # Deduplicate by frozenset of entries and build final path models
    seen_entry_sets = set()
    final_paths = []

    for cand in raw_candidates:
        f_entries = frozenset(cand["entries"])
        if not f_entries or f_entries in seen_entry_sets:
            continue
        seen_entry_sets.add(f_entries)

        # Likelihood product of entries
        likelihood = 1.0
        for e in cand["entries"]:
            e_node = graph.get(e)
            if e_node and e_node.p is not None:
                likelihood *= e_node.p
            else:
                likelihood *= 0.1

        likelihood = round(likelihood, 4)

        # Select cut_fix_id: lowest-effort hint, ties first on path
        hints = [h for h in cand["hints"] if h]
        effort_order = {"low": 1, "medium": 2, "high": 3}
        if hints:
            hints.sort(key=lambda h: effort_order.get(fix_effort(h), 2))
            cut_fix_id = hints[0]
        else:
            cut_fix_id = "sim_lock" if "E_SIM" in cand["entries"] else "device_lock"

        final_paths.append({
            "entries": cand["entries"],
            "steps": cand["steps"],
            "likelihood": likelihood,
            "band": get_band(likelihood),
            "cut_fix_id": cut_fix_id,
        })

    final_paths.sort(key=lambda p: p["likelihood"], reverse=True)
    return final_paths[:limit]


def find_spofs(
    graph: Graph,
    settings: Settings,
    accounts_by_id: Optional[Dict[str, Account]] = None,
    top: int = 8,
) -> List[Dict[str, Any]]:
    """Find Single Points of Failure per PRD §6 2d.

    Candidates: E_SIM, E_PHONE, each password group >= 2, each account.
    """
    base_metrics = metrics(graph, settings, trials=settings.trials)
    base_el = base_metrics["el"]
    spofs: List[Dict[str, Any]] = []

    # Password groups
    groups_members: Dict[str, List[str]] = {}
    for node in graph.nodes.values():
        if node.kind == "entry" and node.id.startswith("E_LEAK:"):
            grp = node.meta.get("group")
            if grp:
                groups_members.setdefault(grp, []).append(node.id)

    candidates: List[Tuple[str, str, str, Set[str]]] = [
        ("E_SIM", "Your phone number (SIM swap)", "entry", {"E_SIM"}),
        ("E_PHONE", "Your phone (lost or stolen)", "entry", {"E_PHONE"}),
    ]

    for grp, leak_nodes in groups_members.items():
        if len(leak_nodes) >= 2:
            candidates.append((
                f"GROUP:{grp}",
                f"Shared password '{grp}'",
                "group",
                set(leak_nodes),
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

    for cand_id, label, kind, forced_set in candidates:
        det_res = closure_det(graph, forced=forced_set)
        taken_accounts = [
            nid.replace("ACC:", "")
            for nid, h in det_res["hop"].items()
            if h > 0 and nid.startswith("ACC:") and (nid != f"ACC:{cand_id}" and nid != cand_id)
        ]
        falls_count = len(taken_accounts)

        mc_res = metrics(graph, settings, forced=forced_set, trials=settings.trials)
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


def explain_account(
    acct: Account,
    p_val: float,
    band: str,
    top_paths: List[Dict[str, Any]],
    catalog: Optional[Any] = None,
) -> Tuple[str, List[str]]:
    """Generate template-based explanation and facts reasons list (PRD §6 2f)."""
    pct = int(round(p_val * 100))
    reasons: List[str] = []

    if acct.password_group:
        reasons.append(f"reuses password in group '{acct.password_group}'")
    if acct.second_factor in ("none", "sms"):
        reasons.append(f"weak 2FA ({acct.second_factor})")
    if acct.breach_flag:
        reasons.append("credentials flagged in breach")
    for perm in acct.permissions:
        if perm in ("sms", "photos") or perm.startswith("email_inbox:"):
            reasons.append(f"permission '{perm}'")

    # Step descriptions for routes
    r1_text = ""
    r2_text = ""
    cut_title = "tightening account authentication"

    if top_paths:
        p0 = top_paths[0]
        steps = [s["node"] for s in p0.get("steps", [])]
        if steps:
            r1_text = f"Easiest route: {' → '.join(p0.get('entries', []))} → {' → '.join(steps)}."
        else:
            r1_text = f"Easiest route: direct via {p0.get('entries', ['credentials'])[0]}."

        cut_fix = p0.get("cut_fix_id", "")
        if cut_fix == "sim_lock":
            cut_title = "turning on carrier SIM lock"
        elif cut_fix.startswith("2fa:"):
            cut_title = f"upgrading 2FA on {acct.name}"
        elif cut_fix.startswith("rm_login:"):
            cut_title = f"removing SMS OTP login on {acct.name}"

    if len(top_paths) > 1:
        p1 = top_paths[1]
        steps2 = [s["node"] for s in p1.get("steps", [])]
        if steps2:
            r2_text = f" Alternate route: {' → '.join(p1.get('entries', []))} → {' → '.join(steps2)}."

    sentence = f"{acct.name} has a {band} takeover likelihood ({pct}%). {r1_text}{r2_text} Biggest single reduction: {cut_title}."
    return sentence, reasons


def headline(spofs: List[Dict[str, Any]], n_accounts: int) -> str:
    """Generate headline summary sentence from top SPOF per PRD §6 2f."""
    if not spofs:
        return "Your accounts have low exposure to cascading takeovers."
    top_spof = spofs[0]
    falls = top_spof["falls"]
    kind = top_spof["kind"]

    if top_spof["id"] == "E_SIM":
        return f"Your phone number alone can take over {falls} of your {n_accounts} accounts."
    if top_spof["id"] == "E_PHONE":
        return f"Your physical phone alone can access {falls} of your {n_accounts} accounts."
    if kind == "group":
        g_name = top_spof["id"].replace("GROUP:", "")
        return f"One leaked password ('{g_name}') can take over {falls} of your {n_accounts} accounts."
    return f"If {top_spof['label']} is compromised, {falls} of your other accounts fall."


def analyze_core(
    graph: Graph,
    state: State,
    catalog: Optional[Any],
    settings: Settings,
) -> Dict[str, Any]:
    """Execute complete core analysis per PRD §6 2f and §7."""
    accounts_by_id = {a.id: a for a in state.accounts}
    mc_metrics = metrics(graph, settings, trials=settings.trials)
    spof_list = find_spofs(graph, settings, accounts_by_id=accounts_by_id, top=8)
    head_txt = headline(spof_list, len(state.accounts))

    accounts_output = []
    max_impact = -1
    crown_acct_id = None
    crown_p = -1.0

    def get_band(p_val: float) -> str:
        if p_val < settings.band_low:
            return "low"
        if p_val < settings.band_high:
            return "medium"
        return "high"

    for acct in state.accounts:
        p_val = mc_metrics["p"].get(acct.id, 0.0)
        band_val = get_band(p_val)
        a_node = graph.get(f"ACC:{acct.id}")
        impact = a_node.meta.get("impact", 1) if a_node else 1

        top_p = paths_into(graph, acct.id, max_hops=4, limit=2)
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

        # Track crown jewel (max impact, ties by higher P)
        if impact > max_impact or (impact == max_impact and p_val > crown_p):
            max_impact = impact
            crown_acct_id = acct.id
            crown_p = p_val

    crown_path_data = None
    if crown_acct_id:
        crown_paths = paths_into(graph, crown_acct_id, max_hops=4, limit=1)
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
