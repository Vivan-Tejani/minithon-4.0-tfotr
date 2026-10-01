import json
from datetime import date, datetime
from pathlib import Path
import pytest
from backend.app.data.loader import (
    Account,
    State,
    load_catalog,
    load_persona,
    PERSONA_PATH,
)

EXPECTED_ACCOUNT_IDS = [
    "gmail",
    "hotmail",
    "amazon",
    "upi",
    "netflix",
    "zomato",
    "instagram",
    "linkedin",
    "canva",
    "photoedit",
    "dropbox",
    "oldforum",
]


def test_persona_file_exists():
    assert PERSONA_PATH.exists(), f"persona.json not found at {PERSONA_PATH}"


def test_load_persona_as_state():
    state = load_persona()
    assert isinstance(state, State)
    assert state.anchors.phone.sim_lock is False
    assert state.anchors.phone.device_lock is True
    assert len(state.accounts) == 12
    assert [a.id for a in state.accounts] == EXPECTED_ACCOUNT_IDS


def test_persona_activity_dates():
    state = load_persona()
    acct_map = {a.id: a for a in state.accounts}
    assert acct_map["hotmail"].last_activity == "2022-03-10"
    assert acct_map["oldforum"].last_activity == "2019-06-01"

    now_date = date.fromisoformat(state.now)
    for a in state.accounts:
        if a.id in ("hotmail", "oldforum"):
            continue
        act = date.fromisoformat(a.last_activity)
        diff_days = (now_date - act).days
        assert 0 <= diff_days <= 60, (
            f"Account {a.id} last_activity {a.last_activity} is not within 60 days of {state.now}"
        )


def test_persona_accounts_match_catalog_and_prd():
    catalog = load_catalog()
    state = load_persona()
    for a in state.accounts:
        assert a.service_key in catalog, f"Service key {a.service_key} not in catalog"
        cat = catalog[a.service_key]
        for m in a.login_methods:
            base_method = m.split(":")[0]
            assert base_method in cat.login_methods_supported or base_method == "sso"
        if a.second_factor != "none":
            assert a.second_factor in cat.second_factors_supported


def _simulate_det_cascade(state: State, forced_nodes: set[str]) -> set[str]:
    """Independent reference implementation of PRD §6 Engine 1 + Engine 2a closure.
    Verifies that persona.json data produces exactly the PRD §9 cascade numbers.
    """
    catalog = load_catalog()
    accounts = {a.id: a for a in state.accounts}
    sim_lock = state.anchors.phone.sim_lock
    device_lock = state.anchors.phone.device_lock

    true_nodes = set(forced_nodes)
    falls = set()

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
                        can_inbox = (f"ACC:{a.id}" in true_nodes)
                        for x in state.accounts:
                            if f"email_inbox:{a.id}" in x.permissions and f"ACC:{x.id}" in true_nodes:
                                can_inbox = True
                        if can_inbox:
                            true_nodes.add(cap_inbox)
                            changed = True

    def satisfied(acct: Account) -> bool:
        cat = catalog.get(acct.service_key)
        # Factor caps
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
                return True

        # 2. sms_otp
        if "sms_otp" in acct.login_methods:
            if "CAP_SMS" in true_nodes:
                return True

        # 3. sso:p
        for m in acct.login_methods:
            if m.startswith("sso:"):
                provider = m.split(":", 1)[1]
                if f"ACC:{provider}" in true_nodes:
                    return True

        # 4. recovery email:e
        bypasses = cat.recovery_bypasses_2fa if cat else True
        rec_factor = [] if bypasses else factor_caps

        for r in acct.recovery:
            if r.startswith("email:"):
                email_target = r.split(":", 1)[1]
                reqs = [f"CAP_INBOX:{email_target}"] + rec_factor
                if all(req in true_nodes for req in reqs):
                    return True
            elif r == "sms":
                reqs = ["CAP_SMS"] + rec_factor
                if all(req in true_nodes for req in reqs):
                    return True

        return False

    settle_caps()
    while True:
        newly = [a.id for a in state.accounts if f"ACC:{a.id}" not in true_nodes and satisfied(a)]
        if not newly:
            break
        for aid in newly:
            true_nodes.add(f"ACC:{aid}")
            falls.add(aid)
        settle_caps()

    # Exclude forced origin accounts from falls count
    origin_accounts = {n.replace("ACC:", "") for n in forced_nodes if n.startswith("ACC:")}
    return falls - origin_accounts


