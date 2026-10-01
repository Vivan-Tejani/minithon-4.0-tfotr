"""SQLite storage layer for Chokepoint state, snapshots, and events."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, List, Optional
from datetime import datetime, timezone

from app.schemas import State


DB_DIR = Path(__file__).resolve().parent.parent / ".data"
DB_PATH = DB_DIR / "chokepoint.db"


def get_db_path() -> Path:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    return DB_PATH


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    target = db_path or get_db_path()
    conn = sqlite3.connect(str(target), timeout=30.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[Path] = None) -> None:
    """Create tables if they do not exist and enable WAL mode."""
    conn = get_connection(db_path)
    with conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                json TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                score REAL,
                el REAL,
                label TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                kind TEXT NOT NULL,
                title TEXT NOT NULL,
                detail_json TEXT
            )
        """)
    conn.close()


def load_state(db_path: Optional[Path] = None) -> State:
    """Load application state from SQLite KV store; returns default empty state if unset."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.execute("SELECT json FROM kv WHERE key = 'state'")
        row = cur.fetchone()
        if row and row["json"]:
            return State.model_validate_json(row["json"])
        return State()
    finally:
        conn.close()


def save_state(state: State, db_path: Optional[Path] = None) -> None:
    """Save application state to SQLite KV store."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute(
                "INSERT INTO kv (key, json) VALUES ('state', ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json",
                (state.model_dump_json(),),
            )
    finally:
        conn.close()


def add_snapshot(
    score: Optional[float],
    el: Optional[float],
    label: str,
    ts: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> int:
    """Insert a snapshot record."""
    init_db(db_path)
    if ts is None:
        ts = datetime.now(timezone.utc).isoformat()
    conn = get_connection(db_path)
    try:
        with conn:
            cur = conn.execute(
                "INSERT INTO snapshots (ts, score, el, label) VALUES (?, ?, ?, ?)",
                (ts, score, el, label),
            )
            return cur.lastrowid or 0
    finally:
        conn.close()


def get_snapshots(db_path: Optional[Path] = None) -> List[dict]:
    """Retrieve all snapshots ordered by id ascending."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.execute("SELECT id, ts, score, el, label FROM snapshots ORDER BY id ASC")
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def add_event(
    kind: str,
    title: str,
    detail: Any = None,
    ts: Optional[str] = None,
    db_path: Optional[Path] = None,
) -> int:
    """Insert an audit or review event record."""
    init_db(db_path)
    if ts is None:
        ts = datetime.now(timezone.utc).isoformat()
    detail_str = json.dumps(detail) if detail is not None else None
    conn = get_connection(db_path)
    try:
        with conn:
            cur = conn.execute(
                "INSERT INTO events (ts, kind, title, detail_json) VALUES (?, ?, ?, ?)",
                (ts, kind, title, detail_str),
            )
            return cur.lastrowid or 0
    finally:
        conn.close()


def get_events(limit: int = 50, db_path: Optional[Path] = None) -> List[dict]:
    """Retrieve latest events."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cur = conn.execute(
            "SELECT id, ts, kind, title, detail_json FROM events ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        events = []
        for row in cur.fetchall():
            d = dict(row)
            if d.get("detail_json"):
                try:
                    d["detail"] = json.loads(d["detail_json"])
                except Exception:
                    d["detail"] = d["detail_json"]
            else:
                d["detail"] = None
            events.append(d)
        return events
    finally:
        conn.close()


def reset(db_path: Optional[Path] = None) -> None:
    """Clear kv, snapshots, and events tables."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute("DELETE FROM kv")
            conn.execute("DELETE FROM snapshots")
            conn.execute("DELETE FROM events")
    finally:
        conn.close()


def record(
    label: str,
    score: Optional[float] = None,
    el: Optional[float] = None,
    db_path: Optional[Path] = None,
) -> None:
    """Record a snapshot hook. In M1-01 score/el can be None, filled with real values in M1-05."""
    add_snapshot(score=score, el=el, label=label, db_path=db_path)
