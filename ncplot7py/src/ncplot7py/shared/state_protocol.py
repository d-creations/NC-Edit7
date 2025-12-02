"""Lightweight protocol describing the parts of CNCState handlers use.

Placed under `shared` so other layers can depend on this contract without
importing the full domain model.
"""
from __future__ import annotations

from typing import Protocol, Dict, Any, Optional


class StateProtocol(Protocol):
    """Subset of CNCState used by handlers and the exec chain.

    Keep this minimal — handlers should not rely on the full implementation.
    """

    axes: Dict[str, float]
    feed_rate: Optional[float]

    def resolve_target(self, target_spec: Dict[str, float], absolute: bool = True) -> Dict[str, float]:
        ...

    def update_axes(self, updates: Dict[str, float]) -> None:
        ...

    def get_modal(self, group: str) -> Optional[str]:
        ...

    def compute_distance(self, a: Dict[str, float], b: Dict[str, float], axes: Optional[list[str]] = None) -> float:
        ...


__all__ = ["StateProtocol"]
