import time
import pytest
from app.engines.gate_builder import build_graph, compute_impact
from app.schemas import Account, Anchors, AnchorPhone, CatalogEntry, Settings, State


@pytest.fixture
def base_settings():
    return Settings(
        p_sim=0.10,
        sim_lock_mult=0.25,
        p_phone=0.20,
        p_phish_email=0.15,
        leak_base=0.05,
        leak_per_breach=0.08,
        leak_cap=0.60,
        leak_flagged_min=0.80,
    )


@pytest.fixture
def sample_catalog():
    return [
        CatalogEntry(
            key="gmail",
            name="Gmail",
            type="email",
            login_methods_supported=["password", "sms_otp"],
            second_factors_supported=["sms", "authenticator", "hardware_key"],
            recovery_bypasses_2fa=True,
            breach_count_5y=1,
        ),
        CatalogEntry(
            key="bank",
            name="Bank",
            type="finance",
            login_methods_supported=["password"],
            second_factors_supported=["sms", "authenticator"],
            recovery_bypasses_2fa=False,  # Bypasses 2fa is False
            breach_count_5y=0,
        ),
        CatalogEntry(
            key="amazon",
            name="Amazon",
            type="shopping",
            login_methods_supported=["password", "sms_otp"],
            second_factors_supported=["sms", "authenticator"],
            recovery_bypasses_2fa=True,
            breach_count_5y=2,
        ),
    ]


def test_1_sim_lock_multiplies_p_sim(base_settings, sample_catalog):
    # Without sim lock
    state_no_lock = State(
        anchors=Anchors(phone=AnchorPhone(sim_lock=False, device_lock=True)),
        accounts=[],
        settings=base_settings,
    )
    g1 = build_graph(state_no_lock, sample_catalog, base_settings)
    assert g1.nodes["E_SIM"].p == pytest.approx(0.10)

    # With sim lock
    state_lock = State(
        anchors=Anchors(phone=AnchorPhone(sim_lock=True, device_lock=True)),
        accounts=[],
        settings=base_settings,
    )
    g2 = build_graph(state_lock, sample_catalog, base_settings)
    assert g2.nodes["E_SIM"].p == pytest.approx(0.10 * 0.25)


def test_2_breach_flag_and_leak_cap(base_settings, sample_catalog):
    # Regular account
    acct1 = Account(
        id="gmail",
        name="Gmail",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        last_activity="2026-09-01",
        breach_flag=False,
    )
    state = State(accounts=[acct1], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)
    # base + per_breach * 1 = 0.05 + 0.08 = 0.13
    assert g.nodes["E_LEAK:gmail"].p == pytest.approx(0.13)

    # Flagged account: leak_flagged_min = 0.80, but leak_cap is 0.60
    acct2 = Account(
        id="gmail2",
        name="Gmail2",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        last_activity="2026-09-01",
        breach_flag=True,
    )
    state2 = State(accounts=[acct2], settings=base_settings)
    g2 = build_graph(state2, sample_catalog, base_settings)
    # leak_cap respected
    assert g2.nodes["E_LEAK:gmail2"].p <= base_settings.leak_cap


def test_3_device_lock_affects_cap_device_and_cap_sms(base_settings, sample_catalog):
    # Device lock ON
    state_locked = State(
        anchors=Anchors(phone=AnchorPhone(sim_lock=False, device_lock=True)),
        accounts=[],
        settings=base_settings,
    )
    g_locked = build_graph(state_locked, sample_catalog, base_settings)
    assert len(g_locked.nodes["CAP_DEVICE"].methods) == 0
    cap_sms_requires = [m.requires for m in g_locked.nodes["CAP_SMS"].methods]
    assert ("E_PHONE",) not in cap_sms_requires

    # Device lock OFF
    state_unlocked = State(
        anchors=Anchors(phone=AnchorPhone(sim_lock=False, device_lock=False)),
        accounts=[],
        settings=base_settings,
    )
    g_unlocked = build_graph(state_unlocked, sample_catalog, base_settings)
    assert any("E_PHONE" in m.requires for m in g_unlocked.nodes["CAP_DEVICE"].methods)
    assert any("E_PHONE" in m.requires for m in g_unlocked.nodes["CAP_SMS"].methods)


