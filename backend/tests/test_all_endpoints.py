"""Comprehensive end-to-end integration test covering 100% of frontend-backend API endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import store


@pytest.fixture(autouse=True)
def clean_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_all_endpoints.db"
    monkeypatch.setattr(store, "DB_PATH", test_db)
    monkeypatch.setattr(store, "get_db_path", lambda: test_db)
    store.init_db(test_db)
    yield test_db


client = TestClient(app)


def test_every_api_endpoint_end_to_end():
    # 1. Health
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"ok": True}

    # 2. Seed Demo
    res_seed = client.post("/api/seed/demo")
    assert res_seed.status_code == 200
    assert res_seed.json() == {"ok": True}

    # 3. Get State
    res_state = client.get("/api/state")
    assert res_state.status_code == 200
    state = res_state.json()
    assert "anchors" in state
    assert "accounts" in state
    assert len(state["accounts"]) == 12

    # 4. Put Anchors
    res_anchors = client.put("/api/anchors", json={"phone": {"sim_lock": True, "device_lock": True}})
    assert res_anchors.status_code == 200
    assert res_anchors.json()["phone"]["sim_lock"] is True

    # 5. Post Accounts (Create)
    new_account = {
        "id": "test_service",
        "name": "Test Service",
        "type": "other",
        "service_key": "custom",
        "importance_override": 3,
        "login_methods": ["password"],
        "second_factor": "none",
        "recovery": ["sms"],
        "permissions": [],
        "password_group": "group_test",
        "breach_flag": False,
        "last_activity": "2026-03-31",
    }
    res_create_acct = client.post("/api/accounts", json=new_account)
    assert res_create_acct.status_code == 201
    assert res_create_acct.json()["id"] == "test_service"

    # 6. Put Accounts (Update)
    new_account["second_factor"] = "sms"
    res_update_acct = client.put("/api/accounts/test_service", json=new_account)
    assert res_update_acct.status_code == 200
    assert res_update_acct.json()["second_factor"] == "sms"

    # 7. Get Catalog
    res_cat = client.get("/api/catalog")
    assert res_cat.status_code == 200
    assert isinstance(res_cat.json(), list)
    assert len(res_cat.json()) > 0

    # 8. Get Settings
    res_get_sett = client.get("/api/settings")
    assert res_get_sett.status_code == 200
    sett = res_get_sett.json()
    assert "p_sim" in sett

    # 9. Put Settings
    sett["sim_lock_mult"] = 0.05
    res_put_sett = client.put("/api/settings", json=sett)
    assert res_put_sett.status_code == 200
    assert res_put_sett.json()["sim_lock_mult"] == 0.05

    # 10. Get Analysis
    res_analysis = client.get("/api/analysis")
    assert res_analysis.status_code == 200
    analysis = res_analysis.json()
    assert "score" in analysis
    assert "el" in analysis
    assert "worst" in analysis
    assert "headline" in analysis
    assert "accounts" in analysis
    assert "spofs" in analysis
    assert "graph" in analysis

    # 11. Get Paths for Account
    res_paths = client.get("/api/paths/gmail")
    assert res_paths.status_code == 200
    assert "paths" in res_paths.json()
    assert len(res_paths.json()["paths"]) >= 1

    # 12. Get Baseline Compare
    res_compare = client.get("/api/compare")
    assert res_compare.status_code == 200
    compare_data = res_compare.json()
    assert "baseline_top3" in compare_data
    assert "chokepoint_top3" in compare_data
    assert "baseline_score_after" in compare_data
    assert "chokepoint_score_after" in compare_data
    assert "divergence_explanation" in compare_data

    # 13. Get Snapshots
    res_snaps = client.get("/api/snapshots")
    assert res_snaps.status_code == 200
    snaps = res_snaps.json()
    assert isinstance(snaps, list)
    assert len(snaps) >= 1

    # 14. Get Events
    res_events = client.get("/api/events")
    assert res_events.status_code == 200
    events = res_events.json()
    assert isinstance(events, list)
    assert len(events) >= 1

    # 15. Get Fixes Plan
    res_fixes = client.get("/api/fixes")
    assert res_fixes.status_code == 200
    fixes = res_fixes.json()
    assert "plan" in fixes
    assert "best3" in fixes
    assert "quick_wins" in fixes
    assert "base_score" in fixes
    assert len(fixes["plan"]) > 0

    # 16. Post Apply Fix
    first_fix_id = fixes["plan"][0]["id"]
    res_apply = client.post(f"/api/fixes/{first_fix_id}/apply")
    assert res_apply.status_code == 200
    apply_res = res_apply.json()
    assert "score_before" in apply_res
    assert "score_after" in apply_res
    assert "state_version" in apply_res

    # 17. Post Preview (Fix)
    res_preview_fix = client.post("/api/preview", json={"op": "apply_fix", "fix_id": "sim_lock"})
    assert res_preview_fix.status_code == 200
    prev_fix_data = res_preview_fix.json()
    assert "score_before" in prev_fix_data
    assert "score_after" in prev_fix_data

    # 18. Post Preview (Upsert Account)
    res_preview_acct = client.post(
        "/api/preview",
        json={
            "op": "upsert_account",
            "account": {
                "id": "preview_acc",
                "name": "Preview Account",
                "type": "finance",
                "service_key": "custom",
                "importance_override": "high",
                "login_methods": ["password"],
                "second_factor": "none",
                "recovery": ["sms"],
                "permissions": [],
            },
        },
    )
    assert res_preview_acct.status_code == 200
    prev_acct_data = res_preview_acct.json()
    assert "score_before" in prev_acct_data
    assert "score_after" in prev_acct_data

    # 19. Post Scenario (Entry SIM)
    res_scen_sim = client.post("/api/scenario", json={"kind": "entry", "target": "E_SIM"})
    assert res_scen_sim.status_code == 200
    scen_sim_data = res_scen_sim.json()
    assert "scenario" in scen_sim_data
    assert "cascade" in scen_sim_data
    assert "falls" in scen_sim_data
    assert "next_actions" in scen_sim_data

    # 20. Post Scenario (Breach)
    res_scen_breach = client.post("/api/scenario", json={"kind": "breach", "target": "netflix"})
    assert res_scen_breach.status_code == 200
    scen_breach_data = res_scen_breach.json()
    assert scen_breach_data["scenario"]["kind"] == "breach"
    assert "cascade" in scen_breach_data

    # 21. Post Scenario (Compromise)
    res_scen_comp = client.post("/api/scenario", json={"kind": "compromise", "target": "gmail"})
    assert res_scen_comp.status_code == 200
    scen_comp_data = res_scen_comp.json()
    assert scen_comp_data["scenario"]["kind"] == "compromise"
    assert "cascade" in scen_comp_data

    # 22. Get Review
    res_review = client.get("/api/review")
    assert res_review.status_code == 200
    review_data = res_review.json()
    assert "as_of" in review_data
    assert "items" in review_data
    assert len(review_data["items"]) > 0

    # 23. Post Review Complete
    res_review_done = client.post("/api/review/complete", json={"as_of": "2026-10-01"})
    assert res_review_done.status_code == 200
    assert res_review_done.json()["ok"] is True
    assert res_review_done.json()["last_review_at"] == "2026-10-01"

    # 24. Get Export
    res_export = client.get("/api/export")
    assert res_export.status_code == 200
    export_json = res_export.json()
    assert "accounts" in export_json

    # 25. Delete Account
    res_del = client.delete("/api/accounts/test_service")
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True

    # 26. Post Import
    res_import = client.post("/api/import", json=export_json)
    assert res_import.status_code == 200
    assert len(res_import.json()["accounts"]) == len(export_json["accounts"])

    # 27. Post Reset
    res_reset = client.post("/api/reset")
    assert res_reset.status_code == 200
    assert res_reset.json() == {"ok": True}
    res_empty_state = client.get("/api/state")
    assert len(res_empty_state.json()["accounts"]) == 0
