"""Handler for Tool Changes (T-codes)."""
from __future__ import annotations

import logging
from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps

logger = logging.getLogger(__name__)


class ToolHandler(Handler):
    """Handle Tool Change commands (T).

    Validates tool number against machine configuration and stores
    the current tool number in state for use by tool compensation handlers.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # Check for T parameter
        if "T" in node.command_parameter:
            t_str = node.command_parameter["T"]
            try:
                # T codes can be T0101 (Tool 1, Offset 1) or just T1
                # For validation, we usually care about the tool number part.
                # Fanuc Lathe often uses TXXYY where XX is tool, YY is offset.
                # Siemens often uses T="ToolName" or T1.
                
                # Simple parsing: try to get integer
                t_val = int(float(t_str))
                
                # Store current tool number in state for compensation handlers
                # But first, handle Fanuc Lathe TXXYY format if needed
                
                # If machine config is present, validate and adjust t_val
                if state.machine_config:
                    min_t, max_t = state.machine_config.tool_range
                    
                    # Handle Fanuc Lathe TXXYY format (e.g. T2100 -> Tool 21, Offset 00)
                    # If the value is out of range AND it's a Fanuc control, try to extract tool number.
                    # Fanuc Lathe: T0101 -> Tool 1, Offset 1. T2100 -> Tool 21, Offset 00.
                    # So first 2 digits are Tool, last 2 are Offset.
                    
                    if t_val > max_t and "FANUC" in state.machine_config.control_type and t_val >= 100:
                         # Try to interpret as TXXYY
                         potential_tool = t_val // 100
                         if min_t <= potential_tool <= max_t:
                             # It's likely a TXXYY code.
                             # Use potential_tool as the tool number for validation and state.
                             # t_val = potential_tool # User requested NOT to change the value, just ignore error
                             pass
                    
                    # If the value is within range, good.
                    if not (min_t <= t_val <= max_t):
                        # Check if we should ignore the error for Fanuc Star
                        if "FANUC" in state.machine_config.control_type and t_val >= 100:
                             # Assume it's a valid TXXYY code that we just don't validate strictly
                             pass
                        else:
                            raise_nc_error(
                                ExceptionTyps.NCCodeErrors, 
                                200, 
                                message=f"Tool number T{t_val} out of range ({min_t}-{max_t}) for {state.machine_config.name}", 
                                value=t_str,
                                line=getattr(node, 'nc_code_line_nr', 0) or 0,
                            )

                state.extra["current_tool_number"] = t_val
                
                # Load tool compensation data if available
                tool_comp_data = state.extra.get("tool_compensation_data", {})
                if t_val in tool_comp_data:
                    tool_data = tool_comp_data[t_val]
                    # Preload tool radius if available (will be used when G41/G42 activates)
                    r_value = tool_data.get("rValue")
                    if r_value is not None:
                        try:
                            state.extra["pending_tool_radius"] = float(r_value)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Invalid tool radius value '{r_value}' for tool T{t_val}: {e}")
                    # Preload tool quadrant if available
                    q_value = tool_data.get("qValue")
                    if q_value is not None:
                        try:
                            state.extra["pending_tool_quadrant"] = int(q_value)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Invalid tool quadrant value '{q_value}' for tool T{t_val}: {e}")

            except ValueError:
                # T might be a string name (Siemens allows T="EndMill")
                # Remove quotes if present
                t_name = t_str.replace('"', '').replace("'", "")
                state.extra["current_tool_name"] = t_name
                
                # Load tool compensation data if available for named tool
                tool_comp_data = state.extra.get("tool_compensation_data", {})
                if t_name in tool_comp_data:
                    tool_data = tool_comp_data[t_name]
                    # Preload tool radius if available (will be used when G41/G42 activates)
                    r_value = tool_data.get("rValue")
                    if r_value is not None:
                        try:
                            state.extra["pending_tool_radius"] = float(r_value)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Invalid tool radius value '{r_value}' for tool T='{t_name}': {e}")
                    # Preload tool quadrant if available
                    q_value = tool_data.get("qValue")
                    if q_value is not None:
                        try:
                            state.extra["pending_tool_quadrant"] = int(q_value)
                        except (ValueError, TypeError) as e:
                            logger.warning(f"Invalid tool quadrant value '{q_value}' for tool T='{t_name}': {e}")

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
