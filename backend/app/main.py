"""Chokepoint FastAPI Main Application."""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
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
    account: Optional[Account] = None
    fix_id: Optional[str] = None


@api_router.post("/preview")
def preview_change(payload: PreviewPayload):
    curr_state = store.load_state()
    before_analysis = service.analyze(curr_state)

    candidate_state = copy.deepcopy(curr_state)
    changed_account_id = None

    if payload.op == "upsert_account":
        if not payload.account:
            raise HTTPException(status_code=422, detail="Missing account in upsert preview")
        acct = payload.account
        changed_account_id = acct.id
        idx = next((i for i, a in enumerate(candidate_state.accounts) if a.id == acct.id), None)
        if idx is not None:
            candidate_state.accounts[idx] = acct
        else:
            candidate_state.accounts.append(acct)
    elif payload.op == "apply_fix":
        fid = payload.fix_id or ""
        if fid == "sim_lock":
            candidate_state.anchors.phone.sim_lock = True
        elif fid == "device_lock":
            candidate_state.anchors.phone.device_lock = True
        elif fid.startswith("2fa:"):
            target = fid.replace("2fa:", "")
            for a in candidate_state.accounts:
                if a.id == target:
                    a.second_factor = "authenticator"
                    changed_account_id = target
        elif fid.startswith("rm_login:"):
            parts = fid.split(":")
            if len(parts) >= 3:
                target = parts[1]
                meth = parts[2]
                for a in candidate_state.accounts:
                    if a.id == target and meth in a.login_methods:
                        a.login_methods.remove(meth)
                        changed_account_id = target
        elif fid.startswith("unique_pw:"):
            grp = fid.replace("unique_pw:", "")
            for a in candidate_state.accounts:
                if a.password_group == grp:
                    a.password_group = None

    after_analysis = service.analyze(candidate_state, force_fresh=True)

    score_before = before_analysis["score"]
    score_after = after_analysis["score"]
    d_el = round(after_analysis["el"] - before_analysis["el"], 2)

    # Detect new paths
    before_p = {a["id"]: a["p"] for a in before_analysis["accounts"]}
    new_paths: List[dict] = []
    for acct_after in after_analysis["accounts"]:
        aid = acct_after["id"]
        p_prev = before_p.get(aid, 0.0)
        p_now = acct_after["p"]
        if aid == changed_account_id or (p_now - p_prev > 0.05):
            new_paths.extend(acct_after.get("top_paths", [])[:2])

    # Build ghost view diff
    before_node_ids = {n["id"] for n in before_analysis["graph"]["nodes"]}
    before_edges = {(e["source"], e["target"]) for e in before_analysis["graph"]["edges"]}

    ghost_nodes = []
    for n in after_analysis["graph"]["nodes"]:
        if n["id"] not in before_node_ids or n["id"] == changed_account_id:
            ghost_nodes.append({**n, "ghost": True})
        else:
            ghost_nodes.append({**n, "ghost": False})

    ghost_edges = []
    for e in after_analysis["graph"]["edges"]:
        pair = (e["source"], e["target"])
        if pair not in before_edges or e["target"] == changed_account_id:
            ghost_edges.append({**e, "ghost": True})
        else:
            ghost_edges.append({**e, "ghost": False})

    return {
        "score_before": score_before,
        "score_after": score_after,
        "d_el": d_el,
        "new_paths": new_paths[:3],
        "new_spofs": after_analysis["spofs"],
        "ghost": {
            "nodes": ghost_nodes,
            "edges": ghost_edges,
        },
    }


# Scenario Cascade Endpoint (Ticket M3-05 / M1-06)
class ScenarioPayload(BaseModel):
    kind: str
    target: str


@api_router.post("/scenario")
def run_scenario(payload: ScenarioPayload):
    state = store.load_state()
    catalog = service.load_catalog()
    graph = service.build_graph(state, catalog, state.settings)
    base_m = service.analyze(state)

    forced = set()
    leaked_group = None

    if payload.kind == "entry":
        forced.add(payload.target)
    elif payload.kind == "breach":
        forced.add(f"E_LEAK:{payload.target}")
        acct = next((a for a in state.accounts if a.id == payload.target), None)
        if acct and acct.password_group:
            leaked_group = acct.password_group
            for other in state.accounts:
                if other.password_group == leaked_group:
                    forced.add(f"E_LEAK:{other.id}")
    elif payload.kind == "compromise":
        forced.add(f"ACC:{payload.target}")
    else:
        raise HTTPException(status_code=422, detail="Invalid scenario kind")

    det_res = closure_det(graph, forced=forced)
    cascade = cascade_rounds(det_res)
    all_taken = [
        nid.replace("ACC:", "")
        for nid, h in det_res["hop"].items()
        if h > 0 and nid.startswith("ACC:") and nid not in forced and f"ACC:{payload.target}" != nid
    ]
    falls = len(all_taken)

    mc_forced = metrics(graph, state.settings, forced=forced)
    el_delta = max(0.0, round(mc_forced["el"] - base_m["el"], 2))
    score_during = mc_forced["score"]

    return {
        "scenario": {
            "kind": payload.kind,
            "target": payload.target,
            "label": f"{payload.kind.capitalize()} scenario on {payload.target}",
        },
        "cascade": cascade,
        "falls": falls,
        "el_delta": el_delta,
        "score_during": score_during,
        "leaked_group": leaked_group,
        "next_actions": [],
    }


app.include_router(api_router)

try:
    from app.routes_m3 import router as router_m3
except ImportError:
    from backend.app.routes_m3 import router as router_m3

app.include_router(router_m3, prefix="/api")
