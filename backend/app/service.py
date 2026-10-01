"""Service orchestrator for Chokepoint analysis, caching, and persona seeding."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional

from app.engines.gate_builder import build_graph, to_view
from app.engines.simulator import analyze_core
from app.schemas import CatalogEntry, State
from app import store


DATA_DIR = Path(__file__).resolve().parent / "data"
CATALOG_PATH = DATA_DIR / "catalog.json"
PERSONA_PATH = DATA_DIR / "persona.json"

# In-memory cache for analysis results (PRD M2-06 / M1-05)
_ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}


def clear_cache() -> None:
    """Clear the analysis cache."""
    _ANALYSIS_CACHE.clear()


def load_catalog() -> list[dict]:
    """Load catalog from data/catalog.json."""
    if not CATALOG_PATH.exists():
        return []
    try:
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, list):
            return [x for x in raw if not (isinstance(x, dict) and x.get("key", "").startswith("_"))]
        if isinstance(raw, dict):
            entries = []
            for k, v in raw.items():
                if k.startswith("_"):
                    continue
                if isinstance(v, dict):
                    if "key" not in v:
                        v["key"] = k
                    entries.append(v)
            return entries
        return []
    except Exception:
        return []


def load_persona() -> State:
    """Load demo persona from data/persona.json."""
    if not PERSONA_PATH.exists():
        return State()
    with open(PERSONA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return State.model_validate(data)


def compute_state_hash(state: State) -> str:
    """Generate SHA-256 fingerprint of state and threat assumptions."""
    payload = state.model_dump_json()
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def analyze(state: State, force_fresh: bool = False) -> Dict[str, Any]:
    """Orchestrate Takeover Graph analysis (PRD §6, §7).

    build_graph -> simulator.analyze_core -> to_view -> cached result
    """
    state_hash = compute_state_hash(state)
    if not force_fresh and state_hash in _ANALYSIS_CACHE:
        return _ANALYSIS_CACHE[state_hash]

    catalog = load_catalog()
    graph = build_graph(state, catalog, state.settings)
    core = analyze_core(graph, state, catalog, state.settings)

    p_map = {a["id"]: a["p"] for a in core["accounts"]}
    view = to_view(
        graph,
        p_by_account=p_map,
        band_low=state.settings.band_low,
        band_high=state.settings.band_high,
    )

    result = {
        "score": core["score"],
        "el": core["el"],
        "worst": core["worst"],
        "headline": core["headline"],
        "accounts": core["accounts"],
        "spofs": core["spofs"],
        "crown_path": core["crown_path"],
        "graph": view,
    }

    _ANALYSIS_CACHE[state_hash] = result
    return result


def record_snapshot_with_metrics(label: str, state: State) -> None:
    """Record a snapshot with live score and expected loss from simulator."""
    analysis_res = analyze(state)
    store.add_snapshot(
        score=analysis_res["score"],
        el=analysis_res["el"],
        label=label,
    )
