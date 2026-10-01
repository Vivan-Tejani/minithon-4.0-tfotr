import pytest
from backend.app.data.loader import load_persona, load_catalog
from backend.app.engines.fix_library import (
    Fix,
    generate_candidates,
    apply_fix,
)


def test_generate_candidates_on_persona():
    state = load_persona()
    catalog = load_catalog()
    candidates = generate_candidates(state, catalog)
    candidate_ids = {f.id for f in candidates}

    # Must include these key candidates
    assert "sim_lock" in candidate_ids
    assert "unique_pw:A" in candidate_ids
    assert "2fa:dropbox" in candidate_ids
    assert "delete:oldforum" in candidate_ids
    assert "rm_recovery:dropbox:email:hotmail" in candidate_ids

    # device_lock is already True on persona, must NOT be a candidate
    assert "device_lock" not in candidate_ids


def test_fix_type_sim_lock():
    state = load_persona()
    assert state.anchors.phone.sim_lock is False
    fixed = apply_fix(state, "sim_lock")
    assert fixed.anchors.phone.sim_lock is True
    # Pure check: original state untouched
    assert state.anchors.phone.sim_lock is False


def test_fix_type_device_lock():
    state = load_persona()
    state.anchors.phone.device_lock = False
    fixed = apply_fix(state, "device_lock")
    assert fixed.anchors.phone.device_lock is True


def test_fix_type_2fa():
    state = load_persona()
    acct = next(a for a in state.accounts if a.id == "dropbox")
    assert acct.second_factor == "none"

    fixed = apply_fix(state, "2fa:dropbox")
    fixed_acct = next(a for a in fixed.accounts if a.id == "dropbox")
    assert fixed_acct.second_factor == "authenticator"


def test_fix_type_rm_login():
    state = load_persona()
    amazon = next(a for a in state.accounts if a.id == "amazon")
    assert "sms_otp" in amazon.login_methods

    fixed = apply_fix(state, "rm_login:amazon:sms_otp")
    fixed_amazon = next(a for a in fixed.accounts if a.id == "amazon")
    assert "sms_otp" not in fixed_amazon.login_methods
    assert "password" in fixed_amazon.login_methods


def test_fix_type_rm_recovery():
    state = load_persona()
    dropbox = next(a for a in state.accounts if a.id == "dropbox")
    assert "email:hotmail" in dropbox.recovery

    fixed = apply_fix(state, "rm_recovery:dropbox:email:hotmail")
    fixed_dropbox = next(a for a in fixed.accounts if a.id == "dropbox")
    assert "email:hotmail" not in fixed_dropbox.recovery


def test_fix_type_unique_pw():
    state = load_persona()
    group_a_accts = [a for a in state.accounts if a.password_group == "A"]
    assert len(group_a_accts) >= 4

    fixed = apply_fix(state, "unique_pw:A")
    remaining_group_a = [a for a in fixed.accounts if a.password_group == "A"]
    assert len(remaining_group_a) == 0


def test_fix_type_revoke():
    state = load_persona()
    photoedit = next(a for a in state.accounts if a.id == "photoedit")
    assert "photos" in photoedit.permissions

    fixed = apply_fix(state, "revoke:photoedit:photos")
    fixed_photoedit = next(a for a in fixed.accounts if a.id == "photoedit")
    assert "photos" not in fixed_photoedit.permissions
    assert "email_inbox:gmail" in fixed_photoedit.permissions


def test_fix_type_delete_safe():
    state = load_persona()
    oldforum = next((a for a in state.accounts if a.id == "oldforum"), None)
    assert oldforum is not None

    fixed = apply_fix(state, "delete:oldforum")
    assert not any(a.id == "oldforum" for a in fixed.accounts)
    assert len(fixed.accounts) == 11


def test_delete_skipped_when_leaving_account_without_login():
    state = load_persona()
    # LinkedIn and PhotoEdit only have sso:gmail as login method.
    # Deleting gmail would leave them without any login method.
    fixed = apply_fix(state, "delete:gmail")
    # Deletion must be skipped; state remains unchanged
    assert any(a.id == "gmail" for a in fixed.accounts)
    assert len(fixed.accounts) == 12


def test_apply_fix_idempotence():
    state = load_persona()
    fixes_to_test = [
        "sim_lock",
        "2fa:dropbox",
        "rm_login:amazon:sms_otp",
        "rm_recovery:dropbox:email:hotmail",
        "unique_pw:A",
        "revoke:photoedit:photos",
        "delete:oldforum",
    ]

    for fid in fixes_to_test:
        once = apply_fix(state, fid)
        twice = apply_fix(once, fid)
        assert once.model_dump() == twice.model_dump(), f"Fix {fid} is not idempotent!"


def test_fix_dataclass_properties():
    state = load_persona()
    candidates = generate_candidates(state)
    for f in candidates:
        assert isinstance(f, Fix)
        assert f.id
        assert f.type in {"sim_lock", "device_lock", "2fa", "rm_login", "rm_recovery", "unique_pw", "revoke", "delete"}
        assert f.title
        assert f.target
        assert f.effort in {"low", "medium", "high"}
        assert f.why
        assert f.why.endswith(".")
