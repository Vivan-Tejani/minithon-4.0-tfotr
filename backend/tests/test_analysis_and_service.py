import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import store


@pytest.fixture(autouse=True)
def clean_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_chokepoint.db"
    monkeypatch.setattr(store, "DB_PATH", test_db)
    monkeypatch.setattr(store, "get_db_path", lambda: test_db)
    store.init_db(test_db)
    yield test_db


client = TestClient(app)


def test_seed_demo_and_analysis():
    # Seed demo persona
    seed_res = client.post("/api/seed/demo")
    assert seed_res.status_code == 200

    # Snapshot recorded with real score and el
    snaps_res = client.get("/api/snapshots")
    assert snaps_res.status_code == 200
    snaps = snaps_res.json()
    assert len(snaps) >= 1
    assert snaps[0]["label"] == "Demo persona loaded"
    assert snaps[0]["score"] is not None
    assert snaps[0]["el"] is not None

    # Fetch /api/analysis
    analysis_res = client.get("/api/analysis")
    assert analysis_res.status_code == 200
    data = analysis_res.json()

    # Verify PRD §7 response shape
    assert "score" in data
    assert "el" in data
    assert "worst" in data
    assert "headline" in data
    assert "accounts" in data
    assert "spofs" in data
    assert "crown_path" in data
    assert "graph" in data

    # 12 accounts with why strings, reasons, top_paths
    assert len(data["accounts"]) == 12
    for acct in data["accounts"]:
        assert "id" in acct
        assert "name" in acct
        assert "p" in acct
        assert "band" in acct
        assert "impact" in acct
        assert "why" in acct
        assert len(acct["why"]) > 0
        assert "reasons" in acct
        assert "top_paths" in acct

    # SPOFs check
    assert len(data["spofs"]) > 0
    top_spof = data["spofs"][0]
    assert top_spof["id"] == "E_SIM"
    assert top_spof["falls"] == 9

    # Graph check
    graph = data["graph"]
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) > 10
    assert len(graph["edges"]) > 10


def test_export_import_roundtrip():
    # Seed persona
    client.post("/api/seed/demo")

    # Export state
    exp_res = client.get("/api/export")
    assert exp_res.status_code == 200
    exported_data = exp_res.json()
    assert len(exported_data["accounts"]) == 12

    # Reset store
    store.reset()
    assert len(client.get("/api/state").json()["accounts"]) == 0

    # Import state
    imp_res = client.post("/api/import", json=exported_data)
    assert imp_res.status_code == 200

    # State restored
    restored_state = client.get("/api/state").json()
    assert len(restored_state["accounts"]) == 12

    # Analysis after restore
    analysis_res = client.get("/api/analysis")
    assert analysis_res.status_code == 200
    assert analysis_res.json()["score"] == 49