def test_4_hardware_key_eliminates_phish_and_requires_cap_key(base_settings, sample_catalog):
    acct_hw = Account(
        id="gmail",
        name="Gmail",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        second_factor="hardware_key",
        last_activity="2026-09-01",
    )
    state = State(accounts=[acct_hw], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    # No E_PHISH node created
    assert "E_PHISH:gmail" not in g.nodes

    # Password method requires CAP_KEY
    pw_method = next(m for m in g.nodes["ACC:gmail"].methods if m.id == "gmail#login:password")
    assert "CAP_KEY" in pw_method.requires


def test_5_recovery_bypasses_2fa_false(base_settings, sample_catalog):
    # Bank has recovery_bypasses_2fa = False
    acct_bank = Account(
        id="bank",
        name="Bank",
        service_key="bank",
        type="finance",
        login_methods=["password"],
        second_factor="sms",
        recovery=["sms"],
        last_activity="2026-09-01",
    )
    state = State(accounts=[acct_bank], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    # recovery method should require CAP_SMS (from recovery) + CAP_SMS (from factor_caps)
    rec_method = next(m for m in g.nodes["ACC:bank"].methods if m.id == "bank#recovery:sms")
    assert rec_method.requires == ("CAP_SMS", "CAP_SMS")


def test_6_shared_group_has_method_per_group_member(base_settings, sample_catalog):
    acct1 = Account(
        id="a1",
        name="Account 1",
        service_key="amazon",
        type="shopping",
        login_methods=["password"],
        password_group="TeamPass",
        last_activity="2026-09-01",
    )
    acct2 = Account(
        id="a2",
        name="Account 2",
        service_key="amazon",
        type="shopping",
        login_methods=["password"],
        password_group="TeamPass",
        last_activity="2026-09-01",
    )
    state = State(accounts=[acct1, acct2], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    cap_pw = g.nodes["CAP_PW:a1"]
    assert len(cap_pw.methods) == 2
    req_sets = {m.requires for m in cap_pw.methods}
    assert ("E_LEAK:a1",) in req_sets
    assert ("E_LEAK:a2",) in req_sets


def test_7_permission_email_inbox_adds_method_to_cap_inbox(base_settings, sample_catalog):
    gmail = Account(
        id="gmail",
        name="Gmail",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        last_activity="2026-09-01",
    )
    app_x = Account(
        id="app_x",
        name="App X",
        service_key="amazon",
        type="utility_app",
        login_methods=["password"],
        permissions=["email_inbox:gmail"],
        last_activity="2026-09-01",
    )
    state = State(accounts=[gmail, app_x], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    cap_inbox = g.nodes["CAP_INBOX:gmail"]
    requires_list = [m.requires for m in cap_inbox.methods]
    assert ("ACC:app_x",) in requires_list


def test_8_permission_sms_adds_method_to_cap_sms(base_settings, sample_catalog):
    app_x = Account(
        id="app_x",
        name="App X",
        service_key="amazon",
        type="utility_app",
        login_methods=["password"],
        permissions=["sms"],
        last_activity="2026-09-01",
    )
    state = State(accounts=[app_x], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    cap_sms = g.nodes["CAP_SMS"]
    requires_list = [m.requires for m in cap_sms.methods]
    assert ("ACC:app_x",) in requires_list


def test_9_sso_requires_sso_target(base_settings, sample_catalog):
    gmail = Account(
        id="gmail",
        name="Gmail",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        last_activity="2026-09-01",
    )
    canva = Account(
        id="canva",
        name="Canva",
        service_key="amazon",
        type="utility_app",
        login_methods=["sso:gmail"],
        last_activity="2026-09-01",
    )
    state = State(accounts=[gmail, canva], settings=base_settings)
    g = build_graph(state, sample_catalog, base_settings)

    sso_method = next(m for m in g.nodes["ACC:canva"].methods if "sso:gmail" in m.id)
    assert sso_method.requires == ("ACC:gmail",)


def test_10_impact_override_and_weights():
    # 1. Override wins
    acct1 = Account(
        id="a1",
        name="A1",
        service_key="test",
        type="other",
        last_activity="2026-09-01",
        data_held=["payment"],  # weight 10
        importance_override=3,
    )
    assert compute_impact(acct1) == 3

    # 2. Max of data & permissions
    acct2 = Account(
        id="a2",
        name="A2",
        service_key="test",
        type="other",
        last_activity="2026-09-01",
        data_held=["contacts"],  # weight 3
        permissions=["sms"],     # weight 6
    )
    assert compute_impact(acct2) == 6


def test_graph_order_and_performance(base_settings, sample_catalog):
    accounts = [
        Account(
            id=f"acct_{i}",
            name=f"Account {i}",
            service_key="amazon",
            type="shopping",
            login_methods=["password"],
            last_activity="2026-09-01",
        )
        for i in range(15)
    ]
    state = State(accounts=accounts, settings=base_settings)

    t0 = time.perf_counter()
    g = build_graph(state, sample_catalog, base_settings)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert elapsed_ms < 20.0  # Must be < 20ms per M1-02 done criteria

    # Check order: entries, caps, accounts, each sorted by id
    entries = [nid for nid in g.order if g.nodes[nid].kind == "entry"]
    caps = [nid for nid in g.order if g.nodes[nid].kind == "cap"]
    accts = [nid for nid in g.order if g.nodes[nid].kind == "account"]

    assert g.order == entries + caps + accts
    assert entries == sorted(entries)
    assert caps == sorted(caps)
    assert accts == sorted(accts)
