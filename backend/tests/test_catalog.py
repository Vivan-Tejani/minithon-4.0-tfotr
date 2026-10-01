import json
from pathlib import Path
import pytest
from backend.app.data.loader import (
    CatalogEntry,
    load_catalog,
    load_catalog_list,
    CATALOG_PATH,
)

VALID_TYPES = {
    "email",
    "social",
    "shopping",
    "finance",
    "payments",
    "storage",
    "entertainment",
    "professional",
    "utility_app",
    "forum",
    "other",
}

VALID_LOGIN_METHODS = {"password", "sms_otp", "sso"}
VALID_SECOND_FACTORS = {"sms", "authenticator", "hardware_key"}
HARDWARE_KEY_ALLOWED = {"gmail", "google_drive", "github", "dropbox", "facebook", "x", "discord", "outlook"}


def test_catalog_file_exists():
    assert CATALOG_PATH.exists(), f"catalog.json not found at {CATALOG_PATH}"


def test_catalog_top_level_note():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "_note" in data
    assert "illustrative demo data" in data["_note"]


def test_catalog_loads_every_entry_as_pydantic():
    catalog = load_catalog()
    assert len(catalog) >= 25, f"Expected at least 25 entries, found {len(catalog)}"
    for key, entry in catalog.items():
        assert isinstance(entry, CatalogEntry)
        assert entry.key == key
        assert entry.name
        assert entry.type in VALID_TYPES


def test_no_duplicate_keys():
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        raw_text = f.read()

    # JSON decoder in python will silently overwrite duplicate keys if parsed into dict.
    # We inspect object pairs with json.loads object_pairs_hook to guarantee zero duplicates.
    keys = []

    def check_duplicates(pairs):
        seen = set()
        for k, _ in pairs:
            assert k not in seen, f"Duplicate key found in catalog.json: {k}"
            seen.add(k)
            keys.append(k)
        return dict(pairs)

    json.loads(raw_text, object_pairs_hook=check_duplicates)


def test_at_least_three_email_types():
    catalog = load_catalog()
    email_entries = [e for e in catalog.values() if e.type == "email"]
    assert len(email_entries) >= 3, f"Expected >= 3 email-type entries, got {len(email_entries)}"


def test_at_least_three_recovery_bypasses_2fa_false():
    catalog = load_catalog()
    strict_recovery = [e for e in catalog.values() if not e.recovery_bypasses_2fa]
    assert len(strict_recovery) >= 3, (
        f"Expected >= 3 entries with recovery_bypasses_2fa=False, got {len(strict_recovery)}"
    )
    # Ensure netbanking and upi_app have recovery_bypasses_2fa=False as specified
    assert catalog["netbanking"].recovery_bypasses_2fa is False
    assert catalog["upi_app"].recovery_bypasses_2fa is False


def test_second_factors_and_login_methods():
    catalog = load_catalog()
    for key, entry in catalog.items():
        for method in entry.login_methods_supported:
            assert method in VALID_LOGIN_METHODS, f"Invalid login method {method} in {key}"
        for factor in entry.second_factors_supported:
            assert factor in VALID_SECOND_FACTORS, f"Invalid 2FA {factor} in {key}"
            if factor == "hardware_key":
                assert key in HARDWARE_KEY_ALLOWED, f"Hardware key not expected for {key}"


def test_suggested_keys_all_present():
    catalog = load_catalog()
    suggested = [
        "gmail",
        "outlook",
        "yahoo_mail",
        "amazon",
        "flipkart",
        "netflix",
        "spotify",
        "zomato",
        "swiggy",
        "instagram",
        "facebook",
        "x",
        "linkedin",
        "github",
        "discord",
        "reddit",
        "dropbox",
        "google_drive",
        "canva",
        "uber",
        "upi_app",
        "netbanking",
        "photo_editor_app",
        "generic_forum",
        "generic_app",
    ]
    for key in suggested:
        assert key in catalog, f"Suggested key '{key}' missing from catalog.json"


def test_load_catalog_list_ignores_underscored_keys():
    entries = load_catalog_list()
    assert all(not e.key.startswith("_") for e in entries)
    assert len(entries) == len(load_catalog())
