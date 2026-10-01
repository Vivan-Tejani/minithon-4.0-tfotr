import tempfile
from pathlib import Path
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.data.loader import load_persona, load_catalog
from backend.app.engines.scenario_review import (
    ReviewItem,
    run_review,
    add_event,
    get_events,
    init_db,
    SEVERITY_ORDER,
)
from backend.app.routes_m3 import router as m3_router


@pytest.fixture
def tmp_db():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / "test_chokepoint.db"


def test_review_rules_on_persona(tmp_db):
    state = load_persona()
    catalog = load_catalog()
    as_of = "2026-10-01"

    items = run_review(
        state=state,
        catalog=catalog,
        settings=state.settings,
        as_of=as_of,
        record_events=True,
        db_path=tmp_db,
    )
    items_by_id = {it.id: it for it in items}

    # 1. Stale items for hotmail and oldforum
    assert "stale_account:hotmail" in items_by_id
    assert items_by_id["stale_account:hotmail"].severity == "high"
    assert items_by_id["stale_account:hotmail"].fix_id == "delete:hotmail"

    assert "stale_account:oldforum" in items_by_id
    assert items_by_id["stale_account:oldforum"].severity == "high"
    assert items_by_id["stale_account:oldforum"].fix_id == "delete:oldforum"

    # 2. unused_backup_email for hotmail (dependents: dropbox, oldforum)
    assert "unused_backup_email:hotmail" in items_by_id
    item_backup = items_by_id["unused_backup_email:hotmail"]
    assert item_backup.severity == "high"
    assert item_backup.dependents == ["dropbox", "oldforum"]
    assert item_backup.fix_id == "rm_recovery:dropbox:email:hotmail"

    # 3. weak_2fa includes upi and dropbox and amazon
    assert "weak_2fa:upi" in items_by_id
    assert items_by_id["weak_2fa:upi"].severity == "high"
    assert items_by_id["weak_2fa:upi"].fix_id == "2fa:upi"

    assert "weak_2fa:dropbox" in items_by_id
    assert items_by_id["weak_2fa:dropbox"].severity == "high"
    assert items_by_id["weak_2fa:dropbox"].fix_id == "2fa:dropbox"

    assert "weak_2fa:amazon" in items_by_id
    assert items_by_id["weak_2fa:amazon"].severity == "high"
    assert items_by_id["weak_2fa:amazon"].fix_id == "2fa:amazon"

    # 4. reuse for groups A and B
    assert "reuse:A" in items_by_id
    assert items_by_id["reuse:A"].severity == "medium"
    assert items_by_id["reuse:A"].fix_id == "unique_pw:A"

    assert "reuse:B" in items_by_id
    assert items_by_id["reuse:B"].severity == "medium"
    assert items_by_id["reuse:B"].fix_id == "unique_pw:B"

    # 5. periodic_review appears when last_review_at is older than 30 days (None on persona)
    assert "periodic_review:general" in items_by_id
    assert items_by_id["periodic_review:general"].severity == "low"
    assert items_by_id["periodic_review:general"].fix_id is None

    # 6. Severity ordering: high -> medium -> low
    severities = [SEVERITY_ORDER[it.severity] for it in items]
    assert severities == sorted(severities), "Items are not sorted by severity high -> medium -> low"


def test_periodic_review_suppressed_when_recent(tmp_db):
    state = load_persona()
    # last review 10 days ago
    state.last_review_at = "2026-09-21"
    items = run_review(state=state, as_of="2026-10-01", record_events=False, db_path=tmp_db)
    assert not any(it.kind == "periodic_review" for it in items)


def test_review_events_no_duplicates_on_rerun(tmp_db):
    state = load_persona()
    as_of = "2026-10-01"

    # First run
    items_1 = run_review(state=state, as_of=as_of, record_events=True, db_path=tmp_db)
    events_1 = get_events(limit=100, db_path=tmp_db)
    assert len(events_1) == len(items_1)

    # Second run with same as_of
    items_2 = run_review(state=state, as_of=as_of, record_events=True, db_path=tmp_db)
    events_2 = get_events(limit=100, db_path=tmp_db)
    assert len(events_2) == len(events_1), "Duplicate events created for the same as_of date"


def test_api_routes_m3():
    app = FastAPI()
    app.include_router(m3_router, prefix="/api")
    client = TestClient(app)

    # 1. GET /api/review
    resp_review = client.get("/api/review?as_of=2026-10-01")
    assert resp_review.status_code == 200
    data = resp_review.json()
    assert data["as_of"] == "2026-10-01"
    assert len(data["items"]) >= 5

    # 2. POST /api/review/complete
    resp_complete = client.post("/api/review/complete", json={"as_of": "2026-10-01"})
    assert resp_complete.status_code == 200
    assert resp_complete.json()["ok"] is True
    assert resp_complete.json()["last_review_at"] == "2026-10-01"

    # 3. GET /api/events
    resp_events = client.get("/api/events?limit=50")
    assert resp_events.status_code == 200
    events = resp_events.json()
    assert isinstance(events, list)
    assert any(e["kind"] == "review_complete" for e in events)
