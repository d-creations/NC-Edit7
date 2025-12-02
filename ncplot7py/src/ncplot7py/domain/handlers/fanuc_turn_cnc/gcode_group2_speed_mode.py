"""Handler for Fanuc-style surface speed mode (G96/G97).

Sets a flag in the CNC state indicating whether surface speed or constant
RPM mode is active. If both G96 and G97 are present in the same node an
NC error is raised.
"""
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


class GCodeGroup2SpeedModeExecChainLink(Handler):
    """Handle G96/G97 surface speed modal codes.

    Behavior:
    - If both G96 and G97 are present in the same node an NC error is raised.
    - If G96 is present the state is marked with SpeedMode.CONSTANT_CUTSPEED.
    - If G97 is present the state is marked with SpeedMode.CONSTANT_REV.
    - Delegates to next handler afterwards.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has96 = False
        has97 = False
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
            if gnum == 96:
                has96 = True
            if gnum == 97:
                has97 = True

        if has96 and has97:
            # both G96 and G97 in same block -> duplication error
            raise_nc_error(ExceptionTyps.NCCodeErrors, 100, message="Conflicting surface speed codes G96 and G97", value=str(node.g_code))

        if has96:
            try:
                state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_CUTSPEED
            except Exception:
                state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_CUTSPEED.value

        if has97:
            try:
                state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_REV
            except Exception:
                state.extra["surface_speed_mode"] = SpeedMode.CONSTANT_REV.value

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["GCodeGroup2SpeedModeExecChainLink", "SpeedMode"]
