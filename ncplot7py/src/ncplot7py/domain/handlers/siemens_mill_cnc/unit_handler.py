"""Handler for Siemens ISO Units (G20/G21)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensISOInchMetricHandler(Handler):
    """Handle G20 (Inch) and G21 (Metric)."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum == 20:
                        state.extra["units"] = "INCH"
                    elif gnum == 21:
                        state.extra["units"] = "METRIC"
            except Exception:
                continue

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
