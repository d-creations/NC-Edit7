"""Handler for Fanuc-style polar coordinate mode (G112/G113) — Group 21.

This handler implements a lightweight version of G12.1 / polar-coordinate
semantics used on some Fanuc controllers. It does not change the machine
state shape; instead it stores flags under `state.extra` and remaps
parameters on the node when polar interpolation is active.

Behavior implemented:
- G112 -> enable polar coordinates (store flag) and set plane to X_Y
- G113 -> disable polar coordinates and set plane to X_Z
- When polar is enabled, translate C/H parameters to the configured
  `polar_interpolate_axis` (expected in `state.extra` as 'X' or 'Y') using
  axis multipliers `x_axis_multiplication` / `y_axis_multiplication`.
- When polar axis is X, swap G2/G3 directions (mirror behaviour used by
  some controllers).

This is conservative: missing state fields are treated with sensible
defaults and errors are raised via the domain helper when conflicting
modal codes are present.
"""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class GCodeGroup21PolarCoExecChainLink(Handler):
    """Handle G112/G113 (polar coordinate on/off) and remap parameters.

    The handler stores small flags in `state.extra` instead of adding new
    typed fields to `CNCState` to avoid changing the core dataclass here.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        has112 = False
        has113 = False
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
            if gnum == 112:
                has112 = True
            if gnum == 113:
                has113 = True

        if has112 and has113:
            raise_nc_error(ExceptionTyps.NCCodeErrors, 110, message="Conflicting polar coordinate codes G112 and G113", value=str(node.g_code))

        # set flags in state.extra
        if has112:
            # remember previous plane (if any) so disabling polar can
            # restore it rather than forcing an arbitrary plane.
            prev = state.extra.get("g_group_16_plane")
            if prev is not None:
                state.extra["g_group_21_prev_plane"] = prev
            state.extra["g_group_21_star"] = "POLAR_COORDINATE_ON"
            state.extra["g_group_16_plane"] = "X_Y"
        if has113:
            state.extra["g_group_21_star"] = "POLAR_COORDINATE_OFF"
            # restore previous plane if we recorded one, otherwise default
            # to X_Y (XY plane) which is the most common working plane.
            prev = state.extra.pop("g_group_21_prev_plane", None)
            if prev is not None:
                state.extra["g_group_16_plane"] = prev
            else:
                state.extra["g_group_16_plane"] = "X_Y"

        # If polar mode active, remap C/H -> axis and possibly swap arcs
        if state.extra.get("g_group_21_star") == "POLAR_COORDINATE_ON":
            # which axis is used for polar interpolation? default to 'Y'
            polar_axis = state.extra.get("polar_interpolate_axis", "Y")
            # multipliers (defaults to 1.0)
            xmul = float(state.extra.get("x_axis_multiplication", 1.0))
            ymul = float(state.extra.get("y_axis_multiplication", 1.0))

            # C parameter -> axis displacement
            if node.command_parameter and "C" in node.command_parameter:
                try:
                    raw = float(node.command_parameter.get("C", 0.0))
                except Exception:
                    raw = 0.0
                if polar_axis == "Y":
                    value = raw * ymul
                elif polar_axis == "X":
                    value = raw * xmul
                else:
                    raise_nc_error(ExceptionTyps.NCCodeErrors, 111, message="Polar interpolation axis not recognised", value=polar_axis)
                node.command_parameter[polar_axis] = str(value)
                node.command_parameter.pop("C", None)

            # H parameter -> maps to V (when polar Y) or U (when polar X)
            if node.command_parameter and "H" in node.command_parameter:
                try:
                    raw = float(node.command_parameter.get("H", 0.0))
                except Exception:
                    raw = 0.0
                if polar_axis == "Y":
                    value = raw * ymul
                    node.command_parameter["V"] = str(value)
                elif polar_axis == "X":
                    value = raw * xmul
                    node.command_parameter["U"] = str(value)
                else:
                    raise_nc_error(ExceptionTyps.NCCodeErrors, 111, message="Polar interpolation axis not recognised", value=polar_axis)
                node.command_parameter.pop("H", None)

            # swap G2/G3 if polar axis is X (mirror winding direction)
            if polar_axis == "X":
                # operate on a copy to avoid modifying the set during iteration
                for g in list(node.g_code):
                    if not isinstance(g, str):
                        continue
                    try:
                        if not g.upper().startswith("G"):
                            continue
                        num = int(g[1:])
                    except Exception:
                        continue
                    if num == 2:
                        node.g_code.remove(g)
                        node.g_code.add("G3")
                    elif num == 3:
                        node.g_code.remove(g)
                        node.g_code.add("G2")

        # Delegate
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["GCodeGroup21PolarCoExecChainLink"]
