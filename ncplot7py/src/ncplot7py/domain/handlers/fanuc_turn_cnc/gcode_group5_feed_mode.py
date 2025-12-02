"""Handler for Fanuc-style feed mode (G98/G99).

G98 = feed per minute (FEED_PER_MIN)
G99 = feed per revolution (FEED_PER_REV)

This sets a simple flag in the CNC state under `extra['feed_mode']` so
other parts of the system can react accordingly.
"""
from __future__ import annotations

from typing import Optional, Tuple, List
from enum import Enum

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class FeedMode(Enum):
    FEED_PER_MIN = "FEED_PER_MIN"  # G98
    FEED_PER_REV = "FEED_PER_REV"  # G99


class GCodeGroup5FeedModeExecChainLink(Handler):
    """Handle G98/G99 feed mode codes.

    - If both G98 and G99 are present in the same node an NC error is raised.
    - Sets `state.extra['feed_mode']` to the appropriate FeedMode.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has98 = False
        has99 = False
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                else:
                    continue
            except Exception:
                continue
            if gnum == 98:
                has98 = True
            if gnum == 99:
                has99 = True

        if has98 and has99:
            raise_nc_error(ExceptionTyps.NCCodeErrors, 101, message="Conflicting feed mode codes G98 and G99", value=str(node.g_code))

        if has98:
            try:
                state.extra["feed_mode"] = FeedMode.FEED_PER_MIN
            except Exception:
                state.extra["feed_mode"] = FeedMode.FEED_PER_MIN.value

        if has99:
            try:
                state.extra["feed_mode"] = FeedMode.FEED_PER_REV
            except Exception:
                state.extra["feed_mode"] = FeedMode.FEED_PER_REV.value

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["GCodeGroup5FeedModeExecChainLink", "FeedMode"]
