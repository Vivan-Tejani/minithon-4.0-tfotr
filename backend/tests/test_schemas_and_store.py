import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app import store
from app.schemas import Account, Anchors, Settings, State, slugify


@pytest.fixture(autouse=True)
def clean_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test_chokepoint.db"
    monkeypatch.setattr(store, "DB_PATH", test_db)
    monkeypatch.setattr(store, "get_db_path", lambda: test_db)
    store.init_db(test_db)
    yield test_db


client = TestClient(app)


def test_slugify():
    assert slugify("Google Mail") == "google_mail"
    assert slugify("Amazon 2.0!") == "amazon_20"
    assert slugify("My-Account") == "my_account"


def test_get_state_default():
    resp = client.get("/api/state")
    assert resp.status_code == 200
    data = resp.json()
    assert "anchors" in data
    assert "accounts" in data
    assert data["accounts"] == []
    assert data["anchors"]["phone"]["sim_lock"] is False
    assert data["anchors"]["phone"]["device_lock"] is True


def test_anchors_roundtrip():
    update_data = {"phone": {"sim_lock": True, "device_lock": False}}
    resp = client.put("/api/anchors", json=update_data)
    assert resp.status_code == 200
    assert resp.json() == update_data

    # Verify state persistence
    state_resp = client.get("/api/state")
    assert state_resp.json()["anchors"] == update_data

    # Verify snapshot was recorded
    snapshots = client.get("/api/snapshots").json()
    assert len(snapshots) >= 1
    assert snapshots[-1]["label"] == "Updated phone anchors"


def test_settings_roundtrip():
    new_settings = Settings(p_sim=0.15, trials=1000).model_dump()
    resp = client.put("/api/settings", json=new_settings)
    assert resp.status_code == 200
    assert resp.json()["p_sim"] == 0.15
    assert resp.json()["trials"] == 1000

    get_resp = client.get("/api/settings")
    assert get_resp.json()["p_sim"] == 0.15


def test_accounts_crud():
    # 1. Create an email account
    gmail_payload = {
        "id": "gmail",
        "name": "Gmail",
        "service_key": "gmail",
        "type": "email",
        "login_methods": ["password"],
        "second_factor": "sms",
        "recovery": ["sms"],
        "password_group": None,
        "permissions": [],
        "data_held": ["private_messages", "contacts"],
        "last_activity": "2026-09-01",
        "breach_flag": False,
        "importance_override": 8,
    }
    resp1 = client.post("/api/accounts", json=gmail_payload)
    assert resp1.status_code == 201
    assert resp1.json()["id"] == "gmail"

    # 2. Create second account depending on gmail
    amazon_payload = {
        "id": "amazon",
        "name": "Amazon",
        "service_key": "amazon",
        "type": "shopping",
        "login_methods": ["password", "sms_otp"],
        "second_factor": "none",
        "recovery": ["email:gmail"],
        "password_group": "A",
        "permissions": [],
        "data_held": ["payment"],
        "last_activity": "2026-09-10",
        "breach_flag": False,
    }
    resp2 = client.post("/api/accounts", json=amazon_payload)
    assert resp2.status_code == 201

    # 3. Update amazon account
    amazon_payload["second_factor"] = "sms"
    resp3 = client.put("/api/accounts/amazon", json=amazon_payload)
    assert resp3.status_code == 200
    assert resp3.json()["second_factor"] == "sms"

    # 4. Check state contains both accounts
    state = client.get("/api/state").json()
    assert len(state["accounts"]) == 2

    # 5. Delete amazon account
    resp_del = client.delete("/api/accounts/amazon")
    assert resp_del.status_code == 200

    state_after = client.get("/api/state").json()
    assert len(state_after["accounts"]) == 1
    assert state_after["accounts"][0]["id"] == "gmail"


