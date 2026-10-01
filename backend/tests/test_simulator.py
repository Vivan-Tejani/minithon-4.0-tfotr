import time
from types import SimpleNamespace
import numpy as np
import pytest

from app.engines.graph_types import Graph, Method, Node
from app.engines.simulator import (
    analyze_core,
    cascade_rounds,
    clear_cache,
    closure_det,
    closure_mc,
    evaluate,
    explain_account,
    find_spofs,
    fix_effort,
    headline,
    metrics,
    paths_into,
    sample_entries,
)
from tests.fixtures.mini_graph import create_mini_graph


# =====================================================================
# M2-00 Tests: Graph Types & Golden Fixture
# =====================================================================

def test_mini_graph_structure():
    graph = create_mini_graph()
    assert len(graph.nodes) == 9
    assert len(graph.entries()) == 2
    assert len(graph.accounts()) == 4

    # Verify deterministic order: entries, then caps, then accounts
    assert graph.order == [
        "E_PHONE", "E_SIM",
        "CAP_INBOX:gmail", "CAP_KEY", "CAP_SMS",
        "ACC:canva", "ACC:gmail", "ACC:netflix", "ACC:vault",
    ]

    assert graph.get("E_SIM") is not None
    assert graph.get("non_existent") is None


# =====================================================================
# M2-01 Tests: Deterministic Closure
# =====================================================================

def test_closure_det_mini_graph_expectations():
    """Per M2-00 and M2-01:

    Forced {E_SIM} -> gmail hop 1, canva hop 2, netflix hop 2; vault never.
    """
    graph = create_mini_graph()
    result = closure_det(graph, forced={"E_SIM"})

    hops = result["hop"]
    vias = result["via"]

    assert hops.get("E_SIM") == 0
    assert hops.get("CAP_SMS") == 0
    assert hops.get("ACC:gmail") == 1
    assert hops.get("ACC:canva") == 2
    assert hops.get("ACC:netflix") == 2
    assert "ACC:vault" not in hops

    assert "SMS" in vias.get("ACC:gmail", "")
    assert "Google" in vias.get("ACC:canva", "")
    assert "Gmail" in vias.get("ACC:netflix", "")

    # Cascade rounds grouping
    cascade = cascade_rounds(result)
    assert len(cascade) == 2
    assert cascade[0]["round"] == 1
    assert [a["id"] for a in cascade[0]["accounts"]] == ["gmail"]
    assert cascade[1]["round"] == 2
    assert [a["id"] for a in cascade[1]["accounts"]] == ["canva", "netflix"]


def test_closure_det_empty_forced():
    graph = create_mini_graph()
    result = closure_det(graph, forced=set())
    assert result["hop"] == {}
    assert result["via"] == {}


def test_closure_det_forcing_cap():
    graph = create_mini_graph()
    result = closure_det(graph, forced={"CAP_SMS"})
    assert result["hop"].get("ACC:gmail") == 1
    assert result["hop"].get("ACC:canva") == 2


def test_closure_det_cycle_terminates():
    """Tests that a cyclic dependency terminates without infinite loop."""
    nodes = {
        "E_SIM": Node(id="E_SIM", kind="entry", label="SIM", p=0.1),
        "CAP_SMS": Node(
            id="CAP_SMS",
            kind="cap",
            label="SMS",
            methods=[
                Method(id="m1", label="SIM", requires=("E_SIM",), fix_hints=()),
                Method(id="m2", label="Cycle from A2", requires=("ACC:a2",), fix_hints=()),
            ],
        ),
        "ACC:a1": Node(
            id="ACC:a1",
            kind="account",
            label="Account 1",
            methods=[Method(id="m_a1", label="via SMS", requires=("CAP_SMS",), fix_hints=())],
        ),
        "ACC:a2": Node(
            id="ACC:a2",
            kind="account",
            label="Account 2",
            methods=[Method(id="m_a2", label="via A1", requires=("ACC:a1",), fix_hints=())],
        ),
    }
    graph = Graph(nodes=nodes, order=["E_SIM", "CAP_SMS", "ACC:a1", "ACC:a2"])
    result = closure_det(graph, forced={"E_SIM"})
    assert result["hop"]["ACC:a1"] == 1
    assert result["hop"]["ACC:a2"] == 2


