import tempfile
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.data.loader import load_persona, load_catalog
from backend.app.engines.scenario_review import (
    compute_preview,
    add_snapshot,
    get_snapshots,
    init_db,
)
from backend.app.routes_m3 import (
    router as m3_router,
    get_current_state,
    save_current_state,
    _ACTIVE_STATE,
)


@pytest.fixture(autouse=True)
def reset_active_state():
    import backend.app.routes_m3 as r_m3
    r_m3._ACTIVE_STATE = load_persona()
    yield
    r_m3._ACTIVE_STATE = None


def test_preview_downgrading_2fa_lowers_score():
    state = load_persona()
    catalog = load_catalog()

    # Find gmail and change second_factor from sms to none
    gmail_acct = next(a for a in state.accounts if a.id == "gmail")
    modified_gmail = gmail_acct.model_dump()
    modified_gmail["second_factor"] = "none"

    res = compute_preview(
        state=state,
        op="upsert_account",
        payload_data=modified_gmail,
        catalog=catalog,
    )

    # Score before: 61, score after should be lower (worse)
    assert res["score_after"] < res["score_before"]
    assert res["d_el"] > 0


def test_preview_applying_sim_lock_raises_score_and_empty_ghost():
    state = load_persona()
    catalog = load_catalog()

    res = compute_preview(
        state=state,
        op="apply_fix",
        payload_data="sim_lock",
        catalog=catalog,
    )

    # Score after is higher
    assert res["score_after"] > res["score_before"]
    assert res["d_el"] < 0

    # Ghost nodes and edges must be empty since no new nodes/edges were added
    assert len(res["ghost"]["nodes"]) == 0
    assert len(res["ghost"]["edges"]) == 0


def test_preview_is_strictly_read_only():
    state = load_persona()
    catalog = load_catalog()
    dump_before = state.model_dump()

    # Run preview
    compute_preview(
        state=state,
        op="apply_fix",
        payload_data="sim_lock",
        catalog=catalog,
    )

    assert state.model_dump() == dump_before


def test_preview_new_account_has_ghost_nodes_and_edges():
    state = load_persona()
    catalog = load_catalog()

    new_account = {
        "id": "newapp",
        "name": "New App",
        "service_key": "generic_app",
        "type": "utility_app",
        "login_methods": ["password"],
        "second_factor": "none",
        "recovery": ["email:gmail"],
        "password_group": None,
        "permissions": [],
        "data_held": ["payment"],
        "last_activity": "2026-10-01",
        "breach_flag": False,
        "importance_override": None,
    }

    res = compute_preview(
        state=state,
        op="upsert_account",
        payload_data=new_account,
        catalog=catalog,
    )

    ghost_node_ids = {n["id"] for n in res["ghost"]["nodes"]}
    assert "ACC:newapp" in ghost_node_ids
    assert all(n["ghost"] is True for n in res["ghost"]["nodes"])
    assert any(e["ghost"] is True for e in res["ghost"]["edges"])


def test_api_preview_and_apply_fix():
    from backend.app.routes_m3 import save_current_state
    save_current_state(load_persona())
    app = FastAPI()
    app.include_router(m3_router, prefix="/api")
    client = TestClient(app)

    # 1. Preview via API
    resp_prev = client.post("/api/preview", json={"op": "apply_fix", "fix_id": "sim_lock"})
    assert resp_prev.status_code == 200
    pdata = resp_prev.json()
    assert pdata["score_after"] > pdata["score_before"]

    # 2. Get snapshots before apply
    snaps_before = client.get("/api/snapshots").json()
    count_before = len(snaps_before)

    # 3. Apply fix
    resp_apply = client.post("/api/fixes/sim_lock/apply")
    assert resp_apply.status_code == 200
    adata = resp_apply.json()
    assert adata["score_after"] > adata["score_before"]

    # 4. Snapshots increased by 1
    snaps_after = client.get("/api/snapshots").json()
    assert len(snaps_after) == count_before + 1
    latest_snap = snaps_after[-1]
    assert "Applied:" in latest_snap["label"]
    assert latest_snap["score"] == adata["score_after"]

    # 5. Applying a second time is a no-op and adds NO second snapshot
    resp_apply_again = client.post("/api/fixes/sim_lock/apply")
    assert resp_apply_again.status_code == 200
    snaps_after_again = client.get("/api/snapshots").json()
    assert len(snaps_after_again) == len(snaps_after)

    # 6. 404 for unknown fix
    resp_404 = client.post("/api/fixes/nonexistent_xyz/apply")
    assert resp_404.status_code == 404