def test_reference_cascade_counts_match_prd():
    """Verify hand-derived cascade counts on persona.json."""
    state = load_persona()

    # E_SIM = 9 (gmail, amazon, upi, zomato, netflix, instagram, linkedin, canva, photoedit)
    falls_sim = _simulate_det_cascade(state, {"E_SIM"})
    assert len(falls_sim) == 9
    assert falls_sim == {
        "gmail",
        "amazon",
        "upi",
        "zomato",
        "netflix",
        "instagram",
        "linkedin",
        "canva",
        "photoedit",
    }

    # ACC:gmail = 7
    falls_gmail = _simulate_det_cascade(state, {"ACC:gmail"})
    assert len(falls_gmail) == 7
    assert falls_gmail == {
        "amazon",
        "netflix",
        "zomato",
        "instagram",
        "linkedin",
        "canva",
        "photoedit",
    }

    # leak of netflix (group A) = 5 (netflix, hotmail, amazon, oldforum, dropbox)
    falls_leak_netflix = _simulate_det_cascade(state, {"E_LEAK:netflix"})
    assert len(falls_leak_netflix) == 5
    assert falls_leak_netflix == {"netflix", "hotmail", "amazon", "oldforum", "dropbox"}

    # ACC:hotmail = 2 (dropbox, oldforum)
    falls_hotmail = _simulate_det_cascade(state, {"ACC:hotmail"})
    assert len(falls_hotmail) == 2
    assert falls_hotmail == {"dropbox", "oldforum"}

    # E_PHONE = 0
    falls_phone = _simulate_det_cascade(state, {"E_PHONE"})
    assert len(falls_phone) == 0


def test_persona_golden_engine_integration():
    """Assert golden cascades using M1-02 build_graph + M2-01 closure_det.
    Marked xfail until M1-02 and M2-01 land, then flips to hard assert per M3-01.
    """
    try:
        from backend.app.engines.gate_builder import build_graph
        from backend.app.engines.simulator import closure_det
    except ImportError:
        pytest.xfail("Waiting for M1-02 build_graph and M2-01 closure_det to land")

    state = load_persona()
    catalog = load_catalog()
    graph = build_graph(state, catalog, state.settings)

    # E_SIM = 9
    res_sim = closure_det(graph, {"E_SIM"})
    falls_sim = {k.replace("ACC:", "") for k in res_sim.get("hop", {}).keys() if k.startswith("ACC:")}
    assert len(falls_sim) == 9

    # ACC:gmail = 7 (excluding origin)
    res_gmail = closure_det(graph, {"ACC:gmail"})
    falls_gmail = {k.replace("ACC:", "") for k in res_gmail.get("hop", {}).keys() if k.startswith("ACC:") and k != "ACC:gmail"}
    assert len(falls_gmail) == 7

    # E_LEAK:netflix = 5
    res_leak = closure_det(graph, {"E_LEAK:netflix"})
    falls_leak = {k.replace("ACC:", "") for k in res_leak.get("hop", {}).keys() if k.startswith("ACC:")}
    assert len(falls_leak) == 5

    # ACC:hotmail = 2
    res_hotmail = closure_det(graph, {"ACC:hotmail"})
    falls_hotmail = {k.replace("ACC:", "") for k in res_hotmail.get("hop", {}).keys() if k.startswith("ACC:") and k != "ACC:hotmail"}
    assert len(falls_hotmail) == 2

    # E_PHONE = 0
    res_phone = closure_det(graph, {"E_PHONE"})
    falls_phone = {k.replace("ACC:", "") for k in res_phone.get("hop", {}).keys() if k.startswith("ACC:")}
    assert len(falls_phone) == 0
