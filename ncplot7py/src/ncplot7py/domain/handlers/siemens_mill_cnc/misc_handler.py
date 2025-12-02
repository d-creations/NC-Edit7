"""Handler for Siemens ISO Misc Codes (G4, G28, etc.)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensISOMiscHandler(Handler):
    """Handle G4 (Dwell), G28 (Reference Return)."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has_g4 = False
        has_g28 = False

        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum == 4:
                        has_g4 = True
                    elif gnum == 28:
                        has_g28 = True
            except Exception:
                continue

        if has_g4:
            # Dwell. Calculate duration.
            # P or X or U usually.
            duration = 0.0
            if "P" in node.command_parameter:
                try:
                    duration = float(node.command_parameter["P"]) / 1000.0  # P is often ms
                except Exception:
                    pass
            elif "X" in node.command_parameter:
                try:
                    duration = float(node.command_parameter["X"])
                except Exception:
                    pass

            # Return no points, but duration
            return [], duration

        if has_g28:
            # Reference return.
            # Usually moves to intermediate point then to reference.
            # Simplified: Move to reference (0,0,0 in Machine Coords).
            # We can just let it pass through or handle it.
            pass

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
