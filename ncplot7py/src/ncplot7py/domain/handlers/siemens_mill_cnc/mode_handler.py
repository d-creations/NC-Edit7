"""Handler for Siemens Mode (G290) and ISO Mode (G291)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensModeHandler(Handler):
    """Handle G290 (Siemens Mode) and G291 (ISO Mode).

    Sets `state.extra['siemens_mode']` to True for G290, False for G291.
    Default is usually ISO mode (False) for this control implementation,
    but can be configured.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
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

            if gnum == 290:
                state.extra["siemens_mode"] = True
            elif gnum == 291:
                state.extra["siemens_mode"] = False

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
