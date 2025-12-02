"""Handler for Fanuc-style plane selection (G17/G18/G19) -- Group 16.

This handler sets the current working plane in the `CNCState` by writing
into `state.extra['g_group_16_plane']`. It detects conflicting codes and
raises an NC error when multiple plane codes are present in the same block.

The values stored are simple strings matching the notation used elsewhere
in the codebase: 'X_Y', 'X_Z', 'Y_Z'.
"""
from __future__ import annotations

from typing import Optional, Tuple, List
from enum import Enum

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class PlaneMode(Enum):
    X_Y = "X_Y"  # G17
    X_Z = "X_Z"  # G18
    Y_Z = "Y_Z"  # G19


class GCodeGroup16PlaneExecChainLink(Handler):
    """Handle G17/G18/G19 plane selection codes.

    - If more than one plane code is present in the same block, an NC error
      is raised.
    - Otherwise, update `state.extra['g_group_16_plane']` with the selected
      plane mode (enum or its value).
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has17 = False
        has18 = False
        has19 = False

        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    num = int(g[1:])
                else:
                    continue
            except Exception:
                continue
            if num == 17:
                has17 = True
            elif num == 18:
                has18 = True
            elif num == 19:
                has19 = True

        # conflicting plane codes in same block
        if (has17 and has18) or (has17 and has19) or (has18 and has19):
            raise_nc_error(ExceptionTyps.NCCodeErrors, 120, message="Conflicting plane selection codes (G17/G18/G19)", value=str(node.g_code))

        if has17:
            try:
                state.extra["g_group_16_plane"] = PlaneMode.X_Y
            except Exception:
                state.extra["g_group_16_plane"] = PlaneMode.X_Y.value
        if has18:
            try:
                state.extra["g_group_16_plane"] = PlaneMode.X_Z
            except Exception:
                state.extra["g_group_16_plane"] = PlaneMode.X_Z.value
        if has19:
            try:
                state.extra["g_group_16_plane"] = PlaneMode.Y_Z
            except Exception:
                state.extra["g_group_16_plane"] = PlaneMode.Y_Z.value

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["GCodeGroup16PlaneExecChainLink", "PlaneMode"]