# =====================================================================
# M2-02 Tests: Monte Carlo & Metrics
# =====================================================================

def test_mc_seed_determinism():
    graph = create_mini_graph()
    settings = SimpleNamespace(seed=42, trials=2000)

    res1 = evaluate(graph, settings)
    res2 = evaluate(graph, settings)
    assert res1 == res2

    # Different seed gives close results
    settings_diff = SimpleNamespace(seed=999, trials=2000)
    res_diff = evaluate(graph, settings_diff)
    assert abs(res1["el"] - res_diff["el"]) < 1.0


def test_mc_vs_det_all_forced_property():
    """Property test: with every entry forced identically, closure_mc taken-set

    equals closure_det taken-set.
    """
    graph = create_mini_graph()
    all_entries = {e.id for e in graph.entries()}

    det_res = closure_det(graph, forced=all_entries)
    det_taken = {k for k in det_res["hop"].keys()}

    settings = SimpleNamespace(seed=42, trials=500)
    entry_states = sample_entries(graph, settings, forced_ids=all_entries, trials=500)
    mc_taken_map = closure_mc(graph, entry_states, forced=all_entries)

    mc_taken = {k for k, v in mc_taken_map.items() if np.all(v)}
    assert det_taken == mc_taken


def test_mc_isolated_account_invariance():
    """Adding an isolated account does not change other accounts' P."""
    graph = create_mini_graph()
    settings = SimpleNamespace(seed=42, trials=1000)
    base_res = evaluate(graph, settings)

    # Add isolated account
    isolated = Node(
        id="ACC:isolated",
        kind="account",
        label="Isolated",
        methods=[Method(id="m_iso", label="Key", requires=("CAP_KEY",), fix_hints=())],
        meta={"impact": 5},
    )
    new_nodes = dict(graph.nodes)
    new_nodes["ACC:isolated"] = isolated
    new_order = list(graph.order) + ["ACC:isolated"]
    new_graph = Graph(nodes=new_nodes, order=new_order)

    new_res = evaluate(new_graph, settings)
    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        assert base_res["p"][clean_id] == new_res["p"][clean_id]


def test_mc_monotonicity():
    """Forcing a node never lowers any account's takeover probability."""
    graph = create_mini_graph()
    settings = SimpleNamespace(seed=42, trials=1000)
    base_res = evaluate(graph, settings)

    forced_res = evaluate(graph, settings, forced={"E_SIM"})
    for acc in graph.accounts():
        clean_id = acc.id.replace("ACC:", "")
        assert forced_res["p"][clean_id] >= base_res["p"][clean_id] - 1e-6


def test_mc_performance_budget():
    """12 accounts, 2000 trials < 50 ms."""
    nodes = {}
    for i in range(2):
        nodes[f"E_{i}"] = Node(id=f"E_{i}", kind="entry", label=f"Entry {i}", p=0.1)
    for i in range(12):
        nodes[f"ACC:a{i}"] = Node(
            id=f"ACC:a{i}",
            kind="account",
            label=f"Account {i}",
            methods=[
                Method(id=f"m_{i}", label="method", requires=("E_0",), fix_hints=())
            ],
            meta={"impact": 5},
        )
    order = sorted(list(nodes.keys()))
    graph = Graph(nodes=nodes, order=order)
    settings = SimpleNamespace(seed=42, trials=2000)

    start = time.perf_counter()
    evaluate(graph, settings)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert elapsed_ms < 50, f"MC took {elapsed_ms:.2f} ms (budget: 50 ms)"


