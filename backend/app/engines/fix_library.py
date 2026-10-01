"""Engine 3: Fix Library - Candidate Generation and Pure Fix Application."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from backend.app.data.loader import Account, CatalogEntry, State, load_catalog

EffortType = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class Fix:
    id: str
    type: str
    title: str
    target: str
    effort: EffortType
    why: str


def generate_candidates(
    state: State,
    catalog: dict[str, CatalogEntry] | None = None,
) -> list[Fix]:
    """Generate all applicable candidate fixes for the given state."""
    cat_map = catalog if catalog is not None else load_catalog()
    candidates: list[Fix] = []

    # 1. sim_lock
    if not state.anchors.phone.sim_lock:
        candidates.append(
            Fix(
                id="sim_lock",
                type="sim_lock",
                title="Turn on SIM lock (port-out PIN) with your carrier",
                target="phone",
                effort="low",
                why="Prevents attackers from redirecting SMS verification codes to their own SIM card.",
            )
        )

    # 2. device_lock
    if not state.anchors.phone.device_lock:
        candidates.append(
            Fix(
                id="device_lock",
                type="device_lock",
                title="Turn on device lock (passcode / biometric) on your phone",
                target="phone",
                effort="low",
                why="Prevents attackers who physically access your phone from reading SMS codes or opening apps.",
            )
        )

    # 3. 2fa:<acct>
    for a in state.accounts:
        cat = cat_map.get(a.service_key)
        if isinstance(cat, dict):
            supported = cat.get("second_factors_supported", ["sms", "authenticator"])
        elif cat:
            supported = getattr(cat, "second_factors_supported", ["sms", "authenticator"])
        else:
            supported = ["sms", "authenticator"]

        if a.second_factor == "none":
            if "authenticator" in supported or "hardware_key" in supported:
                candidates.append(
                    Fix(
                        id=f"2fa:{a.id}",
                        type="2fa",
                        title=f"Enable authenticator app 2FA on {a.name}",
                        target=a.id,
                        effort="medium",
                        why=f"Adds an authenticator verification layer to {a.name} so leaked passwords cannot take over your account.",
                    )
                )
            elif "sms" in supported:
                candidates.append(
                    Fix(
                        id=f"2fa:{a.id}",
                        type="2fa",
                        title=f"Enable SMS two-factor authentication on {a.name}",
                        target=a.id,
                        effort="medium",
                        why=f"Adds a second verification step to {a.name} so password leaks alone are insufficient.",
                    )
                )
        elif a.second_factor == "sms":
            if "authenticator" in supported or "hardware_key" in supported:
                candidates.append(
                    Fix(
                        id=f"2fa:{a.id}",
                        type="2fa",
                        title=f"Switch {a.name} 2FA from SMS to an authenticator app",
                        target=a.id,
                        effort="medium",
                        why=f"Protects {a.name} from SIM swap attacks by replacing SMS codes with an app authenticator.",
                    )
                )
        elif a.second_factor == "authenticator":
            if "hardware_key" in supported:
                candidates.append(
                    Fix(
                        id=f"2fa:{a.id}:hardware_key",
                        type="2fa",
                        title=f"Upgrade {a.name} 2FA to a hardware security key",
                        target=a.id,
                        effort="medium",
                        why=f"Provides phishing-proof hardware security key authentication for {a.name}.",
                    )
                )

    # 4. rm_login:a:sms_otp
    for a in state.accounts:
        if "sms_otp" in a.login_methods:
            candidates.append(
                Fix(
                    id=f"rm_login:{a.id}:sms_otp",
                    type="rm_login",
                    title=f"Remove SMS OTP login from {a.name}",
                    target=a.id,
                    effort="low",
                    why=f"Prevents SIM swap attacks from directly logging into {a.name}.",
                )
            )

    # 5. rm_recovery:a:...
    for a in state.accounts:
        total_methods = len(a.login_methods) + len(a.recovery)
        # generated when recovery contains that method and at least one other recovery or login method remains
        if total_methods > 1 and len(a.recovery) > 0:
            for r in a.recovery:
                if r == "sms":
                    candidates.append(
                        Fix(
                            id=f"rm_recovery:{a.id}:sms",
                            type="rm_recovery",
                            title=f"Remove SMS code recovery from {a.name}",
                            target=a.id,
                            effort="low",
                            why=f"Stops attackers with your phone number from resetting your {a.name} password.",
                        )
                    )
                elif r.startswith("email:"):
                    email_acct = r.split(":", 1)[1]
                    email_name = next((x.name for x in state.accounts if x.id == email_acct), email_acct)
                    candidates.append(
                        Fix(
                            id=f"rm_recovery:{a.id}:email:{email_acct}",
                            type="rm_recovery",
                            title=f"Remove {email_name} email recovery from {a.name}",
                            target=a.id,
                            effort="low",
                            why=f"Breaks the recovery chain into {a.name} if {email_name} is compromised.",
                        )
                    )

    # 6. unique_pw:g
    groups: dict[str, list[Account]] = {}
    for a in state.accounts:
        if a.password_group:
            groups.setdefault(a.password_group, []).append(a)

    for g, members in groups.items():
        if len(members) >= 2:
            effort: EffortType = "high" if len(members) >= 4 else "medium"
            member_names = [m.name for m in members]
            candidates.append(
                Fix(
                    id=f"unique_pw:{g}",
                    type="unique_pw",
                    title=f"Use a different password for each of: {', '.join(sorted(member_names))}",
                    target=g,
                    effort=effort,
                    why=f"Stops a breach of one service in group '{g}' from compromising {len(members)} accounts.",
                )
            )

    # 7. revoke:a:perm
    for a in state.accounts:
        for perm in a.permissions:
            candidates.append(
                Fix(
                    id=f"revoke:{a.id}:{perm}",
                    type="revoke",
                    title=f"Revoke '{perm}' from {a.name}",
                    target=a.id,
                    effort="low",
                    why=f"Limits the blast radius if {a.name} is compromised.",
                )
            )

    # 8. delete:a
    now_str = state.now[:10] if state.now else "2026-10-01"
    now_date = date.fromisoformat(now_str)
    for a in state.accounts:
        act_str = a.last_activity[:10]
        act_date = date.fromisoformat(act_str)
        days_inactive = (now_date - act_date).days
        if days_inactive > state.settings.stale_days:
            candidates.append(
                Fix(
                    id=f"delete:{a.id}",
                    type="delete",
                    title=f"Delete unused account {a.name}",
                    target=a.id,
                    effort="medium",
                    why=f"Removes attack surface from an inactive account ({a.name}) you no longer use.",
                )
            )

    return candidates


def apply_fix(
    state: State,
    fix_or_id: Fix | str,
    catalog: dict[str, CatalogEntry] | None = None,
) -> State:
    """Apply a fix to a state. Pure and idempotent, returns a deep copy of State."""
    fix_id = fix_or_id.id if isinstance(fix_or_id, Fix) else str(fix_or_id)
    cat_map = catalog if catalog is not None else load_catalog()

    new_state = state.model_copy(deep=True)

    if fix_id == "sim_lock":
        new_state.anchors.phone.sim_lock = True
        return new_state

    if fix_id == "device_lock":
        new_state.anchors.phone.device_lock = True
        return new_state

    if fix_id.startswith("2fa:"):
        parts = fix_id.split(":")
        target_id = parts[1]
        target_level = parts[2] if len(parts) > 2 else None

        for a in new_state.accounts:
            if a.id == target_id:
                cat = cat_map.get(a.service_key)
                if isinstance(cat, dict):
                    supported = cat.get("second_factors_supported", ["sms", "authenticator"])
                elif cat:
                    supported = getattr(cat, "second_factors_supported", ["sms", "authenticator"])
                else:
                    supported = ["sms", "authenticator"]

                if target_level == "hardware_key":
                    if "hardware_key" in supported:
                        a.second_factor = "hardware_key"
                else:
                    # Upgrade none or sms to authenticator (or sms if that's all that's supported)
                    if a.second_factor in ("none", "sms"):
                        if "authenticator" in supported or "hardware_key" in supported:
                            a.second_factor = "authenticator"
                        elif "sms" in supported:
                            a.second_factor = "sms"
                break
        return new_state

    if fix_id.startswith("rm_login:"):
        parts = fix_id.split(":")
        if len(parts) >= 3:
            target_id, method = parts[1], parts[2]
            for a in new_state.accounts:
                if a.id == target_id:
                    a.login_methods = [m for m in a.login_methods if m != method]
                    break
        return new_state

    if fix_id.startswith("rm_recovery:"):
        parts = fix_id.split(":")
        if len(parts) >= 3:
            target_id = parts[1]
            rec_method = parts[2] if len(parts) == 3 else f"{parts[2]}:{parts[3]}"
            for a in new_state.accounts:
                if a.id == target_id:
                    a.recovery = [r for r in a.recovery if r != rec_method]
                    break
        return new_state

    if fix_id.startswith("unique_pw:"):
        target_group = fix_id.split(":", 1)[1]
        for a in new_state.accounts:
            if a.password_group == target_group:
                a.password_group = None
        return new_state

    if fix_id.startswith("revoke:"):
        parts = fix_id.split(":", 2)
        if len(parts) >= 3:
            target_id, perm = parts[1], parts[2]
            for a in new_state.accounts:
                if a.id == target_id:
                    a.permissions = [p for p in a.permissions if p != perm]
                    break
        return new_state

    if fix_id.startswith("delete:"):
        target_id = fix_id.split(":", 1)[1]
        sso_ref = f"sso:{target_id}"

        # Skip deletion when it would leave another account with no login method
        for other in new_state.accounts:
            if other.id != target_id:
                remaining_logins = [m for m in other.login_methods if m != sso_ref]
                if not remaining_logins:
                    return state.model_copy(deep=True)

        # Remove the account
        new_state.accounts = [a for a in new_state.accounts if a.id != target_id]

        # Strip dangling references
        email_rec = f"email:{target_id}"
        inbox_perm = f"email_inbox:{target_id}"
        for a in new_state.accounts:
            a.recovery = [r for r in a.recovery if r != email_rec]
            a.login_methods = [m for m in a.login_methods if m != sso_ref]
            a.permissions = [p for p in a.permissions if p != inbox_perm]
        return new_state

    return new_state
