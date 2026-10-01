"""Data loaders and schemas for service catalog and persona."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

ServiceType = Literal[
    "email",
    "social",
    "shopping",
    "finance",
    "payments",
    "storage",
    "entertainment",
    "professional",
    "utility_app",
    "forum",
    "other",
]

LoginMethodType = Literal["password", "sms_otp", "sso"]
SecondFactorType = Literal["none", "sms", "authenticator", "hardware_key"]

CATALOG_PATH = Path(__file__).parent / "catalog.json"
PERSONA_PATH = Path(__file__).parent / "persona.json"


class CatalogEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    key: str
    name: str
    type: ServiceType
    login_methods_supported: list[LoginMethodType] = Field(default_factory=list)
    second_factors_supported: list[SecondFactorType] = Field(default_factory=list)
    recovery_bypasses_2fa: bool
    typical_permissions: list[str] = Field(default_factory=list)
    default_data_held: list[str] = Field(default_factory=list)
    breach_count_5y: int = Field(default=0, ge=0)


class PhoneAnchor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sim_lock: bool = False
    device_lock: bool = True


class Anchors(BaseModel):
    model_config = ConfigDict(extra="ignore")
    phone: PhoneAnchor = Field(default_factory=PhoneAnchor)


class Account(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    service_key: str
    type: ServiceType
    login_methods: list[str] = Field(default_factory=list)
    second_factor: str = "none"
    recovery: list[str] = Field(default_factory=list)
    password_group: str | None = None
    permissions: list[str] = Field(default_factory=list)
    data_held: list[str] = Field(default_factory=list)
    last_activity: str = "2026-03-31"
    breach_flag: bool = False
    importance_override: int | None = None

    @field_validator("importance_override", mode="before")
    @classmethod
    def validate_importance_override(cls, v: Any) -> int | None:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            mapping = {"low": 3, "medium": 6, "high": 9}
            if v.strip().lower() in mapping:
                return mapping[v.strip().lower()]
            try:
                return int(v.strip())
            except ValueError:
                raise ValueError("importance_override must be an integer between 1 and 10 or 'low'/'medium'/'high'")
        if isinstance(v, (int, float)):
            return int(v)
        return v


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    horizon_years: int = 5
    p_sim: float = 0.10
    sim_lock_mult: float = 0.25
    p_phone: float = 0.20
    p_phish_email: float = 0.15
    leak_base: float = 0.05
    leak_per_breach: float = 0.08
    leak_cap: float = 0.60
    leak_flagged_min: float = 0.80
    trials: int = 2000
    seed: int = 42
    band_low: float = 0.15
    band_high: float = 0.40
    stale_days: int = 365
    backup_email_stale_days: int = 180


class State(BaseModel):
    model_config = ConfigDict(extra="ignore")
    anchors: Anchors = Field(default_factory=Anchors)
    accounts: list[Account] = Field(default_factory=list)
    settings: Settings = Field(default_factory=Settings)
    last_review_at: str | None = None
    now: str = "2026-10-01"


def load_catalog(path: Path | str | None = None) -> dict[str, CatalogEntry]:
    """Load catalog from JSON file, ignoring top-level keys starting with `_`."""
    target_path = Path(path) if path else CATALOG_PATH
    with open(target_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    catalog: dict[str, CatalogEntry] = {}
    for k, v in raw_data.items():
        if k.startswith("_"):
            continue
        entry = CatalogEntry.model_validate(v)
        catalog[entry.key] = entry
    return catalog


def load_catalog_list(path: Path | str | None = None) -> list[CatalogEntry]:
    """Load catalog as a list of CatalogEntry objects (for GET /catalog)."""
    return list(load_catalog(path).values())


def load_persona(path: Path | str | None = None) -> State:
    """Load demo persona into a State instance."""
    target_path = Path(path) if path else PERSONA_PATH
    with open(target_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    return State.model_validate(raw_data)
