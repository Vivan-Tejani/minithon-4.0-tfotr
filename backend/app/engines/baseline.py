from __future__ import annotations

from typing import Any


def naive_account_score(account: Any, reuse_groups: set[str] | None = None) -> int:
    """Computes a naive per-account checklist risk score (0-100) per PRD §6 M2-09.

    Formula:
      30 * [factor == 'none'] +
      15 * [factor == 'sms'] +
      25 * [in reuse group] +
      15 * [breach_count > 0 or flag] +
       3 * len(permissions)
    Capped at 100.
    """
    score = 0
    factor = getattr(account, "second_factor", "none") if not isinstance(account, dict) else account.get("second_factor", "none")
    if factor == "none":
        score += 30
    elif factor == "sms":
        score += 15

    pw_group = getattr(account, "password_group", None) if not isinstance(account, dict) else account.get("password_group")
    if pw_group and reuse_groups and str(pw_group) in reuse_groups:
        score += 25
    elif pw_group and not reuse_groups:
        score += 25

    breach_flag = getattr(account, "breach_flag", False) if not isinstance(account, dict) else account.get("breach_flag", False)
    breach_count = getattr(account, "breach_count_5y", 0) if not isinstance(account, dict) else account.get("breach_count_5y", 0)
    if breach_flag or breach_count > 0:
        score += 15

    permissions = getattr(account, "permissions", []) if not isinstance(account, dict) else account.get("permissions", [])
    score += 3 * len(permissions)

    return min(100, score)


def naive_plan(state: Any) -> list[str]:
    """Generates a naive top-3 fix plan based strictly on per-account score drops.

    Considers per-account fixes only (2fa, unique_pw, revoke, delete),
    ranked by the drop in the sum of naive account scores without knowledge of
    attack graphs, SIM swaps, or recovery chains.
    """
    accounts = getattr(state, "accounts", []) if not isinstance(state, dict) else state.get("accounts", [])
    if not accounts:
        return []

    # Find reuse groups with >= 2 members
    group_counts: dict[str, int] = {}
    for a in accounts:
        g = getattr(a, "password_group", None) if not isinstance(a, dict) else a.get("password_group")
        if g:
            group_counts[str(g)] = group_counts.get(str(g), 0) + 1
    reuse_groups = {g for g, count in group_counts.items() if count >= 2}

    candidate_fixes: list[tuple[str, int]] = []

    for a in accounts:
        aid = getattr(a, "id", "") if not isinstance(a, dict) else a.get("id", "")
        factor = getattr(a, "second_factor", "none") if not isinstance(a, dict) else a.get("second_factor", "none")
        if factor == "none":
            # Upgrading factor to authenticator removes 30 points
            candidate_fixes.append((f"2fa:{aid}", 30))
        elif factor == "sms":
            # Upgrading factor removes 15 points
            candidate_fixes.append((f"2fa:{aid}", 15))

        pw_group = getattr(a, "password_group", None) if not isinstance(a, dict) else a.get("password_group")
        if pw_group and str(pw_group) in reuse_groups:
            # unique_pw for this group drops 25 points per member
            candidate_fixes.append((f"unique_pw:{pw_group}", 25 * group_counts[str(pw_group)]))

        perms = getattr(a, "permissions", []) if not isinstance(a, dict) else a.get("permissions", [])
        for perm in perms:
            candidate_fixes.append((f"revoke:{aid}:{perm}", 3))

    # Deduplicate and sort by point drop descending
    seen = set()
    unique_candidates = []
    for fix_id, drop in candidate_fixes:
        if fix_id not in seen:
            seen.add(fix_id)
            unique_candidates.append((fix_id, drop))

    unique_candidates.sort(key=lambda x: x[1], reverse=True)
    return [fix_id for fix_id, _ in unique_candidates[:3]]
