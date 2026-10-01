"""Engine 1: Gate Builder for Chokepoint.

Builds takeover graph from user state, catalog entries, and threat settings.
Translates domain models into AND/OR gate network (PRD §6 Engine 1).
Also provides Cytoscape-ready view export (PRD §6 to_view).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple, Union
from app.engines.graph_types import Graph, Method, Node
from app.schemas import Account, CatalogEntry, Settings, State, validate_accounts_integrity


DATA_WEIGHTS: Dict[str, int] = {
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

PERMISSION_WEIGHTS: Dict[str, int] = {
    "sms": 6,
    "email_inbox": 6,
    "camera": 4,
    "microphone": 4,
    "photos": 4,
    "files": 4,
    "contacts": 3,
    "location": 3,
}


def compute_impact(account: Account) -> int:
    """Calculate account impact per PRD §5.6.

    impact(account) = importance_override ?? max(all data weights, all permission weights held); min 1.
    """
    if account.importance_override is not None:
        return max(1, account.importance_override)

    weights: List[int] = []
    for d in account.data_held:
        if d in DATA_WEIGHTS:
            weights.append(DATA_WEIGHTS[d])

    for p in account.permissions:
        if p.startswith("email_inbox:"):
            weights.append(PERMISSION_WEIGHTS["email_inbox"])
        elif p in PERMISSION_WEIGHTS:
            weights.append(PERMISSION_WEIGHTS[p])

    if not weights:
        return 1
    return max(1, max(weights))


def get_catalog_entry(
    catalog: Union[List[CatalogEntry], Dict[str, Any], None],
    service_key: str,
) -> Optional[CatalogEntry]:
    """Look up catalog entry by service_key from either a dict or list."""
    if not catalog:
        return None

    if isinstance(catalog, dict):
        if service_key in catalog:
            val = catalog[service_key]
            if isinstance(val, CatalogEntry):
                return val
            if isinstance(val, dict):
                d = dict(val)
                d.setdefault("key", service_key)
                return CatalogEntry.model_validate(d)
        for k, val in catalog.items():
            if k.startswith("_"):
                continue
            if isinstance(val, dict) and val.get("key") == service_key:
                return CatalogEntry.model_validate(val)
            if isinstance(val, CatalogEntry) and val.key == service_key:
                return val

    elif isinstance(catalog, list):
        for entry in catalog:
            if isinstance(entry, CatalogEntry) and entry.key == service_key:
                return entry
            if isinstance(entry, dict) and entry.get("key") == service_key:
                return CatalogEntry.model_validate(entry)

    return None


def build_graph(
    state: State,
    catalog: Union[List[CatalogEntry], Dict[str, Any], None] = None,
    settings: Optional[Settings] = None,
) -> Graph:
    """Build the Takeover Graph (pure function, no I/O).

    Follows PRD §6 Engine 1 specification.
    """
    validate_accounts_integrity(state.accounts)
    cfg = settings or state.settings or Settings()
    sim_lock = state.anchors.phone.sim_lock
    device_lock = state.anchors.phone.device_lock

    nodes: Dict[str, Node] = {}

    # -------------------------------------------------------------
    # 1. ENTRIES
    # -------------------------------------------------------------
    # E_SIM
    sim_mult = cfg.sim_lock_mult if sim_lock else 1.0
    nodes["E_SIM"] = Node(
        id="E_SIM",
        kind="entry",
        label="SIM swap attack",
        p=cfg.p_sim * sim_mult,
        fix_hint="sim_lock",
    )

    # E_PHONE
    nodes["E_PHONE"] = Node(
        id="E_PHONE",
        kind="entry",
        label="Lost or stolen phone",
        p=cfg.p_phone,
        fix_hint="device_lock",
    )

    # Pre-index accounts by group and id
    group_members: Dict[str, List[str]] = {}
    accounts_by_id: Dict[str, Account] = {}
    for acct in state.accounts:
        accounts_by_id[acct.id] = acct
        if acct.password_group:
            group_members.setdefault(acct.password_group, []).append(acct.id)

    # E_LEAK:<acct_id> for every account
    for acct in state.accounts:
        cat_entry = get_catalog_entry(catalog, acct.service_key)
        breach_count = cat_entry.breach_count_5y if cat_entry else 0
        leak_p = min(cfg.leak_cap, cfg.leak_base + cfg.leak_per_breach * breach_count)
        if acct.breach_flag:
            leak_p = min(cfg.leak_cap, max(leak_p, cfg.leak_flagged_min))

        entry_meta = {}
        if acct.password_group:
            entry_meta["group"] = acct.password_group

        nodes[f"E_LEAK:{acct.id}"] = Node(
            id=f"E_LEAK:{acct.id}",
            kind="entry",
            label=f"Credential leak for {acct.name}",
            p=leak_p,
            fix_hint=None,
            meta=entry_meta,
        )

    # E_PHISH:<acct_id> for every email-type account whose second_factor != hardware_key
    for acct in state.accounts:
        if acct.type == "email" and acct.second_factor != "hardware_key":
            nodes[f"E_PHISH:{acct.id}"] = Node(
                id=f"E_PHISH:{acct.id}",
                kind="entry",
                label=f"Phishing attack on {acct.name}",
                p=cfg.p_phish_email,
                fix_hint=None,
            )

    # -------------------------------------------------------------
    # 2. CAPABILITIES (Zero-cost nodes)
    # -------------------------------------------------------------
    # CAP_SMS
    cap_sms_methods: List[Method] = [
        Method(
            id="cap_sms#sim",
            label="SIM swap",
            requires=("E_SIM",),
            fix_hints=("sim_lock",),
        )
    ]
    if not device_lock:
        cap_sms_methods.append(
            Method(
                id="cap_sms#phone",
                label="Unlocked phone SMS access",
                requires=("E_PHONE",),
                fix_hints=("device_lock",),
            )
        )
    for acct in state.accounts:
        if "sms" in acct.permissions:
            cap_sms_methods.append(
                Method(
                    id=f"cap_sms#perm:{acct.id}",
                    label=f"SMS permission on {acct.name}",
                    requires=(f"ACC:{acct.id}",),
                    fix_hints=(f"revoke:{acct.id}:sms",),
                )
            )

    nodes["CAP_SMS"] = Node(
        id="CAP_SMS",
        kind="cap",
        label="SMS interception",
        methods=cap_sms_methods,
    )

    # CAP_DEVICE
    cap_device_methods: List[Method] = []
    if not device_lock:
        cap_device_methods.append(
            Method(
                id="cap_device#phone",
                label="Unlocked device access",
                requires=("E_PHONE",),
                fix_hints=("device_lock",),
            )
        )
    nodes["CAP_DEVICE"] = Node(
        id="CAP_DEVICE",
        kind="cap",
        label="Physical device access",
        methods=cap_device_methods,
    )

    # CAP_KEY (Hardware key - no methods, never true unless forced)
    nodes["CAP_KEY"] = Node(
        id="CAP_KEY",
        kind="cap",
        label="Hardware security key",
        methods=[],
    )

    # CAP_PW:<acct_id> for every account
    for acct in state.accounts:
        cap_pw_methods: List[Method] = []
        if acct.password_group:
            members = group_members.get(acct.password_group, [acct.id])
            for mem_id in members:
                mem_name = accounts_by_id[mem_id].name if mem_id in accounts_by_id else mem_id
                cap_pw_methods.append(
                    Method(
                        id=f"cap_pw:{acct.id}#leak:{mem_id}",
                        label=f"Password leak from {mem_name} (shared group '{acct.password_group}')",
                        requires=(f"E_LEAK:{mem_id}",),
                        fix_hints=(f"unique_pw:{acct.password_group}",) if len(members) >= 2 else (),
                    )
                )
        else:
            cap_pw_methods.append(
                Method(
                    id=f"cap_pw:{acct.id}#leak:{acct.id}",
                    label=f"Credential leak for {acct.name}",
                    requires=(f"E_LEAK:{acct.id}",),
                    fix_hints=(),
                )
            )
        nodes[f"CAP_PW:{acct.id}"] = Node(
            id=f"CAP_PW:{acct.id}",
            kind="cap",
            label=f"Password for {acct.name}",
            methods=cap_pw_methods,
        )

    # CAP_INBOX:<email_id> for every email-type account
    for acct in state.accounts:
        if acct.type == "email":
            inbox_methods: List[Method] = [
                Method(
                    id=f"cap_inbox:{acct.id}#account",
                    label=f"Compromised {acct.name} account",
                    requires=(f"ACC:{acct.id}",),
                    fix_hints=(),
                )
            ]
            # Check for accounts holding permission email_inbox:<acct.id>
            perm_needle = f"email_inbox:{acct.id}"
            for other_acct in state.accounts:
                if perm_needle in other_acct.permissions:
                    inbox_methods.append(
                        Method(
                            id=f"cap_inbox:{acct.id}#perm:{other_acct.id}",
                            label=f"Email inbox permission on {other_acct.name}",
                            requires=(f"ACC:{other_acct.id}",),
                            fix_hints=(f"revoke:{other_acct.id}:{perm_needle}",),
                        )
                    )
            nodes[f"CAP_INBOX:{acct.id}"] = Node(
                id=f"CAP_INBOX:{acct.id}",
                kind="cap",
                label=f"Inbox access for {acct.name}",
                methods=inbox_methods,
            )

    # -------------------------------------------------------------
    # 3. ACCOUNT NODES AND METHODS (OR of methods)
    # -------------------------------------------------------------
    for acct in state.accounts:
        cat_entry = get_catalog_entry(catalog, acct.service_key)
        impact = compute_impact(acct)

        # Factor caps for second factor
        if acct.second_factor == "sms":
            factor_caps: Tuple[str, ...] = ("CAP_SMS",)
        elif acct.second_factor == "authenticator":
            factor_caps = ("CAP_DEVICE",)
        elif acct.second_factor == "hardware_key":
            factor_caps = ("CAP_KEY",)
        else:
            factor_caps = ()

        acct_methods: List[Method] = []

        # Method 1: Password in login_methods
        if "password" in acct.login_methods:
            reqs = (f"CAP_PW:{acct.id}",) + factor_caps
            hints: List[str] = []
            if acct.second_factor in ("none", "sms"):
                hints.append(f"2fa:{acct.id}")
            if acct.password_group and len(group_members.get(acct.password_group, [])) >= 2:
                hints.append(f"unique_pw:{acct.password_group}")
            m_label = (
                "Password login"
                if not factor_caps
                else f"Password login with {acct.second_factor} 2FA"
            )
            acct_methods.append(
                Method(
                    id=f"{acct.id}#login:password",
                    label=m_label,
                    requires=reqs,
                    fix_hints=tuple(hints),
                )
            )

        # Method 2: SMS OTP in login_methods
        if "sms_otp" in acct.login_methods:
            acct_methods.append(
                Method(
                    id=f"{acct.id}#login:sms_otp",
                    label="SMS OTP direct login",
                    requires=("CAP_SMS",),
                    fix_hints=(f"rm_login:{acct.id}:sms_otp",),
                )
            )

        # Method 3: SSO logins (sso:<target_id>)
        for lm in acct.login_methods:
            if lm.startswith("sso:"):
                target_p = lm[len("sso:"):]
                target_name = (
                    accounts_by_id[target_p].name
                    if target_p in accounts_by_id
                    else target_p
                )
                acct_methods.append(
                    Method(
                        id=f"{acct.id}#login:{lm}",
                        label=f"Sign in with {target_name}",
                        requires=(f"ACC:{target_p}",),
                        fix_hints=(),
                    )
                )

        # Recovery bypass check from catalog: default is True (bypasses 2fa)
        recovery_bypasses_2fa = (
            cat_entry.recovery_bypasses_2fa if cat_entry is not None else True
        )
        rec_factor_caps = () if recovery_bypasses_2fa else factor_caps

        # Method 4: Email recovery reset
        for rec in acct.recovery:
            if rec.startswith("email:"):
                email_target = rec[len("email:"):]
                target_name = (
                    accounts_by_id[email_target].name
                    if email_target in accounts_by_id
                    else email_target
                )
                acct_methods.append(
                    Method(
                        id=f"{acct.id}#recovery:{rec}",
                        label=f"Password reset via recovery email ({target_name})",
                        requires=(f"CAP_INBOX:{email_target}",) + rec_factor_caps,
                        fix_hints=(f"rm_recovery:{acct.id}:{rec}",),
                    )
                )

        # Method 5: SMS recovery reset
        if "sms" in acct.recovery:
            acct_methods.append(
                Method(
                    id=f"{acct.id}#recovery:sms",
                    label="Password reset via SMS recovery code",
                    requires=("CAP_SMS",) + rec_factor_caps,
                    fix_hints=(f"rm_recovery:{acct.id}:sms",),
                )
            )

        # Method 6: Phishing for email-type accounts without hardware key
        if acct.type == "email" and acct.second_factor != "hardware_key":
            acct_methods.append(
                Method(
                    id=f"{acct.id}#phish",
                    label="Credential phishing attack",
                    requires=(f"E_PHISH:{acct.id}",),
                    fix_hints=(
                        f"2fa:{acct.id}:hardware_key"
                        if acct.second_factor == "authenticator"
                        else f"2fa:{acct.id}",
                    ),
                )
            )

        nodes[f"ACC:{acct.id}"] = Node(
            id=f"ACC:{acct.id}",
            kind="account",
            label=acct.name,
            methods=acct_methods,
            meta={
                "impact": impact,
                "name": acct.name,
                "type": acct.type,
                "account_id": acct.id,
            },
        )

    # -------------------------------------------------------------
    # 4. DETERMINISTIC ORDER
    # -------------------------------------------------------------
    # Order: entries sorted by id, then caps sorted by id, then accounts sorted by id
    entries_sorted = sorted([nid for nid, n in nodes.items() if n.kind == "entry"])
    caps_sorted = sorted([nid for nid, n in nodes.items() if n.kind == "cap"])
    accounts_sorted = sorted([nid for nid, n in nodes.items() if n.kind == "account"])

    order = entries_sorted + caps_sorted + accounts_sorted

    return Graph(nodes=nodes, order=order)


def to_view(
    graph: Graph,
    p_by_account: Optional[Dict[str, float]] = None,
    ghost_ids: frozenset[str] = frozenset(),
    band_low: float = 0.15,
    band_high: float = 0.40,
) -> Dict[str, Any]:
    """Export graph representation for Cytoscape view per PRD §6.

    Visible nodes:
      - E_SIM, E_PHONE
      - GROUP:<label> for password groups with size >= 2
      - All accounts
    Layers:
      - Layer 0: entries and groups
      - Layer 1: hubs (accounts that appear in another account's requirements, directly or via cap)
      - Layer 2: the rest
    Edges:
      - X -> A when X supplies a requirement of one of A's methods (collapse caps)
    """
    p_map = p_by_account or {}

    def get_band(p_val: float) -> str:
        if p_val < band_low:
            return "low"
        if p_val < band_high:
            return "medium"
        return "high"

    # Identify password groups with >= 2 members
    group_counts: Dict[str, int] = {}
    for node in graph.nodes.values():
        if node.kind == "entry" and node.id.startswith("E_LEAK:"):
            grp = node.meta.get("group")
            if grp:
                group_counts[grp] = group_counts.get(grp, 0) + 1

    multi_groups = {g for g, cnt in group_counts.items() if cnt >= 2}

    # Resolve capability sources to collapsed origins
    # e.g., CAP_SMS is fed by E_SIM, (E_PHONE if present), and ACC:<x> (for sms permission)
    def resolve_requirement(req: str) -> List[str]:
        if req == "CAP_SMS":
            res = ["E_SIM"]
            cap_sms = graph.get("CAP_SMS")
            if cap_sms:
                for m in cap_sms.methods:
                    if "E_PHONE" in m.requires:
                        res.append("E_PHONE")
                    for r in m.requires:
                        if r.startswith("ACC:"):
                            res.append(r)
            return res

        if req == "CAP_DEVICE":
            cap_dev = graph.get("CAP_DEVICE")
            if cap_dev and any("E_PHONE" in m.requires for m in cap_dev.methods):
                return ["E_PHONE"]
            return []

        if req == "CAP_KEY":
            return []

        if req.startswith("CAP_PW:"):
            target_acct_id = req[len("CAP_PW:"):]
            leak_node = graph.get(f"E_LEAK:{target_acct_id}")
            grp = leak_node.meta.get("group") if leak_node else None
            if grp and grp in multi_groups:
                return [f"GROUP:{grp}"]
            return []

        if req.startswith("CAP_INBOX:"):
            email_acct_id = req[len("CAP_INBOX:"):]
            res = [f"ACC:{email_acct_id}"]
            cap_inbox = graph.get(req)
            if cap_inbox:
                for m in cap_inbox.methods:
                    for r in m.requires:
                        if r.startswith("ACC:") and r != f"ACC:{email_acct_id}":
                            res.append(r)
            return res

        if req.startswith("ACC:") or req in ("E_SIM", "E_PHONE"):
            return [req]

        return []

    # Map all account methods to collapsed dependencies
    # and identify hubs (accounts that supply requirements to other accounts)
    account_nodes = graph.accounts()
    incoming_edges: List[Dict[str, Any]] = []
    hub_account_ids: Set[str] = set()

    for acct_node in account_nodes:
        acct_id = acct_node.meta.get("account_id", acct_node.id.replace("ACC:", ""))
        for method in acct_node.methods:
            for req in method.requires:
                origins = resolve_requirement(req)
                for orig in origins:
                    if orig.startswith("ACC:"):
                        supplier_id = orig.replace("ACC:", "")
                        if supplier_id != acct_id:
                            hub_account_ids.add(supplier_id)
                            incoming_edges.append({
                                "source": supplier_id,
                                "target": acct_id,
                                "label": method.label,
                            })
                    elif orig in ("E_SIM", "E_PHONE"):
                        incoming_edges.append({
                            "source": orig,
                            "target": acct_id,
                            "label": method.label,
                        })
                    elif orig.startswith("GROUP:"):
                        incoming_edges.append({
                            "source": orig,
                            "target": acct_id,
                            "label": method.label,
                        })

    # Deduplicate edges by (source, target, label)
    unique_edges = []
    seen_edges = set()
    for e in incoming_edges:
        key = (e["source"], e["target"], e["label"])
        if key not in seen_edges:
            seen_edges.add(key)
            is_ghost = (e["source"] in ghost_ids) or (e["target"] in ghost_ids)
            unique_edges.append({
                "source": e["source"],
                "target": e["target"],
                "label": e["label"],
                "ghost": is_ghost,
            })

    # Build View Nodes
    view_nodes = []

    # E_SIM
    e_sim = graph.get("E_SIM")
    p_sim = e_sim.p if e_sim and e_sim.p is not None else 0.10
    view_nodes.append({
        "id": "E_SIM",
        "label": "SIM Card (Cellular)",
        "kind": "entry",
        "layer": 0,
        "p": round(p_sim, 4),
        "band": get_band(p_sim),
        "impact": 0,
        "ghost": "E_SIM" in ghost_ids,
    })

    # E_PHONE
    e_phone = graph.get("E_PHONE")
    p_phone = e_phone.p if e_phone and e_phone.p is not None else 0.20
    view_nodes.append({
        "id": "E_PHONE",
        "label": "Physical Phone",
        "kind": "entry",
        "layer": 0,
        "p": round(p_phone, 4),
        "band": get_band(p_phone),
        "impact": 0,
        "ghost": "E_PHONE" in ghost_ids,
    })

    # Multi password groups
    for grp in sorted(multi_groups):
        grp_id = f"GROUP:{grp}"
        view_nodes.append({
            "id": grp_id,
            "label": f"Shared Password '{grp}'",
            "kind": "group",
            "layer": 0,
            "p": None,
            "band": "medium",
            "impact": 0,
            "ghost": grp_id in ghost_ids,
        })

    # Account nodes
    for acct_node in account_nodes:
        acct_id = acct_node.meta.get("account_id", acct_node.id.replace("ACC:", ""))
        layer = 1 if acct_id in hub_account_ids else 2
        p_val = p_map.get(acct_id, 0.0)
        impact = acct_node.meta.get("impact", 1)
        name = acct_node.meta.get("name", acct_node.label)

        view_nodes.append({
            "id": acct_id,
            "label": name,
            "kind": "account",
            "layer": layer,
            "p": round(p_val, 4),
            "band": get_band(p_val),
            "impact": impact,
            "ghost": (acct_id in ghost_ids or acct_node.id in ghost_ids),
        })

    return {
        "nodes": view_nodes,
        "edges": unique_edges,
    }
