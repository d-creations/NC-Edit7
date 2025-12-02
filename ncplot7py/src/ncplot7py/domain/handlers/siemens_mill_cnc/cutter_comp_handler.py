"""Handler for Cutter Radius Compensation (G40/G41/G42)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensISOCutterCompHandler(Handler):
    """Handle G40 (Cancel), G41 (Left), G42 (Right)."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        mode = None
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum in [40, 41, 42]:
                        mode = gnum
            except Exception:
                continue

        if mode is not None:
            state.extra["cutter_comp"] = mode
            # D parameter usually specifies the offset register
            if "D" in node.command_parameter:
                try:
                    state.extra["cutter_comp_d"] = int(node.command_parameter["D"])
                except Exception:
                    pass
                node.command_parameter.pop("D", None)

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
