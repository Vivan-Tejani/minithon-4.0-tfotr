"""Chokepoint FastAPI Main Application."""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure both backend directory and repo root are in sys.path
_backend_dir = Path(__file__).resolve().parent.parent
_repo_root = _backend_dir.parent
for _p in (str(_backend_dir), str(_repo_root)):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from fastapi import FastAPI, APIRouter, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.schemas import (
    Account,
    Anchors,
    CatalogEntry,
    Settings,
    State,
    find_account_dependents,
    slugify,
    validate_accounts_integrity,
)
from app import store
from app import service
from app.engines.simulator import cascade_rounds, closure_det, metrics, paths_into


app = FastAPI(
    title="Chokepoint API",
    description="Privacy risk auditor & takeover graph planner",
    version="1.0.0",
)

# CORS allow http://localhost:5173 only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


@api_router.get("/health")
def health():
    return {"ok": True}


@api_router.get("/state", response_model=State)
def get_state():
    return store.load_state()


@api_router.get("/analysis")
def get_analysis():
    state = store.load_state()
    return service.analyze(state)


@api_router.get("/paths/{account_id}")
def get_account_paths(account_id: str):
    state = store.load_state()
    res = service.analyze(state)
    target = next((a for a in res["accounts"] if a["id"] == account_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Account '{account_id}' not found")
    return {"paths": target.get("top_paths", [])}


@api_router.get("/compare")
def get_compare():
    """Baseline checklist vs Chokepoint graph planner comparison (PRD §6 M2-09)."""
    state = store.load_state()
    catalog = service.load_catalog()
    cat_map = {c.get("key", ""): c for c in catalog}

    try:
        from app.engines.fix_planner import plan, evaluate_state
        from app.engines.fix_library import apply_fix, generate_candidates
        from app.engines.baseline import naive_plan
    except ImportError:
        from backend.app.engines.fix_planner import plan, evaluate_state
        from backend.app.engines.fix_library import apply_fix, generate_candidates
        from backend.app.engines.baseline import naive_plan

    # 1. Chokepoint plan
    plan_res = plan(state=state, catalog=cat_map, k_full=3)
    chokepoint_top3 = [
        {"id": f["id"], "title": f["title"]}
        for f in plan_res["plan"][:3]
    ]
    chokepoint_score_after = (
        plan_res["plan"][min(2, len(plan_res["plan"]) - 1)]["score_after"]
        if plan_res["plan"]
        else plan_res.get("base_score", 100)
    )

    # 2. Naive checklist plan
    naive_fix_ids = naive_plan(state)
    candidates = generate_candidates(state, cat_map)
    candidates_by_id = {c.id: c for c in candidates}

    baseline_top3 = []
    curr_state = state
    for fid in naive_fix_ids[:3]:
        title = candidates_by_id[fid].title if fid in candidates_by_id else fid
        baseline_top3.append({"id": fid, "title": title})
        curr_state = apply_fix(curr_state, fid, cat_map)

    ev_baseline = evaluate_state(curr_state, cat_map, state.settings)
    baseline_score_after = ev_baseline["score"]

    explanation = (
        "Independent checkers fix single high-reuse nodes first; Chokepoint identifies "
        "correlated root gates (SIM swap and central email inbox)."
    )

    return {
        "baseline_top3": baseline_top3,
        "chokepoint_top3": chokepoint_top3,
        "baseline_score_after": baseline_score_after,
        "chokepoint_score_after": chokepoint_score_after,
        "divergence_explanation": explanation,
        "naive": {
            "plan": [f["id"] for f in baseline_top3],
            "score_after": baseline_score_after,
        },
        "ours": {
            "plan": [f["id"] for f in chokepoint_top3],
            "score_after": chokepoint_score_after,
        },
    }


@api_router.put("/anchors", response_model=Anchors)
def update_anchors(anchors: Anchors):
    state = store.load_state()
    state.anchors = anchors
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label="Updated phone anchors", state=state)
    store.add_event(
        kind="account_changed",
        title="Phone anchors updated",
        detail=anchors.model_dump(),
    )
    return state.anchors


@api_router.post("/accounts", response_model=Account, status_code=status.HTTP_201_CREATED)
def create_account(account: Account):
    state = store.load_state()

    acct_id = slugify(account.id) if account.id else slugify(account.name)
    if not acct_id:
        raise HTTPException(
            status_code=422,
            detail="Account id or name must yield a valid slug",
        )
    account.id = acct_id

    if any(a.id == account.id for a in state.accounts):
        raise HTTPException(
            status_code=422,
            detail=f"Account with id '{account.id}' already exists",
        )

    candidate_accounts = list(state.accounts) + [account]
    try:
        validate_accounts_integrity(candidate_accounts)
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )

    state.accounts = candidate_accounts
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label=f"Added account: {account.name}", state=state)
    store.add_event(
        kind="account_changed",
        title=f"Account created: {account.name}",
        detail=account.model_dump(),
    )
    return account


