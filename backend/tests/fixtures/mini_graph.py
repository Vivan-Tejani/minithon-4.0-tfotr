from app.engines.graph_types import Graph, Method, Node


def create_mini_graph() -> Graph:
    """Creates a hand-built mini graph per ticket M2-00:

    - entries:
        E_SIM (p 0.10)
        E_PHONE (p 0.20, no grants)
    - caps:
        CAP_SMS <- [E_SIM]
        CAP_INBOX:gmail <- [ACC:gmail]
        CAP_KEY <- (never)
    - accounts:
        ACC:gmail <- recovery [CAP_SMS]
        ACC:canva <- sso [ACC:gmail]
        ACC:netflix <- recovery [CAP_INBOX:gmail]
        ACC:vault <- [CAP_KEY] (never)

    Expected under forced {E_SIM}:
        gmail at hop 1
        canva at hop 2
        netflix at hop 2
        vault never
    """
    nodes = {
        "E_SIM": Node(
            id="E_SIM",
            kind="entry",
            label="Your phone number (SIM card)",
            p=0.10,
            fix_hint="sim_lock",
        ),
        "E_PHONE": Node(
            id="E_PHONE",
            kind="entry",
            label="Your phone (physical device)",
            p=0.20,
            fix_hint="device_lock",
        ),
        "CAP_SMS": Node(
            id="CAP_SMS",
            kind="cap",
            label="SMS Verification Codes",
            methods=[
                Method(
                    id="CAP_SMS#sim",
                    label="SMS via SIM swap",
                    requires=("E_SIM",),
                    fix_hints=("sim_lock",),
                )
            ],
        ),
        "CAP_INBOX:gmail": Node(
            id="CAP_INBOX:gmail",
            kind="cap",
            label="Gmail Inbox Access",
            methods=[
                Method(
                    id="CAP_INBOX:gmail#account",
                    label="Gmail account compromised",
                    requires=("ACC:gmail",),
                    fix_hints=(),
                )
            ],
        ),
        "CAP_KEY": Node(
            id="CAP_KEY",
            kind="cap",
            label="Physical Security Key",
            methods=[],
        ),
        "ACC:gmail": Node(
            id="ACC:gmail",
            kind="account",
            label="Gmail",
            methods=[
                Method(
                    id="ACC:gmail#recovery:sms",
                    label="Password reset via SMS code",
                    requires=("CAP_SMS",),
                    fix_hints=("rm_recovery:gmail:sms",),
                )
            ],
            meta={"impact": 6, "name": "Gmail", "type": "email"},
        ),
        "ACC:canva": Node(
            id="ACC:canva",
            kind="account",
            label="Canva",
            methods=[
                Method(
                    id="ACC:canva#sso:gmail",
                    label="Single Sign-On with Google",
                    requires=("ACC:gmail",),
                    fix_hints=(),
                )
            ],
            meta={"impact": 2, "name": "Canva", "type": "utility_app"},
        ),
        "ACC:netflix": Node(
            id="ACC:netflix",
            kind="account",
            label="Netflix",
            methods=[
                Method(
                    id="ACC:netflix#recovery:email:gmail",
                    label="Password reset link sent to Gmail",
                    requires=("CAP_INBOX:gmail",),
                    fix_hints=("rm_recovery:netflix:email:gmail",),
                )
            ],
            meta={"impact": 2, "name": "Netflix", "type": "entertainment"},
        ),
        "ACC:vault": Node(
            id="ACC:vault",
            kind="account",
            label="Vault",
            methods=[
                Method(
                    id="ACC:vault#fido2",
                    label="FIDO2 Hardware Key Authentication",
                    requires=("CAP_KEY",),
                    fix_hints=(),
                )
            ],
            meta={"impact": 2, "name": "Vault", "type": "finance"},
        ),
    }

    # Deterministic order: entries, then caps, then accounts (each sorted by id)
    entries = sorted([nid for nid, n in nodes.items() if n.kind == "entry"])
    caps = sorted([nid for nid, n in nodes.items() if n.kind == "cap"])
    accounts = sorted([nid for nid, n in nodes.items() if n.kind == "account"])
    order = entries + caps + accounts

    return Graph(nodes=nodes, order=order)
