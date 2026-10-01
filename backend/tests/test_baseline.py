from types import SimpleNamespace
from app.engines.baseline import naive_account_score, naive_plan


def test_naive_account_score_basic():
    # factor == none (+30), in reuse group (+25), breach_flag (+15), 2 perms (+6) = 76
    acc = SimpleNamespace(
        id="test_acc",
        second_factor="none",
        password_group="A",
        breach_flag=True,
        permissions=["location", "contacts"],
    )
    score = naive_account_score(acc, reuse_groups={"A"})
    assert score == 76


def test_naive_account_score_sms():
    # factor == sms (+15), no group (0), no breach (0), 0 perms (0) = 15
    acc = SimpleNamespace(
        id="sms_acc",
        second_factor="sms",
        password_group=None,
        breach_flag=False,
        permissions=[],
    )
    score = naive_account_score(acc)
    assert score == 15


def test_naive_plan():
    state = SimpleNamespace(accounts=[
        SimpleNamespace(id="a1", second_factor="none", password_group="A", permissions=[]),
        SimpleNamespace(id="a2", second_factor="none", password_group="A", permissions=["sms"]),
        SimpleNamespace(id="a3", second_factor="sms", password_group=None, permissions=[]),
    ])
    plan = naive_plan(state)
    assert len(plan) <= 3
    # unique_pw:A drops 25 * 2 = 50 points, so it should rank first
    assert plan[0] == "unique_pw:A"
    assert "2fa:a1" in plan or "2fa:a2" in plan