def test_delete_account_conflict_with_dependents():
    # Setup: gmail (email) and amazon (depends on email:gmail)
    gmail_payload = {
        "id": "gmail",
        "name": "Gmail",
        "service_key": "gmail",
        "type": "email",
        "login_methods": ["password"],
        "second_factor": "none",
        "recovery": [],
        "last_activity": "2026-09-01",
    }
    client.post("/api/accounts", json=gmail_payload)

    amazon_payload = {
        "id": "amazon",
        "name": "Amazon",
        "service_key": "amazon",
        "type": "shopping",
        "login_methods": ["password"],
        "recovery": ["email:gmail"],
        "last_activity": "2026-09-01",
    }
    client.post("/api/accounts", json=amazon_payload)

    # Attempt to delete gmail - should return 409
    del_resp = client.delete("/api/accounts/gmail")
    assert del_resp.status_code == 409
    data = del_resp.json()
    assert "Cannot delete account" in data["detail"]
    assert any("amazon" in dep for dep in data["dependents"])


def test_validation_duplicate_id():
    acct1 = {
        "id": "netflix",
        "name": "Netflix",
        "service_key": "netflix",
        "type": "entertainment",
        "last_activity": "2026-09-01",
    }
    res1 = client.post("/api/accounts", json=acct1)
    assert res1.status_code == 201

    res2 = client.post("/api/accounts", json=acct1)
    assert res2.status_code == 422
    assert "already exists" in res2.json()["detail"]


def test_validation_unknown_recovery_target():
    acct = {
        "id": "netflix",
        "name": "Netflix",
        "service_key": "netflix",
        "type": "entertainment",
        "recovery": ["email:unknown_email_account"],
        "last_activity": "2026-09-01",
    }
    res = client.post("/api/accounts", json=acct)
    assert res.status_code == 422
    assert "unknown account id 'unknown_email_account'" in res.json()["detail"]


def test_validation_unknown_sso_target():
    acct = {
        "id": "linkedin",
        "name": "LinkedIn",
        "service_key": "linkedin",
        "type": "professional",
        "login_methods": ["sso:nonexistent_google"],
        "last_activity": "2026-09-01",
    }
    res = client.post("/api/accounts", json=acct)
    assert res.status_code == 422
    assert "unknown account id 'nonexistent_google'" in res.json()["detail"]


def test_validation_recovery_target_not_email():
    # Create a shopping account
    amazon = {
        "id": "amazon",
        "name": "Amazon",
        "service_key": "amazon",
        "type": "shopping",
        "last_activity": "2026-09-01",
    }
    client.post("/api/accounts", json=amazon)

    # Create account with recovery pointing to amazon (shopping, not email!)
    netflix = {
        "id": "netflix",
        "name": "Netflix",
        "service_key": "netflix",
        "type": "entertainment",
        "recovery": ["email:amazon"],
        "last_activity": "2026-09-01",
    }
    res = client.post("/api/accounts", json=netflix)
    assert res.status_code == 422
    assert "must have type='email'" in res.json()["detail"]


def test_validation_self_reference():
    acct = {
        "id": "gmail",
        "name": "Gmail",
        "service_key": "gmail",
        "type": "email",
        "recovery": ["email:gmail"],
        "last_activity": "2026-09-01",
    }
    res = client.post("/api/accounts", json=acct)
    assert res.status_code == 422
    assert "self-referencing" in res.json()["detail"]


def test_validation_importance_override_bounds():
    acct_low = {
        "id": "test1",
        "name": "Test1",
        "service_key": "test",
        "type": "other",
        "last_activity": "2026-09-01",
        "importance_override": 0,
    }
    res1 = client.post("/api/accounts", json=acct_low)
    assert res1.status_code == 422

    acct_high = {
        "id": "test2",
        "name": "Test2",
        "service_key": "test",
        "type": "other",
        "last_activity": "2026-09-01",
        "importance_override": 11,
    }
    res2 = client.post("/api/accounts", json=acct_high)
    assert res2.status_code == 422


def test_catalog_empty_fallback():
    res = client.get("/api/catalog")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
