from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class Method:
    id: str                       # e.g., "amazon#recovery:email:gmail"
    label: str                    # used in explanations: "Recovery email reset via Gmail"
    requires: tuple[str, ...]     # node ids; ALL must be true (AND)
    fix_hints: tuple[str, ...]    # fix ids that would remove this method


@dataclass
class Node:
    id: str
    kind: Literal["entry", "cap", "account"]
    label: str
    p: float | None = None                    # entries only
    methods: list[Method] = field(default_factory=list)   # OR of methods; [] = never true
    fix_hint: str | None = None               # entries only (e.g. "sim_lock")
    meta: dict = field(default_factory=dict)  # account: {impact,name,type}; entry: {group?}


@dataclass
class Graph:
    nodes: dict[str, Node]
    order: list[str]              # deterministic: entries, then caps, then accounts (each sorted by id)

    def accounts(self) -> list[Node]:
        """Returns all account nodes in the graph in deterministic order."""
        return [self.nodes[nid] for nid in self.order if self.nodes[nid].kind == "account"]

    def entries(self) -> list[Node]:
        """Returns all entry nodes in the graph in deterministic order."""
        return [self.nodes[nid] for nid in self.order if self.nodes[nid].kind == "entry"]

    def get(self, id: str) -> Node | None:
        """Retrieves a node by id, or None if not found."""
        return self.nodes.get(id)
