from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class ModalHandler(Handler):
    """Handler to update modal feed/spindle parameters from block parameters.

    This centralizes updating `state.feed_rate` and `state.spindle_speed` so
    motion handlers can rely on modal state being set earlier in the chain.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # Extract block parameters (keys are letters) and update modal state
        try:
            for k, v in node.command_parameter.items():
                key = str(k).upper()
                if key == "F":
                    try:
                        state.feed_rate = float(v)
                    except Exception:
                        # ignore invalid feed values
                        pass
                elif key == "S":
                    try:
                        state.spindle_speed = float(v)
                    except Exception:
                        pass
        except Exception:
            # be defensive: if node.command_parameter is unexpected, ignore
            pass

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["ModalHandler"]
