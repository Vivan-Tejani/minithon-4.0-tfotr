"""Engine 4: Scenario and Review Engine."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from backend.app.data.loader import Account, CatalogEntry, Settings, State, load_catalog

DB_DIR = Path(__file__).resolve().parent.parent.parent / ".data"
DB_PATH = DB_DIR / "chokepoint.db"

SeverityType = Literal["high", "medium", "low"]
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

DATA_WEIGHTS = {
    "payment": 10,
    "government_id": 9,
    "health": 8,
    "financial_records": 8,
    "private_messages": 6,
    "work_data": 5,
    "photos": 5,
    "contacts": 3,
    "location_history": 3,
    "profile_only": 1,
}

PERMISSION_WEIGHTS = {
    "sms": 6,
    "email_inbox": 6,
    "camera": 4,
    "microphone": 4,
    "photos": 4,
    "files": 4,
    "contacts": 3,
    "location": 3,
}


def account_impact(account: Account) -> int:
    """Calculate impact weight per PRD §5.6."""
    if account.importance_override is not None:
        return account.importance_override
    weights = [1]
    for d in account.data_held:
        weights.append(DATA_WEIGHTS.get(d, 1))
    for p in account.permissions:
        base_perm = p.split(":")[0]
        weights.append(PERMISSION_WEIGHTS.get(base_perm, 1))
    return max(weights)


@dataclass
class ReviewItem:
    id: str
    kind: Literal[
        "stale_account",
        "unused_backup_email",
        "weak_2fa",
        "reuse",
        "periodic_review",
    ]
    title: str
    detail: str
    target: str
    severity: SeverityType
    fix_id: str | None = None
    dependents: list[str] | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.dependents is None:
            d.pop("dependents", None)
        return d


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Initialize SQLite database for events and snapshots."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            detail_json TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            score INTEGER NOT NULL,
            el REAL NOT NULL,
            label TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def add_snapshot(
    score: int,
    el: float,
    label: str,
    ts: str | None = None,
    db_path: Path = DB_PATH,
) -> dict[str, Any]:
    """Record a snapshot into the database."""
    conn = init_db(db_path)
    now_ts = ts or datetime.utcnow().isoformat() + "Z"
    cur = conn.execute(
        "INSERT INTO snapshots (ts, score, el, label) VALUES (?, ?, ?, ?)",
        (now_ts, score, round(el, 2), label),
    )
    conn.commit()
    sid = cur.lastrowid
    conn.close()
    return {
        "id": sid,
        "ts": now_ts,
        "score": score,
        "el": round(el, 2),
        "label": label,
    }


def get_snapshots(db_path: Path = DB_PATH) -> list[dict[str, Any]]:
    """Retrieve ordered snapshots for trend display."""
    conn = init_db(db_path)
    cur = conn.execute("SELECT id, ts, score, el, label FROM snapshots ORDER BY id ASC")
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "ts": r[1],
            "score": r[2],
            "el": r[3],
            "label": r[4],
        }
        for r in rows
    ]


def add_event(
    kind: str,
    title: str,
    detail: dict | str = "",
    ts: str | None = None,
    db_path: Path = DB_PATH,
) -> dict:
    """Add an event to the events log."""
    conn = init_db(db_path)
    now_ts = ts or datetime.utcnow().isoformat() + "Z"
    detail_str = json.dumps(detail) if isinstance(detail, dict) else str(detail)
    cur = conn.execute(
        "INSERT INTO events (ts, kind, title, detail_json) VALUES (?, ?, ?, ?)",
        (now_ts, kind, title, detail_str),
    )
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return {
        "id": event_id,
        "ts": now_ts,
        "kind": kind,
        "title": title,
        "detail": detail,
    }


def get_events(limit: int = 50, db_path: Path = DB_PATH) -> list[dict]:
    """Retrieve latest events from the database."""
    conn = init_db(db_path)
    cur = conn.execute(
        "SELECT id, ts, kind, title, detail_json FROM events ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()

    events = []
    for r in rows:
        try:
            detail = json.loads(r[4])
        except Exception:
            detail = r[4]
        events.append(
            {
                "id": r[0],
                "ts": r[1],
                "kind": r[2],
                "title": r[3],
                "detail": detail,
            }
        )
    return events


def run_review(
    state: State,
    catalog: dict[str, CatalogEntry] | None = None,
    settings: Settings | None = None,
    as_of: str | None = None,
    record_events: bool = True,
    db_path: Path = DB_PATH,
) -> list[ReviewItem]:
    """Execute review engine rules per PRD §6 Engine 4 table."""
    cat_map = catalog if catalog is not None else load_catalog()
    st = settings or state.settings
    as_of_str = (as_of or state.now or "2026-10-01")[:10]
    as_of_date = date.fromisoformat(as_of_str)

    items: list[ReviewItem] = []

    # Map accounts and password groups
    accounts_by_id = {a.id: a for a in state.accounts}
    groups: dict[str, list[Account]] = {}
    for a in state.accounts:
        if a.password_group:
            groups.setdefault(a.password_group, []).append(a)

    # 1. stale_account: as_of - last_activity > stale_days
    # High if it is a recovery/SSO target or in a reuse group, else low
    for a in state.accounts:
        act_date = date.fromisoformat(a.last_activity[:10])
        days_inactive = (as_of_date - act_date).days
        if days_inactive > st.stale_days:
            # Check if recovery/SSO target or in reuse group
            is_recovery_target = any(
                f"email:{a.id}" in x.recovery for x in state.accounts if x.id != a.id
            )
            is_sso_target = any(
                f"sso:{a.id}" in x.login_methods for x in state.accounts if x.id != a.id
            )
            in_reuse_group = bool(a.password_group and len(groups.get(a.password_group, [])) >= 2)

            severity: SeverityType = (
                "high" if (is_recovery_target or is_sso_target or in_reuse_group) else "low"
            )
            items.append(
                ReviewItem(
                    id=f"stale_account:{a.id}",
                    kind="stale_account",
                    title=f"Account '{a.name}' is inactive ({days_inactive} days)",
                    detail=f"Inactive since {a.last_activity}. Consider deleting unused account to reduce exposure.",
                    target=a.id,
                    severity=severity,
                    fix_id=f"delete:{a.id}",
                )
            )

    # 2. unused_backup_email: email-type, recovery/SSO target for >= 1 account, inactive > backup_email_stale_days
    for a in state.accounts:
        if a.type == "email":
            act_date = date.fromisoformat(a.last_activity[:10])
            days_inactive = (as_of_date - act_date).days
            if days_inactive > st.backup_email_stale_days:
                dependents = [
                    x.id
                    for x in state.accounts
                    if (
                        f"email:{a.id}" in x.recovery
                        or f"sso:{a.id}" in x.login_methods
                    )
                ]
                if dependents:
                    first_dep = dependents[0]
                    items.append(
                        ReviewItem(
                            id=f"unused_backup_email:{a.id}",
                            kind="unused_backup_email",
                            title=f"Unused backup email '{a.name}' protects active accounts",
                            detail=f"Inactive for {days_inactive} days while acting as recovery/login for: {', '.join(dependents)}.",
                            target=a.id,
                            severity="high",
                            fix_id=f"rm_recovery:{first_dep}:email:{a.id}",
                            dependents=dependents,
                        )
                    )

    # 3. weak_2fa: impact >= 8 and factor in {none, sms}
    for a in state.accounts:
        impact = account_impact(a)
        if impact >= 8 and a.second_factor in ("none", "sms"):
            items.append(
                ReviewItem(
                    id=f"weak_2fa:{a.id}",
                    kind="weak_2fa",
                    title=f"High-impact account '{a.name}' has weak or missing 2FA",
                    detail=f"Account holds critical data (impact {impact}/10) but uses {a.second_factor} 2FA.",
                    target=a.id,
                    severity="high",
                    fix_id=f"2fa:{a.id}",
                )
            )

    # 4. reuse: group size >= 2
    for g, members in groups.items():
        if len(members) >= 2:
            names = [m.name for m in members]
            items.append(
                ReviewItem(
                    id=f"reuse:{g}",
                    kind="reuse",
                    title=f"Password group '{g}' shared by {len(members)} accounts",
                    detail=f"Shared across: {', '.join(sorted(names))}. Breach of one service exposes all.",
                    target=g,
                    severity="medium",
                    fix_id=f"unique_pw:{g}",
                )
            )

    # 5. periodic_review: as_of - last_review_at > 30 days
    is_periodic_due = False
    if state.last_review_at is None:
        is_periodic_due = True
    else:
        last_rev = date.fromisoformat(state.last_review_at[:10])
        if (as_of_date - last_rev).days > 30:
            is_periodic_due = True

    if is_periodic_due:
        items.append(
            ReviewItem(
                id="periodic_review:general",
                kind="periodic_review",
                title="Periodic security and privacy review due",
                detail="More than 30 days have elapsed since your last review. Inspect your digital footprint.",
                target="general",
                severity="low",
                fix_id=None,
            )
        )

    # Sort items by severity (high -> medium -> low), then by id for stability
    items.sort(key=lambda item: (SEVERITY_ORDER[item.severity], item.id))

    # Record review events once per item per as_of date
    if record_events:
        conn = init_db(db_path)
        cur = conn.execute(
            "SELECT detail_json FROM events WHERE kind = 'review'",
        )
        existing_records = set()
        for row in cur.fetchall():
            try:
                data = json.loads(row[0])
                if isinstance(data, dict):
                    existing_records.add((data.get("item_id"), data.get("as_of")))
            except Exception:
                pass
        conn.close()

        for item in items:
            key = (item.id, as_of_str)
            if key not in existing_records:
                add_event(
                    kind="review",
                    title=item.title,
                    detail={"item_id": item.id, "as_of": as_of_str, "severity": item.severity},
                    ts=datetime.utcnow().isoformat() + "Z",
                    db_path=db_path,
                )
                existing_records.add(key)

    return items


def closure_det(
    state: State,
    catalog: dict[str, CatalogEntry],
    forced: set[str],
) -> dict[str, Any]:
    """Deterministic closure per PRD §6 Engine 2a."""
    try:
        from backend.app.engines.gate_builder import build_graph
        from backend.app.engines.simulator import closure_det as sim_closure
        g = build_graph(state, catalog, state.settings)
        return sim_closure(g, forced)
    except Exception:
        pass

    device_lock = state.anchors.phone.device_lock
    true_nodes = set(forced)
    hop: dict[str, int] = {f: 0 for f in forced}
    via: dict[str, str] = {}

    def settle_caps():
        changed = True
        while changed:
            changed = False
            # CAP_SMS
            if "CAP_SMS" not in true_nodes:
                can_sms = ("E_SIM" in true_nodes) or (not device_lock and "E_PHONE" in true_nodes)
                for a in state.accounts:
                    if "sms" in a.permissions and f"ACC:{a.id}" in true_nodes:
                        can_sms = True
                if can_sms:
                    true_nodes.add("CAP_SMS")
                    changed = True

            # CAP_DEVICE
            if "CAP_DEVICE" not in true_nodes:
                if not device_lock and "E_PHONE" in true_nodes:
                    true_nodes.add("CAP_DEVICE")
                    changed = True

            # CAP_PW:a
            groups: dict[str, list[str]] = {}
            for a in state.accounts:
                if a.password_group:
                    groups.setdefault(a.password_group, []).append(a.id)

            for a in state.accounts:
                cap_pw = f"CAP_PW:{a.id}"
                if cap_pw not in true_nodes:
                    members = groups.get(a.password_group, [a.id]) if a.password_group else [a.id]
                    if any(f"E_LEAK:{m}" in true_nodes for m in members):
                        true_nodes.add(cap_pw)
                        changed = True

            # CAP_INBOX:e
            for a in state.accounts:
                if a.type == "email":
                    cap_inbox = f"CAP_INBOX:{a.id}"
                    if cap_inbox not in true_nodes:
                        can_inbox = f"ACC:{a.id}" in true_nodes
                        for x in state.accounts:
                            if f"email_inbox:{a.id}" in x.permissions and f"ACC:{x.id}" in true_nodes:
                                can_inbox = True
                        if can_inbox:
                            true_nodes.add(cap_inbox)
                            changed = True

    def satisfied(acct: Account) -> tuple[bool, str]:
        cat = catalog.get(acct.service_key)
        factor_caps = []
        if acct.second_factor == "sms":
            factor_caps = ["CAP_SMS"]
        elif acct.second_factor == "authenticator":
            factor_caps = ["CAP_DEVICE"]
        elif acct.second_factor == "hardware_key":
            factor_caps = ["CAP_KEY"]

        # 1. password
        if "password" in acct.login_methods:
            reqs = [f"CAP_PW:{acct.id}"] + factor_caps
            if all(r in true_nodes for r in reqs):
                return True, "Password sign-in"

        # 2. sms_otp
        if "sms_otp" in acct.login_methods:
            if "CAP_SMS" in true_nodes:
                return True, "SMS OTP login"

        # 3. sso:p
        for m in acct.login_methods:
            if m.startswith("sso:"):
                provider = m.split(":", 1)[1]
                if f"ACC:{provider}" in true_nodes:
                    return True, f"Single sign-on via {provider}"

        # 4. recovery email:e
        bypasses = cat.recovery_bypasses_2fa if cat else True
        rec_factor = [] if bypasses else factor_caps

        for r in acct.recovery:
            if r.startswith("email:"):
                email_target = r.split(":", 1)[1]
                reqs = [f"CAP_INBOX:{email_target}"] + rec_factor
                if all(req in true_nodes for req in reqs):
                    return True, f"Recovery via {email_target} inbox"
            elif r == "sms":
                reqs = ["CAP_SMS"] + rec_factor
                if all(req in true_nodes for req in reqs):
                    return True, "SMS password reset"

        return False, ""

    settle_caps()
    r = 0
    while True:
        r += 1
        newly = []
        for a in state.accounts:
            aid = f"ACC:{a.id}"
            if aid not in true_nodes:
                is_sat, via_label = satisfied(a)
                if is_sat:
                    newly.append((a.id, via_label))

        if not newly:
            break

        for acct_id, via_label in newly:
            aid = f"ACC:{acct_id}"
            true_nodes.add(aid)
            hop[aid] = r
            via[aid] = via_label
        settle_caps()

    return {"hop": hop, "via": via}


def cascade_rounds(closure_res: dict[str, Any], origin_ids: set[str] | None = None) -> list[dict[str, Any]]:
    """Group fallen accounts into hop rounds for UI animation."""
    hop = closure_res.get("hop", {})
    via = closure_res.get("via", {})
    origins = origin_ids or set()

    rounds_map: dict[int, list[dict[str, str]]] = {}
    for node_id, r in hop.items():
        if r > 0 and node_id.startswith("ACC:") and node_id not in origins:
            acct_id = node_id.replace("ACC:", "")
            via_label = via.get(node_id, "Cascaded access")
            rounds_map.setdefault(r, []).append({"id": acct_id, "via": via_label})

    return [
        {"round": r, "accounts": sorted(rounds_map[r], key=lambda x: x["id"])}
        for r in sorted(rounds_map.keys())
    ]


def run_scenario(
    state: State,
    kind: str,
    target: str,
    catalog: dict[str, CatalogEntry] | None = None,
    settings: Settings | None = None,
    record_event: bool = True,
    db_path: Path = DB_PATH,
) -> dict[str, Any]:
    """Execute scenario simulation per PRD §6 Engine 4."""
    from backend.app.engines.fix_planner import evaluate_state, plan

    cat_map = catalog if catalog is not None else load_catalog()
    st = settings or state.settings

    # Validate kind
    if kind not in ("entry", "breach", "compromise"):
        raise ValueError(f"Invalid scenario kind: '{kind}'. Expected 'entry', 'breach', or 'compromise'.")

    # Validate target
    accounts_by_id = {a.id: a for a in state.accounts}
    if kind == "entry":
        if target not in ("E_SIM", "E_PHONE"):
            raise ValueError(f"Invalid entry target: '{target}'. Expected 'E_SIM' or 'E_PHONE'.")
        forced_ids = {target}
        label = "SIM Swap Attack" if target == "E_SIM" else "Lost / Stolen Unlocked Phone"
        leaked_group = None
    elif kind == "breach":
        if target not in accounts_by_id:
            raise ValueError(f"Unknown account target for breach: '{target}'.")
        forced_ids = {f"E_LEAK:{target}"}
        target_acct = accounts_by_id[target]
        label = f"Breach of {target_acct.name} Credentials"
        leaked_group = target_acct.password_group
    elif kind == "compromise":
        if target not in accounts_by_id:
            raise ValueError(f"Unknown account target for compromise: '{target}'.")
        forced_ids = {f"ACC:{target}"}
        target_acct = accounts_by_id[target]
        label = f"Direct Compromise of {target_acct.name}"
        leaked_group = None

    # Deterministic cascade
    closure_res = closure_det(state, cat_map, forced=forced_ids)
    cascade = cascade_rounds(closure_res, origin_ids=forced_ids)

    # All fallen account IDs (excluding forced origin)
    fallen_ids = {
        item["id"]
        for round_item in cascade
        for item in round_item["accounts"]
    }

    # MC metrics: base vs forced
    base_ev = evaluate_state(state, cat_map, st, trials=1000)
    forced_ev = evaluate_state(state, cat_map, st, forced=forced_ids, trials=1000)
    el_delta = max(0.0, round(forced_ev["el"] - base_ev["el"], 2))
    score_during = forced_ev["score"]

    # Candidate filter for next actions:
    # fixes whose target is in the cascade, the forced origin, the anchor involved, or the leaked group
    allowed_targets = set(fallen_ids)
    if kind == "entry":
        allowed_targets.add("phone")
    else:
        allowed_targets.add(target)
    if leaked_group:
        allowed_targets.add(leaked_group)

    def candidate_filter(fix) -> bool:
        return fix.target in allowed_targets

    plan_res = plan(
        state=state,
        catalog=cat_map,
        settings=st,
        forced=forced_ids,
        k_full=5,
        candidate_filter=candidate_filter,
    )
    next_actions = plan_res["plan"][:5]

    if record_event:
        add_event(
            kind="scenario",
            title=f"Scenario executed: {label}",
            detail={
                "kind": kind,
                "target": target,
                "falls": len(fallen_ids),
                "el_delta": el_delta,
                "score_during": score_during,
            },
            db_path=db_path,
        )

    return {
        "scenario": {
            "kind": kind,
            "target": target,
            "label": label,
        },
        "cascade": cascade,
        "falls": len(fallen_ids),
        "el_delta": el_delta,
        "score_during": score_during,
        "leaked_group": leaked_group,
        "next_actions": next_actions,
    }


def to_view(
    state: State,
    catalog: dict[str, CatalogEntry],
    settings: Settings,
    ev_result: dict[str, Any],
) -> dict[str, Any]:
    """Export graph view per PRD §6 Engine 1 for Cytoscape.js rendering."""
    p_map = ev_result.get("p", {})

    def get_band(p_val: float) -> str:
        if p_val < settings.band_low:
            return "low"
        if p_val < settings.band_high:
            return "medium"
        return "high"

    # Password groups with size >= 2
    groups: dict[str, list[Account]] = {}
    for a in state.accounts:
        if a.password_group:
            groups.setdefault(a.password_group, []).append(a)

    # Hub accounts (accounts that other accounts depend on via recovery or SSO)
    hub_ids: set[str] = set()
    for a in state.accounts:
        for r in a.recovery:
            if r.startswith("email:"):
                hub_ids.add(r.split(":", 1)[1])
        for m in a.login_methods:
            if m.startswith("sso:"):
                hub_ids.add(m.split(":", 1)[1])
        for p in a.permissions:
            if p.startswith("email_inbox:"):
                hub_ids.add(p.split(":", 1)[1])

    nodes: list[dict[str, Any]] = [
        {
            "id": "E_SIM",
            "label": "Phone Number (SIM)",
            "kind": "entry",
            "layer": 0,
            "p": settings.p_sim * (settings.sim_lock_mult if state.anchors.phone.sim_lock else 1.0),
            "band": get_band(settings.p_sim * (settings.sim_lock_mult if state.anchors.phone.sim_lock else 1.0)),
            "impact": 6,
            "ghost": False,
        },
        {
            "id": "E_PHONE",
            "label": "Physical Phone Device",
            "kind": "entry",
            "layer": 0,
            "p": settings.p_phone,
            "band": get_band(settings.p_phone),
            "impact": 4,
            "ghost": False,
        },
    ]

    for g, members in groups.items():
        if len(members) >= 2:
            nodes.append(
                {
                    "id": f"GROUP:{g}",
                    "label": f"Password Group '{g}'",
                    "kind": "group",
                    "layer": 0,
                    "p": None,
                    "band": None,
                    "impact": max(account_impact(m) for m in members),
                    "ghost": False,
                }
            )

    for a in state.accounts:
        p_val = p_map.get(a.id, 0.0)
        layer = 1 if a.id in hub_ids else 2
        nodes.append(
            {
                "id": f"ACC:{a.id}",
                "label": a.name,
                "kind": "account",
                "layer": layer,
                "p": p_val,
                "band": get_band(p_val),
                "impact": account_impact(a),
                "ghost": False,
            }
        )

    # Edges (collapse zero-cost capability nodes)
    edges: list[dict[str, Any]] = []
    seen_edges: set[tuple[str, str, str]] = set()

    def add_edge(src: str, tgt: str, lbl: str):
        if (src, tgt, lbl) not in seen_edges:
            seen_edges.add((src, tgt, lbl))
            edges.append({"source": src, "target": tgt, "label": lbl, "ghost": False})

    for a in state.accounts:
        target_node = f"ACC:{a.id}"

        # 1. Password login & reuse
        if "password" in a.login_methods:
            if a.password_group and len(groups.get(a.password_group, [])) >= 2:
                add_edge(f"GROUP:{a.password_group}", target_node, "Shared password")
            if a.second_factor == "sms":
                add_edge("E_SIM", target_node, "SMS 2FA code")

        # 2. SMS OTP login
        if "sms_otp" in a.login_methods:
            add_edge("E_SIM", target_node, "SMS OTP login")

        # 3. SSO
        for m in a.login_methods:
            if m.startswith("sso:"):
                provider = m.split(":", 1)[1]
                add_edge(f"ACC:{provider}", target_node, f"Sign-in with {provider}")

        # 4. Recovery email
        for r in a.recovery:
            if r.startswith("email:"):
                email_provider = r.split(":", 1)[1]
                add_edge(f"ACC:{email_provider}", target_node, f"Recovery via {email_provider}")
            elif r == "sms":
                add_edge("E_SIM", target_node, "SMS password reset")

    return {"nodes": nodes, "edges": edges}


def compute_preview(
    state: State,
    op: str,
    payload_data: Any,
    catalog: dict[str, CatalogEntry] | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Compute counterfactual preview with ghost nodes and edges per PRD §6 & §7."""
    from backend.app.engines.fix_planner import evaluate_state
    from backend.app.engines.fix_library import apply_fix

    cat_map = catalog if catalog is not None else load_catalog()
    st = settings or state.settings

    # 1. Before state
    ev_before = evaluate_state(state, cat_map, st)
    view_before = to_view(state, cat_map, st, ev_before)
    before_node_ids = {n["id"] for n in view_before["nodes"]}
    before_edges = {(e["source"], e["target"]) for e in view_before["edges"]}

    # 2. Apply change on a pure copy of state
    state_after = state.model_copy(deep=True)
    changed_account_id: str | None = None

    if op == "upsert_account":
        acct = Account.model_validate(payload_data)
        changed_account_id = acct.id
        idx = next((i for i, a in enumerate(state_after.accounts) if a.id == acct.id), None)
        if idx is not None:
            state_after.accounts[idx] = acct
        else:
            state_after.accounts.append(acct)
    elif op == "apply_fix":
        fix_id = str(payload_data)
        state_after = apply_fix(state, fix_id, cat_map)
    else:
        raise ValueError(f"Unknown preview op: '{op}'. Expected 'upsert_account' or 'apply_fix'.")

    # 3. After state
    ev_after = evaluate_state(state_after, cat_map, st)
    view_after = to_view(state_after, cat_map, st, ev_after)

    # 4. Ghost detection
    ghost_nodes = []
    for n in view_after["nodes"]:
        if n["id"] not in before_node_ids:
            gn = dict(n)
            gn["ghost"] = True
            ghost_nodes.append(gn)

    ghost_edges = []
    changed_node = f"ACC:{changed_account_id}" if changed_account_id else None
    for e in view_after["edges"]:
        pair = (e["source"], e["target"])
        is_new_edge = pair not in before_edges
        is_changed_incoming = changed_node is not None and e["target"] == changed_node and is_new_edge
        if is_new_edge or is_changed_incoming:
            ge = dict(e)
            ge["ghost"] = True
            ghost_edges.append(ge)

    # 5. New paths into changed account or accounts whose p increased by > 0.05
    p_before = ev_before.get("p", {})
    p_after = ev_after.get("p", {})
    vulnerable_targets = []
    if changed_account_id:
        vulnerable_targets.append(changed_account_id)
    for aid, pa in p_after.items():
        if pa > p_before.get(aid, 0.0) + 0.05 and aid not in vulnerable_targets:
            vulnerable_targets.append(aid)

    new_paths = []
    for vt in vulnerable_targets:
        vt_p = p_after.get(vt, 0.5)
        band = "high" if vt_p >= st.band_high else ("medium" if vt_p >= st.band_low else "low")
        new_paths.append(
            {
                "entries": ["E_SIM"],
                "steps": [{"node": vt, "hop": 1, "via": "Takeover route"}],
                "likelihood": round(vt_p, 2),
                "band": band,
                "cut_fix_id": f"2fa:{vt}",
            }
        )

    # 6. New SPOFs (candidates where closure_det falls increased)
    new_spofs = []
    spof_candidates = ["E_SIM", "E_PHONE"]
    for sc in spof_candidates:
        c_before = len(closure_det(state, cat_map, {sc})["hop"])
        c_after = len(closure_det(state_after, cat_map, {sc})["hop"])
        if c_after > c_before:
            new_spofs.append({"id": sc, "falls_before": c_before, "falls_after": c_after})

    return {
        "score_before": ev_before["score"],
        "score_after": ev_after["score"],
        "d_el": round(ev_after["el"] - ev_before["el"], 2),
        "new_paths": new_paths[:3],
        "new_spofs": new_spofs,
        "ghost": {
            "nodes": ghost_nodes,
            "edges": ghost_edges,
        },
    }
