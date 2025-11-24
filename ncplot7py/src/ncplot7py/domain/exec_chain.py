"""Chain-of-Responsibility base Handler moved to domain.

This module contains the Handler primitive; placing it in `domain` makes it
the canonical location for execution primitives that operate on domain state.
"""
from __future__ import annotations

from typing import Optional, Tuple, List, TYPE_CHECKING, Any

from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.state_protocol import StateProtocol

if TYPE_CHECKING:
    CNCStateType = StateProtocol
else:
    CNCStateType = Any


class Handler:
    """Base handler with optional next pointer."""

    def __init__(self, next_handler: Optional["Handler"] = None):
        self.next_handler = next_handler

    def handle(self, node: NCCommandNode, state: CNCStateType) -> Tuple[Optional[List], Optional[float]]:
        """Handle a node; return (points_list, duration) or delegate."""
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["Handler"]