@api_router.put("/accounts/{account_id}", response_model=Account)
def update_account(account_id: str, account: Account):
    state = store.load_state()
    existing_idx = next((i for i, a in enumerate(state.accounts) if a.id == account_id), None)
    if existing_idx is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with id '{account_id}' not found",
        )

    account.id = account_id
    candidate_accounts = list(state.accounts)
    candidate_accounts[existing_idx] = account
    try:
        validate_accounts_integrity(candidate_accounts)
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )

    state.accounts = candidate_accounts
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label=f"Updated account: {account.name}", state=state)
    store.add_event(
        kind="account_changed",
        title=f"Account updated: {account.name}",
        detail=account.model_dump(),
    )
    return account


@api_router.delete("/accounts/{account_id}")
def delete_account(account_id: str):
    state = store.load_state()
    existing = next((a for a in state.accounts if a.id == account_id), None)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with id '{account_id}' not found",
        )

    dependents = find_account_dependents(account_id, state.accounts)
    if dependents:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": f"Cannot delete account '{account_id}' because other accounts depend on it",
                "dependents": dependents,
            },
        )

    state.accounts = [a for a in state.accounts if a.id != account_id]
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label=f"Deleted account: {existing.name}", state=state)
    store.add_event(
        kind="account_changed",
        title=f"Account deleted: {existing.name}",
        detail={"account_id": account_id},
    )
    return {"ok": True, "deleted": account_id}


@api_router.get("/catalog")
def get_catalog() -> List[dict]:
    return service.load_catalog()


@api_router.get("/settings", response_model=Settings)
def get_settings():
    state = store.load_state()
    return state.settings


@api_router.put("/settings", response_model=Settings)
def update_settings(settings: Settings):
    state = store.load_state()
    state.settings = settings
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label="Updated threat settings", state=state)
    store.add_event(
        kind="settings_changed",
        title="Settings updated",
        detail=settings.model_dump(),
    )
    return state.settings


@api_router.get("/snapshots")
def get_snapshots():
    return store.get_snapshots()


@api_router.get("/events")
def get_events(limit: int = 50):
    return store.get_events(limit=limit)


@api_router.post("/seed/demo")
def seed_demo():
    state = service.load_persona()
    store.reset()
    store.save_state(state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label="Demo persona loaded", state=state)
    store.add_event(kind="seed", title="Demo persona loaded", detail={})
    return {"ok": True}


@api_router.post("/reset")
def reset_demo():
    store.reset()
    empty_state = State(
        anchors=Anchors(),
        accounts=[],
        settings=Settings(),
        last_review_at=None,
        now="2026-03-31T09:00:00Z",
    )
    store.save_state(empty_state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label="Reset inventory to empty", state=empty_state)
    store.add_event(kind="reset", title="Inventory reset to empty", detail={})
    return {"ok": True}


# P1: Import / Export (Ticket M1-08)
@api_router.get("/export")
def export_state():
    state = store.load_state()
    return state.model_dump()


@api_router.post("/import")
def import_state(payload: dict):
    try:
        new_state = State.model_validate(payload)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid state import format: {str(e)}",
        )
    store.save_state(new_state)
    service.clear_cache()
    service.record_snapshot_with_metrics(label="Imported state", state=new_state)
    store.add_event(kind="import", title="Imported state from JSON", detail={})
    return new_state


# Ghost Preview Endpoint (Ticket M3-06 / M1-07)
class PreviewPayload(BaseModel):
    op: str
    account: Optional[Dict[str, Any]] = None
    fix_id: Optional[str] = None


@api_router.post("/preview")
def preview_change(payload: PreviewPayload):
    state = store.load_state()
    try:
        from app.engines.scenario_review import compute_preview
    except ImportError:
        from backend.app.engines.scenario_review import compute_preview

    try:
        data = (
            payload.account
            if (payload.op == "upsert_account" and payload.account is not None)
            else payload.fix_id
        )
        if data is None:
            raise HTTPException(
                status_code=422,
                detail=f"Missing data payload for preview op '{payload.op}'",
            )
        return compute_preview(state=state, op=payload.op, payload_data=data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# Scenario Cascade Endpoint (Ticket M3-05 / M1-06)
class ScenarioPayload(BaseModel):
    kind: str
    target: str


@api_router.post("/scenario")
def run_scenario(payload: ScenarioPayload):
    state = store.load_state()
    try:
        from app.engines.scenario_review import run_scenario as engine_run_scenario
    except ImportError:
        from backend.app.engines.scenario_review import run_scenario as engine_run_scenario

    try:
        return engine_run_scenario(
            state=state,
            kind=payload.kind,
            target=payload.target,
            record_event=True,
            db_path=store.get_db_path(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
app.include_router(api_router)

try:
    from app.routes_m3 import router as router_m3
except ImportError:
    from backend.app.routes_m3 import router as router_m3

app.include_router(router_m3, prefix="/api")
