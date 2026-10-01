import time
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.data.loader import load_persona, load_catalog
from backend.app.engines.fix_planner import (
    plan,
    clear_planner_cache,
    evaluate_state,
)
from backend.app.engines.fix_library import apply_fix
from backend.app.routes_m3 import router as m3_router


def test_planner_on_persona_performance_and_gain():
    clear_planner_cache()
    state = load_persona()
    catalog = load_catalog()

    start_time = time.perf_counter()
    res = plan(state, catalog, state.settings, k_full=8)
    elapsed = time.perf_counter() - start_time

    # Performance budget: < 3.0 seconds
    assert elapsed < 3.0, f"Planner took {elapsed:.2f}s, expected < 3.0s"

    assert "plan" in res
    assert "best3" in res
    assert "quick_wins" in res
    assert "base_score" in res

    best3 = res["best3"]
    assert len(best3) == 3

    # Best-3 raises score by >= 20 points
    greedy_picks = [f for f in res["plan"] if f["greedy"]]
    score_after_best3 = greedy_picks[2]["score_after"]
    score_increase = score_after_best3 - res["base_score"]
    assert score_increase >= 20, (
        f"Expected score increase >= 20, got {score_increase} (base: {res['base_score']}, after best3: {score_after_best3})"
    )

    # At least one interaction note appears where marginal_gain < 0.5 * standalone_gain
    notes = [f["note"] for f in res["plan"] if f.get("note")]
    assert len(notes) >= 1, "Expected at least one interaction note in the plan"
    assert any("Worth" in n and "alone" in n for n in notes)


def test_greedy_cumulative_el_vs_standalone_ranking():
    clear_planner_cache()
    state = load_persona()
    catalog = load_catalog()
    res = plan(state, catalog, state.settings, k_full=5)

    # Apply top 3 greedy picks
    greedy_state = state
    for fid in res["best3"]:
        greedy_state = apply_fix(greedy_state, fid, catalog)
    greedy_el = evaluate_state(greedy_state, catalog, state.settings)["el"]

    # Apply top 3 standalone picks
    standalone_sorted = sorted(res["plan"], key=lambda f: f["standalone_gain"], reverse=True)
    standalone_state = state
    for f in standalone_sorted[:3]:
        standalone_state = apply_fix(standalone_state, f["id"], catalog)
    standalone_el = evaluate_state(standalone_state, catalog, state.settings)["el"]

    # Greedy cumulative EL is never worse (i.e. greedy_el <= standalone_el)
    assert greedy_el <= standalone_el + 0.1, (
        f"Greedy cumulative EL ({greedy_el}) was worse than standalone ranking ({standalone_el})"
    )


def test_planner_deterministic_across_calls():
    clear_planner_cache()
    state = load_persona()
    catalog = load_catalog()

    res1 = plan(state, catalog, state.settings)
    clear_planner_cache()
    res2 = plan(state, catalog, state.settings)

    assert res1["best3"] == res2["best3"]
    assert res1["quick_wins"] == res2["quick_wins"]
    assert res1["base_score"] == res2["base_score"]
    for f1, f2 in zip(res1["plan"], res2["plan"]):
        assert f1["id"] == f2["id"]
        assert f1["standalone_gain"] == f2["standalone_gain"]
        assert f1["marginal_gain"] == f2["marginal_gain"]


def test_quick_wins_are_low_effort():
    clear_planner_cache()
    state = load_persona()
    catalog = load_catalog()
    res = plan(state, catalog, state.settings)

    plan_by_id = {f["id"]: f for f in res["plan"]}
    for qid in res["quick_wins"]:
        assert plan_by_id[qid]["effort"] == "low"


def test_api_get_fixes():
    clear_planner_cache()
    app = FastAPI()
    app.include_router(m3_router, prefix="/api")
    client = TestClient(app)

    resp = client.get("/api/fixes?k_full=8")
    assert resp.status_code == 200
    data = resp.json()
    assert "plan" in data
    assert "best3" in data
    assert "quick_wins" in data
    assert "base_score" in data
    assert len(data["best3"]) == 3
