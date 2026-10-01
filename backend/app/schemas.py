"""Pydantic schemas and domain models for Chokepoint."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


def get_current_iso_time() -> str:
    return datetime.now(timezone.utc).isoformat()


def slugify(text: str) -> str:
    """Generate a lowercase slug from a name string."""
    cleaned = re.sub(r"[^\w\s-]", "", text.strip().lower())
    return re.sub(r"[-\s]+", "_", cleaned).strip("_")


class AccountType(str, Enum):
    EMAIL = "email"
    SOCIAL = "social"
    SHOPPING = "shopping"
    FINANCE = "finance"
    PAYMENTS = "payments"
    STORAGE = "storage"
    ENTERTAINMENT = "entertainment"
    PROFESSIONAL = "professional"
    UTILITY_APP = "utility_app"
    FORUM = "forum"
    OTHER = "other"


class SecondFactor(str, Enum):
    NONE = "none"
    SMS = "sms"
    AUTHENTICATOR = "authenticator"
    HARDWARE_KEY = "hardware_key"


class Effort(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Band(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AnchorPhone(BaseModel):
    sim_lock: bool = False
    device_lock: bool = True


class Anchors(BaseModel):
    phone: AnchorPhone = Field(default_factory=AnchorPhone)


class Account(BaseModel):
    id: str
    name: str
    service_key: str
    type: str  # AccountType or string matching enum values
    login_methods: List[str] = Field(default_factory=list)
    second_factor: str = SecondFactor.NONE.value
    recovery: List[str] = Field(default_factory=list)
    password_group: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    data_held: List[str] = Field(default_factory=list)
    last_activity: str = Field(default="2026-03-31")
    breach_flag: bool = False
    importance_override: Optional[int] = None

    @field_validator("id")
    @classmethod
    def validate_id_slug(cls, v: str) -> str:
        slug = v.strip().lower()
        if not slug:
            raise ValueError("Account id cannot be empty")
        if not re.match(r"^[a-z0-9_-]+$", slug):
            raise ValueError("Account id must be lowercase alphanumeric with underscores/hyphens")
        return slug

    @field_validator("importance_override", mode="before")
    @classmethod
    def validate_importance_override(cls, v: Any) -> Optional[int]:
        if v is None or v == "":
            return None
        if isinstance(v, str):
            mapping = {"low": 3, "medium": 6, "high": 9}
            if v.strip().lower() in mapping:
                return mapping[v.strip().lower()]
            try:
                v = int(v.strip())
            except ValueError:
                raise ValueError("importance_override must be an integer between 1 and 10 or 'low'/'medium'/'high'")
        if isinstance(v, (int, float)):
            v_int = int(v)
            if not (1 <= v_int <= 10):
                raise ValueError("importance_override must be between 1 and 10")
            return v_int
        return v

    @field_validator("second_factor")
    @classmethod
    def validate_second_factor(cls, v: str) -> str:
        valid_factors = {sf.value for sf in SecondFactor}
        if v not in valid_factors:
            raise ValueError(f"second_factor must be one of {valid_factors}")
        return v

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {at.value for at in AccountType}
        if v not in valid_types:
            raise ValueError(f"type must be one of {valid_types}")
        return v


class Settings(BaseModel):
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
    anchors: Anchors = Field(default_factory=Anchors)
    accounts: List[Account] = Field(default_factory=list)
    settings: Settings = Field(default_factory=Settings)
    last_review_at: Optional[str] = None
    now: str = Field(default_factory=get_current_iso_time)

    @model_validator(mode="after")
    def validate_integrity(self) -> State:
        validate_accounts_integrity(self.accounts)
        return self


def validate_accounts_integrity(accounts: List[Account]) -> None:
    """Validate referential integrity and constraints across all accounts."""
    account_ids = set()
    accounts_by_id: dict[str, Account] = {}

    for acct in accounts:
        if acct.id in account_ids:
            raise ValueError(f"Duplicate account id found: '{acct.id}'")
        account_ids.add(acct.id)
        accounts_by_id[acct.id] = acct

    for acct in accounts:
        # Check self-references & valid targets in recovery
        for rec in acct.recovery:
            if rec.startswith("email:"):
                target_id = rec[len("email:"):]
                if target_id == acct.id:
                    raise ValueError(f"Account '{acct.id}' cannot have self-referencing recovery email '{rec}'")
                if target_id not in accounts_by_id:
                    raise ValueError(f"Account '{acct.id}' recovery references unknown account id '{target_id}'")
                target_acct = accounts_by_id[target_id]
                if target_acct.type != "email":
                    raise ValueError(
                        f"Account '{acct.id}' recovery email target '{target_id}' must have type='email' (has '{target_acct.type}')"
                    )

        # Check self-references & valid targets in login_methods
        for lm in acct.login_methods:
            if lm.startswith("sso:"):
                target_id = lm[len("sso:"):]
                if target_id == acct.id:
                    raise ValueError(f"Account '{acct.id}' cannot have self-referencing SSO '{lm}'")
                if target_id not in accounts_by_id:
                    raise ValueError(f"Account '{acct.id}' SSO login references unknown account id '{target_id}'")

        # Check self-references & valid targets in permissions
        for perm in acct.permissions:
            if perm.startswith("email_inbox:"):
                target_id = perm[len("email_inbox:"):]
                if target_id == acct.id:
                    raise ValueError(f"Account '{acct.id}' cannot have self-referencing email inbox permission '{perm}'")
                if target_id not in accounts_by_id:
                    raise ValueError(f"Account '{acct.id}' email inbox permission references unknown account id '{target_id}'")
                target_acct = accounts_by_id[target_id]
                if target_acct.type != "email":
                    raise ValueError(
                        f"Account '{acct.id}' email inbox permission target '{target_id}' must have type='email' (has '{target_acct.type}')"
                    )


def find_account_dependents(account_id: str, accounts: List[Account]) -> List[str]:
    """Find other accounts that depend on account_id via recovery, sso, or email_inbox permission."""
    dependents = []
    target_rec = f"email:{account_id}"
    target_sso = f"sso:{account_id}"
    target_inbox = f"email_inbox:{account_id}"

    for acct in accounts:
        if acct.id == account_id:
            continue
        if target_rec in acct.recovery:
            dependents.append(f"{acct.id} (recovery)")
        if target_sso in acct.login_methods:
            dependents.append(f"{acct.id} (sso)")
        if target_inbox in acct.permissions:
            dependents.append(f"{acct.id} (permission)")

    return dependents


class CatalogEntry(BaseModel):
    key: str
    name: str
    type: str
    login_methods_supported: List[str]
    second_factors_supported: List[str]
    recovery_bypasses_2fa: bool
    typical_permissions: List[str] = Field(default_factory=list)
    default_data_held: List[str] = Field(default_factory=list)
    breach_count_5y: int = 0
