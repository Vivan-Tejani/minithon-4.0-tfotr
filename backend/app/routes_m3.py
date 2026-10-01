"""FastAPI routes owned by M3 track."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Body, HTTPException, Query, Path
from pydantic import BaseModel

from backend.app.data.loader import State, load_persona, load_catalog, Account
from backend.app.engines.scenario_review import (
    add_event,
    get_events,
    run_review,
    run_scenario,
    compute_preview,
    add_snapshot,
    get_snapshots,
)
from backend.app.engines.fix_planner import plan, evaluate_state, clear_planner_cache
from backend.app.engines.fix_library import apply_fix, generate_candidates

router = APIRouter(prefix="", tags=["m3"])

# In-memory fallback if store is not yet initialized by M1
_ACTIVE_STATE: State | None = None


def get_current_state() -> State:
    """Load current state from store if available, else in-memory/persona."""
    global _ACTIVE_STATE
    try:
        from app import store
        conn = store.get_connection()
        try:
            cur = conn.execute("SELECT json FROM kv WHERE key = 'state'")
            row = cur.fetchone()
            if row and row["json"]:
                return State.model_validate_json(row["json"])
        finally:
            conn.close()
    except Exception:
        try:
            from backend.app import store
            conn = store.get_connection()
            try:
                cur = conn.execute("SELECT json FROM kv WHERE key = 'state'")
                row = cur.fetchone()
                if row and row["json"]:
                    return State.model_validate_json(row["json"])
            finally:
                conn.close()
        except Exception:
            pass

    if _ACTIVE_STATE is None:
        _ACTIVE_STATE = load_persona()
    return _ACTIVE_STATE


def save_current_state(state: State) -> None:
    """Save state to store if available, else in-memory."""
    global _ACTIVE_STATE
    _ACTIVE_STATE = state
    try:
        from app.store import save_state
        save_state(state)
        return
    except Exception:
        pass
    try:
        from backend.app.store import save_state
        save_state(state)
    except Exception:
        pass


class ReviewCompleteRequest(BaseModel):
    as_of: str | None = None


@router.get("/review")
def get_review(as_of: str | None = Query(default=None)) -> dict[str, Any]:
    """Execute review rules and return items."""
    state = get_current_state()
    effective_as_of = as_of or state.now
    items = run_review(state=state, as_of=effective_as_of, record_events=True)
    return {
        "as_of": effective_as_of,
        "items": [item.to_dict() for item in items],
    }


@router.post("/review/complete")
def complete_review(payload: ReviewCompleteRequest | None = Body(default=None)) -> dict[str, Any]:
    """Mark privacy review as complete and set last_review_at."""
    state = get_current_state()
    as_of_val = (payload.as_of if payload and payload.as_of else None) or state.now
    state.last_review_at = as_of_val
    save_current_state(state)

    add_event(
        kind="review_complete",
        title="Privacy review completed",
        detail={"as_of": as_of_val, "ts": datetime.now(timezone.utc).isoformat()},
    )

    return {
        "ok": True,
        "last_review_at": as_of_val,
    }


@router.get("/fixes")
def get_fixes(k_full: int = Query(default=8, ge=1, le=20)) -> dict[str, Any]:
    """Retrieve ranked fix plan, best-3 recommendations, and quick wins."""
    state = get_current_state()
    return plan(state=state, k_full=k_full)


class ScenarioRequest(BaseModel):
    kind: str
    target: str


@router.post("/scenario")
def post_scenario(payload: ScenarioRequest) -> dict[str, Any]:
    """Simulate attack scenario and return cascade, metrics delta, and next actions."""
    state = get_current_state()
    try:
        return run_scenario(state=state, kind=payload.kind, target=payload.target)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


class PreviewRequest(BaseModel):
    op: str
    account: dict[str, Any] | None = None
    fix_id: str | None = None


@router.post("/preview")
def post_preview(payload: PreviewRequest) -> dict[str, Any]:
    """Preview effect of an account edit or fix before committing."""
    state = get_current_state()
    try:
        data = payload.account if payload.op == "upsert_account" else payload.fix_id
        if data is None:
            raise ValueError(f"Missing data payload for preview op '{payload.op}'")
        return compute_preview(state=state, op=payload.op, payload_data=data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/fixes/{fix_id}/apply")
def apply_fix_endpoint(fix_id: str = Path(...)) -> dict[str, Any]:
    """Apply a fix to the active state, update history, and create a snapshot."""
    state = get_current_state()
    catalog = load_catalog()

    # Validate fix_id format
    valid_prefixes = (
        "sim_lock",
        "device_lock",
        "2fa:",
        "rm_login:",
        "rm_recovery:",
        "unique_pw:",
        "revoke:",
        "delete:",
    )
    if not (fix_id in ("sim_lock", "device_lock") or any(fix_id.startswith(p) for p in valid_prefixes)):
        raise HTTPException(status_code=404, detail=f"Unknown fix '{fix_id}'")

    ev_before = evaluate_state(state, catalog, state.settings)
    score_before = ev_before["score"]

    state_after = apply_fix(state, fix_id, catalog)
    ev_after = evaluate_state(state_after, catalog, state.settings)
    score_after = ev_after["score"]

    # Check if this application was a no-op (state unchanged)
    if state_after.model_dump() == state.model_dump():
        snapshots = get_snapshots()
        latest_version = snapshots[-1]["id"] if snapshots else 0
        return {
            "score_before": score_before,
            "score_after": score_after,
            "state_version": latest_version,
        }

    # Find human title for snapshot label
    candidates = generate_candidates(state, catalog)
    matched_candidate = next((c for c in candidates if c.id == fix_id), None)
    title = matched_candidate.title if matched_candidate else fix_id

    # Commit state
    save_current_state(state_after)
    clear_planner_cache()
    try:
        from app import service
        service.clear_cache()
    except Exception:
        try:
            from backend.app import service
            service.clear_cache()
        except Exception:
            pass

    # Record snapshot & event
    snap_id = 1
    try:
        from app import store
        snap_id = store.add_snapshot(score=score_after, el=ev_after["el"], label=f"Applied: {title}")
        store.add_event(
            kind="fix_applied",
            title=f"Applied: {title}",
            detail={
                "fix_id": fix_id,
                "score_before": score_before,
                "score_after": score_after,
            },
        )
    except Exception:
        try:
            from backend.app import store
            snap_id = store.add_snapshot(score=score_after, el=ev_after["el"], label=f"Applied: {title}")
            store.add_event(
                kind="fix_applied",
                title=f"Applied: {title}",
                detail={
                    "fix_id": fix_id,
                    "score_before": score_before,
                    "score_after": score_after,
                },
            )
        except Exception:
            snap = add_snapshot(score=score_after, el=ev_after["el"], label=f"Applied: {title}")
            snap_id = snap["id"]
            add_event(
                kind="fix_applied",
                title=f"Applied: {title}",
                detail={
                    "fix_id": fix_id,
                    "score_before": score_before,
                    "score_after": score_after,
                },
            )

    return {
        "score_before": score_before,
        "score_after": score_after,
        "state_version": snap_id,
    }


@router.get("/snapshots")
def get_snapshots_list() -> list[dict[str, Any]]:
    """Retrieve ordered timeline of score snapshots."""
    try:
        from app import store
        return store.get_snapshots()
    except Exception:
        try:
            from backend.app import store
            return store.get_snapshots()
        except Exception:
            return get_snapshots()


@router.get("/events")
def get_events_list(limit: int = Query(default=50, ge=1, le=100)) -> list[dict[str, Any]]:
    """Retrieve latest events log."""
    try:
        from app import store
        return store.get_events(limit=limit)
    except Exception:
        try:
            from backend.app import store
            return store.get_events(limit=limit)
        except Exception:
            return get_events(limit=limit)
