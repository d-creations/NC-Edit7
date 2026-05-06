from __future__ import annotations

from typing import Optional, Tuple, List
from enum import Enum

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps

class FeedMode(Enum):
    INVERSE_TIME = "INVERSE_TIME"  # G93
    FEED_PER_MIN = "FEED_PER_MIN"  # G94
    FEED_PER_REV = "FEED_PER_REV"  # G95

class FanucMillGroup5FeedModeHandler(Handler):
    """Handle G93/G94/G95 feed mode codes for Fanuc Mill."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has93 = False
        has94 = False
        has95 = False
        
        for g in node.g_code:
            if not isinstance(g, str): continue
            try:
                g_upper = g.upper()
                if g_upper.startswith("G"):
                    gnum = int(g_upper[1:])
                else: continue
            except Exception:
                continue
                
            if gnum == 93: has93 = True
            if gnum == 94: has94 = True
            if gnum == 95: has95 = True

        count = sum([has93, has94, has95])
        if count > 1:
            raise_nc_error(ExceptionTyps.NCCodeErrors, 102, message="Conflicting feed mode codes (G93/G94/G95)", value=str(node.g_code))

        mode = None
        if has93: mode = FeedMode.INVERSE_TIME
        if has94: mode = FeedMode.FEED_PER_MIN
        if has95: mode = FeedMode.FEED_PER_REV

        if mode is not None:
            try:
                state.extra["feed_mode"] = mode
            except Exception:
                state.extra["feed_mode"] = mode.value

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None

__all__ = ["FanucMillGroup5FeedModeHandler", "FeedMode"]
