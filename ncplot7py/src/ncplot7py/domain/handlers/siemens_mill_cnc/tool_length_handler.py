"""Handler for Tool Length Compensation (G43/G44/G49)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensISOToolLengthHandler(Handler):
    """Handle G43 (Add), G44 (Sub), G49 (Cancel) Tool Length Comp."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        mode = None  # 43, 44, 49

        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum in [43, 44, 49]:
                        mode = gnum
            except Exception:
                continue

        if mode == 49:
            # Cancel offset on Z (or active plane perp axis)
            # Assuming Z for now.
            state.offsets["Z"] = 0.0

        elif mode in [43, 44]:
            # Get H parameter
            h_val = 0.0
            if "H" in node.command_parameter:
                try:
                    # In real life, H is an index into tool table.
                    # Here, we might treat H as the value itself if simplified,
                    # or we need a tool table in state.
                    # Let's assume H is the value for this simplified build.
                    h_val = float(node.command_parameter["H"])
                except Exception:
                    pass
                # Remove H so it doesn't confuse other handlers
                node.command_parameter.pop("H", None)

            if mode == 43:
                state.offsets["Z"] = h_val
            elif mode == 44:
                state.offsets["Z"] = -h_val

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
