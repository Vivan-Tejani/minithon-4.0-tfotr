"""Data loaders and schemas for service catalog and persona."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

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
SecondFactorType = Literal["sms", "authenticator", "hardware_key"]

CATALOG_PATH = Path(__file__).parent / "catalog.json"


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