# =====================================================================
# M2-03 Tests: SPOF Finder
# =====================================================================

def test_find_spofs_mini_graph():
    graph = create_mini_graph()
    settings = SimpleNamespace(seed=42, trials=1000)

    spofs = find_spofs(graph, settings)
    assert len(spofs) > 0
    top = spofs[0]
    assert top["id"] == "E_SIM"
    assert top["falls"] == 3  # gmail, canva, netflix
    assert set(top["falls_ids"]) == {"canva", "gmail", "netflix"}
    assert top["d_el"] > 0


# =====================================================================
# M2-04 Tests: Path Explorer
# =====================================================================

def test_paths_into_mini_graph():
    graph = create_mini_graph()
    paths = paths_into(graph, "canva", max_hops=4, limit=5)
    assert len(paths) >= 1

    top_path = paths[0]
    assert top_path["entries"] == ["E_SIM"]
    assert top_path["likelihood"] == 0.10
    assert top_path["cut_fix_id"] == "sim_lock"

    # Steps root-to-target: gmail -> canva
    step_nodes = [s["node"] for s in top_path["steps"]]
    assert step_nodes == ["gmail", "canva"]


def test_fix_effort_mapping():
    assert fix_effort("sim_lock") == "low"
    assert fix_effort("device_lock") == "low"
    assert fix_effort("rm_login:upi:sms_otp") == "low"
    assert fix_effort("2fa:gmail") == "medium"
    assert fix_effort("delete:oldforum") == "medium"
    assert fix_effort("unique_pw:A") == "medium"


# =====================================================================
# M2-05 & M2-06 Tests: Explanations, Headline & analyze_core
# =====================================================================

def test_headline_templates():
    spofs_entry = [{"id": "E_SIM", "label": "Your phone number (SIM swap)", "kind": "entry", "falls": 9}]
    assert "phone number alone can take over 9" in headline(spofs_entry, 12)

    spofs_group = [{"id": "GROUP:A", "label": "Shared password 'A'", "kind": "group", "falls": 5, "group_label": "A"}]
    assert "One leaked password ('A') can take over 5" in headline(spofs_group, 12)

    spofs_acc = [{"id": "gmail", "label": "Gmail account", "kind": "account", "falls": 7}]
    assert "If Gmail is compromised, 7" in headline(spofs_acc, 12)


def test_explain_account():
    text = explain_account(
        name="Canva",
        band="medium",
        p=0.20,
        top_paths=[{"steps": [{"node": "gmail"}, {"node": "canva"}]}],
        best_fix_title="Turn on SIM lock",
        reasons=["no second factor"],
    )
    assert "Canva has a medium takeover likelihood (20%)." in text
    assert "Easiest route: gmail -> canva." in text
    assert "Biggest single reduction: Turn on SIM lock." in text


def test_analyze_core():
    graph = create_mini_graph()
    state = SimpleNamespace(accounts=[
        SimpleNamespace(id="gmail", name="Gmail", password_group=None, second_factor="sms"),
        SimpleNamespace(id="canva", name="Canva", password_group=None, second_factor="none"),
        SimpleNamespace(id="netflix", name="Netflix", password_group=None, second_factor="none"),
        SimpleNamespace(id="vault", name="Vault", password_group=None, second_factor="hardware_key"),
    ])
    settings = SimpleNamespace(seed=42, trials=1000, band_low=0.15, band_high=0.40)
    catalog = {}

    analysis = analyze_core(graph, state, catalog, settings)
    assert "score" in analysis
    assert "el" in analysis
    assert "headline" in analysis
    assert len(analysis["accounts"]) == 4
    assert len(analysis["spofs"]) > 0
    assert analysis["crown_path"]["target"] == "gmail"  # Gmail has highest impact (6)


def test_cache_helpers():
    clear_cache()
    # Cache cleared without error
