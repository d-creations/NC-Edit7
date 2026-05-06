from __future__ import annotations

from typing import Optional, Tuple, List
from enum import Enum

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps

class SpeedMode(Enum):
    CONSTANT_CUTSPEED = "CONSTANT_CUTSPEED"  # G96
    CONSTANT_REV = "CONSTANT_REV"  # G97

class FanucMillSpeedModeHandler(Handler):
    """Handle G96/G97 surface speed modal codes for Fanuc Mill.
    
    Behavior:
    - If both G96 and G97 are present in the same node an NC error is raised.
    - If G96 is present the state is marked with surface speed.
    - If G97 is present the state is marked with constant rev.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has96 = False
        has97 = False
        
        for g in node.g_code:
            if not isinstance(g, str): continue
            try:
                g_upper = g.upper()
                if g_upper.startswith("G"):
                    gnum = int(g_upper[1:3])
                else: continue
            except Exception:
                continue

            if gnum == 96: has96 = True
            if gnum == 97: has97 = True

        if has96 and has97:
            raise_nc_error(ExceptionTyps.NCCodeErrors, 100, message="Conflicting surface speed codes G96 and G97", value=str(node.g_code))

        if has96:
            try: state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_CUTSPEED
            except Exception: state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_CUTSPEED.value

        if has97:
            try: state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_REV
            except Exception: state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_REV.value

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None

__all__ = ["FanucMillSpeedModeHandler", "SpeedMode"]
