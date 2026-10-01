"""FastAPI routes owned by M3 track."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

from backend.app.data.loader import State, load_persona
from backend.app.engines.scenario_review import (
    add_event,
    get_events,
    run_review,
    run_scenario,
)
from backend.app.engines.fix_planner import plan

router = APIRouter(prefix="", tags=["m3"])

# In-memory fallback if store is not yet initialized by M1
_ACTIVE_STATE: State | None = None


def get_current_state() -> State:
    """Load current state from store if available, else in-memory/persona."""
    global _ACTIVE_STATE
    try:
        from backend.app.store import load_state
        return load_state()
    except Exception:
        if _ACTIVE_STATE is None:
            _ACTIVE_STATE = load_persona()
        return _ACTIVE_STATE


def save_current_state(state: State) -> None:
    """Save state to store if available, else in-memory."""
    global _ACTIVE_STATE
    _ACTIVE_STATE = state
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
        detail={"as_of": as_of_val, "ts": datetime.utcnow().isoformat() + "Z"},
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


@router.get("/events")
def get_events_list(limit: int = Query(default=50, ge=1, le=100)) -> list[dict[str, Any]]:
    """Retrieve latest events log."""
    return get_events(limit=limit)
