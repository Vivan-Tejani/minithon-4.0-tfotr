import json
from pathlib import Path
import pytest
from app.engines.gate_builder import build_graph, to_view
from app.schemas import Account, Anchors, AnchorPhone, CatalogEntry, Settings, State


def test_to_view_5_node_fixture():
    # Mini fixture:
    # entries: E_SIM, E_PHONE
    # gmail: recovery sms
    # canva: sso:gmail
    # netflix: recovery email:gmail
    # vault: second_factor hardware_key
    gmail = Account(
        id="gmail",
        name="Gmail",
        service_key="gmail",
        type="email",
        login_methods=["password"],
        recovery=["sms"],
        last_activity="2026-09-01",
    )
    canva = Account(
        id="canva",
        name="Canva",
        service_key="canva",
        type="utility_app",
        login_methods=["sso:gmail"],
        last_activity="2026-09-01",
    )
    netflix = Account(
        id="netflix",
        name="Netflix",
        service_key="netflix",
        type="entertainment",
        login_methods=["password"],
        recovery=["email:gmail"],
        last_activity="2026-09-01",
    )
    vault = Account(
        id="vault",
        name="Vault",
        service_key="vault",
        type="storage",
        login_methods=["password"],
        second_factor="hardware_key",
        last_activity="2026-09-01",
    )

    state = State(
        anchors=Anchors(phone=AnchorPhone(sim_lock=False, device_lock=True)),
        accounts=[gmail, canva, netflix, vault],
    )
    graph = build_graph(state)
    view = to_view(graph, p_by_account={"gmail": 0.10, "canva": 0.10, "netflix": 0.10, "vault": 0.0})

    nodes = {n["id"]: n for n in view["nodes"]}
    assert "E_SIM" in nodes
    assert "E_PHONE" in nodes
    assert "gmail" in nodes
    assert "canva" in nodes
    assert "netflix" in nodes
    assert "vault" in nodes

    # gmail is a hub (canva and netflix depend on it)
    assert nodes["gmail"]["layer"] == 1
    # canva and netflix are leaves
    assert nodes["canva"]["layer"] == 2
    assert nodes["netflix"]["layer"] == 2

    # Edges
    edges = view["edges"]
    # E_SIM -> gmail
    assert any(e["source"] == "E_SIM" and e["target"] == "gmail" for e in edges)
    # gmail -> canva
    assert any(e["source"] == "gmail" and e["target"] == "canva" for e in edges)
    # gmail -> netflix
    assert any(e["source"] == "gmail" and e["target"] == "netflix" for e in edges)


def test_to_view_persona():
    persona_path = Path(__file__).resolve().parent.parent / "app" / "data" / "persona.json"
    with open(persona_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    state = State.model_validate(data)

    catalog_path = Path(__file__).resolve().parent.parent / "app" / "data" / "catalog.json"
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    graph = build_graph(state, catalog, state.settings)
    view = to_view(graph)

    nodes = {n["id"]: n for n in view["nodes"]}
    edges = view["edges"]

    # 1. Group nodes exist for A and B
    assert "GROUP:A" in nodes
    assert "GROUP:B" in nodes
    assert nodes["GROUP:A"]["kind"] == "group"
    assert nodes["GROUP:B"]["kind"] == "group"

    # 2. E_SIM has edges to gmail, amazon, upi, zomato
    sim_targets = {e["target"] for e in edges if e["source"] == "E_SIM"}
    assert {"gmail", "amazon", "upi", "zomato"}.issubset(sim_targets)

    # 3. gmail has edges to the accounts that use it (recovery or sso or permission)
    gmail_targets = {e["target"] for e in edges if e["source"] == "gmail"}
    # Accounts using gmail: amazon, netflix, zomato, instagram, linkedin, canva, photoedit
    expected_using_gmail = {"amazon", "netflix", "zomato", "instagram", "linkedin", "canva"}
    assert expected_using_gmail.issubset(gmail_targets)

    # 4. Hub layers: gmail and hotmail are hubs
    assert nodes["gmail"]["layer"] == 1
    assert nodes["hotmail"]["layer"] == 1
