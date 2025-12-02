"""Handler for Cutter Radius Compensation (G40/G41/G42).

This handler implements tool radius compensation using:
- G40: Cancel cutter compensation
- G41: Cutter compensation left (tool on left side of programmed path)
- G42: Cutter compensation right (tool on right side of programmed path)

Tool data for compensation comes from:
- Tool Q value (quadrant Q1-Q9) stored in state.extra["tool_compensation_data"]
- Tool R value (radius) stored in state.extra["tool_compensation_data"]
- These values are set from the frontend toolValues and passed through the backend
"""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class SiemensISOCutterCompHandler(Handler):
    """Handle G40 (Cancel), G41 (Left), G42 (Right) cutter radius compensation.
    
    This handler reads tool compensation data (Q quadrant 1-9, R radius) from
    state.extra["tool_compensation_data"] which is populated from frontend
    toolValues.
    """

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
            line_nr = getattr(node, 'nc_code_line_nr', 0) or 0
            
            if mode == 40:
                # G40: Cancel cutter compensation
                state.extra["cutter_comp"] = 40
                state.extra["cutter_comp_active"] = False
                state.tool_radius = None
                state.tool_quadrant = None
            else:
                # G41 or G42: Activate cutter compensation
                # Check if we already have compensation active
                if state.extra.get("cutter_comp_active") and state.extra.get("cutter_comp") in [41, 42]:
                    if state.extra.get("cutter_comp") != mode:
                        # Changing direction without G40 first
                        raise_nc_error(
                            ExceptionTyps.NCCodeErrors,
                            -104,
                            message="Tool compensation already active - cancel with G40 before changing direction",
                            line=line_nr,
                        )
                
                state.extra["cutter_comp"] = mode
                state.extra["cutter_comp_active"] = True
                
                # Get current tool number from state
                current_tool = state.extra.get("current_tool_number")
                
                # D parameter usually specifies the offset register
                if "D" in node.command_parameter:
                    try:
                        state.extra["cutter_comp_d"] = int(node.command_parameter["D"])
                    except Exception:
                        pass
                    node.command_parameter.pop("D", None)
                
                # Get tool compensation data (Q quadrant, R radius) from state
                tool_comp_data = state.extra.get("tool_compensation_data", {})
                
                if current_tool is not None and current_tool in tool_comp_data:
                    tool_data = tool_comp_data[current_tool]
                    
                    # Set tool quadrant (Q1-Q9)
                    q_value = tool_data.get("qValue")
                    if q_value is not None:
                        try:
                            q_int = int(q_value)
                            if 1 <= q_int <= 9:
                                state.tool_quadrant = q_int
                                state.extra["tool_quadrant"] = q_int
                            else:
                                raise_nc_error(
                                    ExceptionTyps.NCCodeErrors,
                                    -102,
                                    message=f"Invalid tool quadrant Q{q_int} - must be 1-9",
                                    value=str(q_int),
                                    line=line_nr,
                                )
                        except (ValueError, TypeError):
                            pass
                    
                    # Set tool radius (R)
                    r_value = tool_data.get("rValue")
                    if r_value is not None:
                        try:
                            r_float = float(r_value)
                            if r_float > 0:
                                state.tool_radius = r_float
                                state.extra["tool_radius"] = r_float
                            else:
                                raise_nc_error(
                                    ExceptionTyps.NCCodeErrors,
                                    -107,
                                    message=f"Tool radius '{r_value}' is invalid or zero",
                                    value=str(r_value),
                                    line=line_nr,
                                )
                        except (ValueError, TypeError):
                            raise_nc_error(
                                ExceptionTyps.NCCodeErrors,
                                -107,
                                message=f"Tool radius '{r_value}' is invalid or zero",
                                value=str(r_value),
                                line=line_nr,
                            )

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
