"""Handler for Siemens ISO Feed Modes (G94/G95)."""
from __future__ import annotations

from typing import Optional, Tuple, List
from enum import Enum

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class FeedMode(Enum):
    FEED_PER_MIN = "FEED_PER_MIN"  # G94
    FEED_PER_REV = "FEED_PER_REV"  # G95


class SiemensISOFeedHandler(Handler):
    """Handle G94 (Feed per min) and G95 (Feed per rev)."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has_g94 = False
        has_g95 = False

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

            if gnum == 94:
                has_g94 = True
            elif gnum == 95:
                has_g95 = True

        if has_g94:
            state.extra["feed_mode"] = FeedMode.FEED_PER_MIN
        if has_g95:
            state.extra["feed_mode"] = FeedMode.FEED_PER_REV

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
