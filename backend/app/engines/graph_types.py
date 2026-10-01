"""Graph types for Chokepoint (Engine 1 -> Engine 2/3/4 contract)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple


@dataclass(frozen=True)
class Method:
    id: str                       # e.g. "amazon#recovery:email:gmail"
    label: str                    # e.g. "Recovery email reset via Gmail"
    requires: Tuple[str, ...]     # node ids; ALL must be true (AND)
    fix_hints: Tuple[str, ...]    # fix ids that would remove this method


@dataclass
class Node:
    id: str
    kind: Literal["entry", "cap", "account"]
    label: str
    p: Optional[float] = None                       # entries only
    methods: List[Method] = field(default_factory=list)  # OR of methods; [] = never true
    fix_hint: Optional[str] = None                  # entries only (e.g. "sim_lock")
    meta: dict = field(default_factory=dict)         # account: {impact, name, type}; entry: {group?}


@dataclass
class Graph:
    nodes: Dict[str, Node]
    order: List[str]              # deterministic: entries, then caps, then accounts (each sorted by id)

    def accounts(self) -> List[Node]:
        return [self.nodes[nid] for nid in self.order if self.nodes[nid].kind == "account"]

    def entries(self) -> List[Node]:
        return [self.nodes[nid] for nid in self.order if self.nodes[nid].kind == "entry"]

    def caps(self) -> List[Node]:
        return [self.nodes[nid] for nid in self.order if self.nodes[nid].kind == "cap"]

    def get(self, node_id: str) -> Optional[Node]:
        return self.nodes.get(node_id)
