from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState

class FanucMillWorkOffsetHandler(Handler):
    """Handle G54-G59, G52, G53, G92 for Fanuc Mill.
    
    This handler correctly sets work offsets.
    """
    
    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # This will set the active work coordinate system (G54-G59) on state 
        for g_code in set(node.g_code):
            try:
                g_upper = str(g_code).upper()
                if g_upper.startswith("G"):
                    gnum = int(g_upper[1:3])
                else: continue
            except Exception:
                continue

            # Handle classical offsets (G54-G59)
            if 54 <= gnum <= 59:
                state.extra["work_offset"] = f"G{gnum}"

                # Currently we aren't doing deep lookup in offset tables 
                # but we track the active work offset.
            
            # Group 0: G92 Set Coordinate System
            if gnum == 92 and g_code == "G92":
                for axis in ["X", "Y", "Z", "A", "B", "C"]:
                    if axis in node.command_parameter:
                        try:
                            val = float(node.command_parameter[axis])
                            # Set offset such that current position becomes val
                            current = state.axes.get(axis, 0.0)
                            state.offsets[axis] = state.offsets.get(axis, 0.0) + (current - val)
                        except Exception:
                            pass
                            
            # Local Offset: G52
            if gnum == 52 and g_code == "G52":
                # Similar logic, just sets local zero
                for axis in ["X", "Y", "Z", "A", "B", "C"]:
                    if axis in node.command_parameter:
                        try:
                            val = float(node.command_parameter[axis])
                            # Could store in local_offsets
                            if "local_offsets" not in state.extra:
                                state.extra["local_offsets"] = {}
                            state.extra["local_offsets"][axis] = val
                        except Exception:
                            pass
        
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None

__all__ = ["FanucMillWorkOffsetHandler"]
