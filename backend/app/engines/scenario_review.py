"""Engine 4: Scenario and Review Engine."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Literal

from backend.app.data.loader import Account, CatalogEntry, Settings, State, load_catalog

DB_DIR = Path(__file__).resolve().parent.parent.parent / ".data"
DB_PATH = DB_DIR / "chokepoint.db"

SeverityType = Literal["high", "medium", "low"]
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}

DATA_WEIGHTS = {
    "payment": 10,
    "government_id": 9,
    "health": 8,
    "financial_records": 8,
    "private_messages": 6,
    "work_data": 5,
    "photos": 5,
    "contacts": 3,
    "location_history": 3,
    "profile_only": 1,
}

PERMISSION_WEIGHTS = {
    "sms": 6,
    "email_inbox": 6,
    "camera": 4,
    "microphone": 4,
    "photos": 4,
    "files": 4,
    "contacts": 3,
    "location": 3,
}


def account_impact(account: Account) -> int:
    """Calculate impact weight per PRD §5.6."""
    if account.importance_override is not None:
        return account.importance_override
    weights = [1]
    for d in account.data_held:
        weights.append(DATA_WEIGHTS.get(d, 1))
    for p in account.permissions:
        base_perm = p.split(":")[0]
        weights.append(PERMISSION_WEIGHTS.get(base_perm, 1))
    return max(weights)


@dataclass
class ReviewItem:
    id: str
    kind: Literal[
        "stale_account",
        "unused_backup_email",
        "weak_2fa",
        "reuse",
        "periodic_review",
    ]
    title: str
    detail: str
    target: str
    severity: SeverityType
    fix_id: str | None = None
    dependents: list[str] | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.dependents is None:
            d.pop("dependents", None)
        return d


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Initialize SQLite database for events and snapshots."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            detail_json TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def add_event(
    kind: str,
    title: str,
    detail: dict | str = "",
    ts: str | None = None,
    db_path: Path = DB_PATH,
) -> dict:
    """Add an event to the events log."""
    conn = init_db(db_path)
    now_ts = ts or datetime.utcnow().isoformat() + "Z"
    detail_str = json.dumps(detail) if isinstance(detail, dict) else str(detail)
    cur = conn.execute(
        "INSERT INTO events (ts, kind, title, detail_json) VALUES (?, ?, ?, ?)",
        (now_ts, kind, title, detail_str),
    )
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return {
        "id": event_id,
        "ts": now_ts,
        "kind": kind,
        "title": title,
        "detail": detail,
    }


def get_events(limit: int = 50, db_path: Path = DB_PATH) -> list[dict]:
    """Retrieve latest events from the database."""
    conn = init_db(db_path)
    cur = conn.execute(
        "SELECT id, ts, kind, title, detail_json FROM events ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()

    events = []
    for r in rows:
        try:
            detail = json.loads(r[4])
        except Exception:
            detail = r[4]
        events.append(
            {
                "id": r[0],
                "ts": r[1],
                "kind": r[2],
                "title": r[3],
                "detail": detail,
            }
        )
    return events


def run_review(
    state: State,
    catalog: dict[str, CatalogEntry] | None = None,
    settings: Settings | None = None,
    as_of: str | None = None,
    record_events: bool = True,
    db_path: Path = DB_PATH,
) -> list[ReviewItem]:
    """Execute review engine rules per PRD §6 Engine 4 table."""
    cat_map = catalog if catalog is not None else load_catalog()
    st = settings or state.settings
    as_of_str = as_of or state.now
    as_of_date = date.fromisoformat(as_of_str)

    items: list[ReviewItem] = []

    # Map accounts and password groups
    accounts_by_id = {a.id: a for a in state.accounts}
    groups: dict[str, list[Account]] = {}
    for a in state.accounts:
        if a.password_group:
            groups.setdefault(a.password_group, []).append(a)

    # 1. stale_account: as_of - last_activity > stale_days
    # High if it is a recovery/SSO target or in a reuse group, else low
    for a in state.accounts:
        act_date = date.fromisoformat(a.last_activity)
        days_inactive = (as_of_date - act_date).days
        if days_inactive > st.stale_days:
            # Check if recovery/SSO target or in reuse group
            is_recovery_target = any(
                f"email:{a.id}" in x.recovery for x in state.accounts if x.id != a.id
            )
            is_sso_target = any(
                f"sso:{a.id}" in x.login_methods for x in state.accounts if x.id != a.id
            )
            in_reuse_group = bool(a.password_group and len(groups.get(a.password_group, [])) >= 2)

            severity: SeverityType = (
                "high" if (is_recovery_target or is_sso_target or in_reuse_group) else "low"
            )
            items.append(
                ReviewItem(
                    id=f"stale_account:{a.id}",
                    kind="stale_account",
                    title=f"Account '{a.name}' is inactive ({days_inactive} days)",
                    detail=f"Inactive since {a.last_activity}. Consider deleting unused account to reduce exposure.",
                    target=a.id,
                    severity=severity,
                    fix_id=f"delete:{a.id}",
                )
            )

    # 2. unused_backup_email: email-type, recovery/SSO target for >= 1 account, inactive > backup_email_stale_days
    for a in state.accounts:
        if a.type == "email":
            act_date = date.fromisoformat(a.last_activity)
            days_inactive = (as_of_date - act_date).days
            if days_inactive > st.backup_email_stale_days:
                dependents = [
                    x.id
                    for x in state.accounts
                    if (
                        f"email:{a.id}" in x.recovery
                        or f"sso:{a.id}" in x.login_methods
                    )
                ]
                if dependents:
                    first_dep = dependents[0]
                    items.append(
                        ReviewItem(
                            id=f"unused_backup_email:{a.id}",
                            kind="unused_backup_email",
                            title=f"Unused backup email '{a.name}' protects active accounts",
                            detail=f"Inactive for {days_inactive} days while acting as recovery/login for: {', '.join(dependents)}.",
                            target=a.id,
                            severity="high",
                            fix_id=f"rm_recovery:{first_dep}:email:{a.id}",
                            dependents=dependents,
                        )
                    )

    # 3. weak_2fa: impact >= 8 and factor in {none, sms}
    for a in state.accounts:
        impact = account_impact(a)
        if impact >= 8 and a.second_factor in ("none", "sms"):
            items.append(
                ReviewItem(
                    id=f"weak_2fa:{a.id}",
                    kind="weak_2fa",
                    title=f"High-impact account '{a.name}' has weak or missing 2FA",
                    detail=f"Account holds critical data (impact {impact}/10) but uses {a.second_factor} 2FA.",
                    target=a.id,
                    severity="high",
                    fix_id=f"2fa:{a.id}",
                )
            )

    # 4. reuse: group size >= 2
    for g, members in groups.items():
        if len(members) >= 2:
            names = [m.name for m in members]
            items.append(
                ReviewItem(
                    id=f"reuse:{g}",
                    kind="reuse",
                    title=f"Password group '{g}' shared by {len(members)} accounts",
                    detail=f"Shared across: {', '.join(sorted(names))}. Breach of one service exposes all.",
                    target=g,
                    severity="medium",
                    fix_id=f"unique_pw:{g}",
                )
            )

    # 5. periodic_review: as_of - last_review_at > 30 days
    is_periodic_due = False
    if state.last_review_at is None:
        is_periodic_due = True
    else:
        last_rev = date.fromisoformat(state.last_review_at)
        if (as_of_date - last_rev).days > 30:
            is_periodic_due = True

    if is_periodic_due:
        items.append(
            ReviewItem(
                id="periodic_review:general",
                kind="periodic_review",
                title="Periodic security and privacy review due",
                detail="More than 30 days have elapsed since your last review. Inspect your digital footprint.",
                target="general",
                severity="low",
                fix_id=None,
            )
        )

    # Sort items by severity (high -> medium -> low), then by id for stability
    items.sort(key=lambda item: (SEVERITY_ORDER[item.severity], item.id))

    # Record review events once per item per as_of date
    if record_events:
        conn = init_db(db_path)
        cur = conn.execute(
            "SELECT detail_json FROM events WHERE kind = 'review'",
        )
        existing_records = set()
        for row in cur.fetchall():
            try:
                data = json.loads(row[0])
                if isinstance(data, dict):
                    existing_records.add((data.get("item_id"), data.get("as_of")))
            except Exception:
                pass
        conn.close()

        for item in items:
            key = (item.id, as_of_str)
            if key not in existing_records:
                add_event(
                    kind="review",
                    title=item.title,
                    detail={"item_id": item.id, "as_of": as_of_str, "severity": item.severity},
                    ts=datetime.utcnow().isoformat() + "Z",
                    db_path=db_path,
                )
                existing_records.add(key)

    return items
