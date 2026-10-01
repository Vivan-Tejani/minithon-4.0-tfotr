import tempfile
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.data.loader import load_persona, load_catalog
from backend.app.engines.scenario_review import run_scenario, get_events
from backend.app.routes_m3 import router as m3_router


@pytest.fixture
def tmp_db():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / "test_scenario.db"


def test_sim_swap_scenario_persona(tmp_db):
    state = load_persona()
    catalog = load_catalog()

    res = run_scenario(
        state=state,
        kind="entry",
        target="E_SIM",
        catalog=catalog,
        settings=state.settings,
        record_event=True,
        db_path=tmp_db,
    )

    # 9 falls over 2 rounds
    assert res["falls"] == 9
    assert len(res["cascade"]) == 2

    # Round 1 has gmail
    round_1_ids = {a["id"] for a in res["cascade"][0]["accounts"]}
    assert "gmail" in round_1_ids

    # Round 2 has canva
    round_2_ids = {a["id"] for a in res["cascade"][1]["accounts"]}
    assert "canva" in round_2_ids

    # All 9 accounts
    all_falls = round_1_ids | round_2_ids
    assert all_falls == {
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

    # next_actions[0] for SIM swap is sim_lock or an account-level SMS removal
    next_actions = res["next_actions"]
    assert len(next_actions) > 0
    top_action = next_actions[0]
    assert top_action["id"] == "sim_lock" or "sms" in top_action["id"]
    # Targets the cascade or anchor
    assert top_action["target"] in (all_falls | {"phone"})

    # Event logged
    events = get_events(limit=10, db_path=tmp_db)
    assert any(e["kind"] == "scenario" and "SIM" in e["title"] for e in events)


def test_lost_phone_scenario_device_lock_on(tmp_db):
    state = load_persona()
    catalog = load_catalog()

    # Lost phone with device lock on
    res = run_scenario(
        state=state,
        kind="entry",
        target="E_PHONE",
        catalog=catalog,
        settings=state.settings,
        record_event=False,
        db_path=tmp_db,
    )
    assert res["falls"] == 0
    assert len(res["cascade"]) == 0


def test_breach_netflix_scenario(tmp_db):
    state = load_persona()
    catalog = load_catalog()

    res = run_scenario(
        state=state,
        kind="breach",
        target="netflix",
        catalog=catalog,
        settings=state.settings,
        record_event=True,
        db_path=tmp_db,
    )

    # Leaked group is "A"
    assert res["leaked_group"] == "A"

    # Falls include dropbox in round 2 (via hotmail inbox recovery)
    assert len(res["cascade"]) >= 2
    round_2_ids = {a["id"] for a in res["cascade"][1]["accounts"]}
    assert "dropbox" in round_2_ids


def test_scenario_validation_errors(tmp_db):
    state = load_persona()
    catalog = load_catalog()

    # Invalid kind
    with pytest.raises(ValueError, match="Invalid scenario kind"):
        run_scenario(state=state, kind="unknown", target="E_SIM", catalog=catalog, db_path=tmp_db)

    # Invalid entry target
    with pytest.raises(ValueError, match="Invalid entry target"):
        run_scenario(state=state, kind="entry", target="invalid_entry", catalog=catalog, db_path=tmp_db)

    # Unknown account target for breach
    with pytest.raises(ValueError, match="Unknown account target"):
        run_scenario(state=state, kind="breach", target="nonexistent_acct", catalog=catalog, db_path=tmp_db)


def test_api_post_scenario():
    app = FastAPI()
    app.include_router(m3_router, prefix="/api")
    client = TestClient(app)

    # 1. Valid SIM swap
    resp = client.post("/api/scenario", json={"kind": "entry", "target": "E_SIM"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["falls"] == 9
    assert len(data["next_actions"]) > 0

    # 2. Invalid target -> 422
    resp_bad = client.post("/api/scenario", json={"kind": "entry", "target": "INVALID"})
    assert resp_bad.status_code == 422
