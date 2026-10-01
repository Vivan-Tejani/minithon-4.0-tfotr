"""Chokepoint Engines.

Integrates:
- Engine 1: Gate Builder & Graph Types (M1)
- Engine 2: Simulator & Monte Carlo Analysis (M2)
- Engine 3: Fix Library, Fix Planner & Scenario/Review Engines (M3)
"""
from backend.app.engines.fix_library import (
    Fix,
    generate_candidates,
    apply_fix,
)
from backend.app.engines.scenario_review import (
    ReviewItem,
    run_review,
    add_event,
    get_events,
    account_impact,
    run_scenario,
    cascade_rounds,
    closure_det,
    add_snapshot,
    get_snapshots,
    to_view,
    compute_preview,
)
from backend.app.engines.fix_planner import (
    plan,
    evaluate_state,
    clear_planner_cache,
)

__all__ = [
    "Fix",
    "generate_candidates",
    "apply_fix",
    "ReviewItem",
    "run_review",
    "add_event",
    "get_events",
    "account_impact",
    "run_scenario",
    "cascade_rounds",
    "closure_det",
    "add_snapshot",
    "get_snapshots",
    "to_view",
    "compute_preview",
    "plan",
    "evaluate_state",
    "clear_planner_cache",
]
