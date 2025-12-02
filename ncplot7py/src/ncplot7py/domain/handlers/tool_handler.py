"""Handler for Tool Changes (T-codes)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class ToolHandler(Handler):
    """Handle Tool Change commands (T).

    Validates tool number against machine configuration.
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
                
                # If machine config is present, validate
                if state.machine_config:
                    min_t, max_t = state.machine_config.tool_range
                    
                    # Heuristic for Fanuc Lathe TXXYY:
                    # If T > 99 and max_t is 99, we might need to extract the tool part.
                    # But the user requirement says:
                    # "Fanuc Star with T1-T99" -> implies T1, T2...
                    # "Other Fanuc and Siemens with T100-T9999"
                    
                    # If the value is within range, good.
                    if not (min_t <= t_val <= max_t):
                        # If it's Fanuc Star (max 99) and we got e.g. 101, it might be T0101?
                        # But T0101 is usually 101 as int.
                        # If the machine expects T1-T99, T101 is likely invalid OR it's T1 + Offset 1.
                        # For now, we enforce the range strictly as requested.
                        
                        # However, for Fanuc Lathe, T0101 is standard. 
                        # If the user says "T1-T99", maybe they mean the physical tool number?
                        # Let's assume strict validation for now based on the request.
                        # "Fanuc Star with T1-T99"
                        
                        # If we are in Fanuc Star mode and get T0101 (101), we might want to allow it 
                        # if we interpret it as Tool 1.
                        # But let's stick to the requested range for the *value* passed in T.
                        
                        # Wait, if the user says "T1-T99", they probably mean the T-code itself.
                        # If I program T0101, the value is 101.
                        # If the machine only supports T1-T99, then T0101 is technically out of range 
                        # UNLESS the controller parses it differently.
                        # Given the explicit request "T1-T99" vs "T100-T9999", I will warn/error if out of range.
                        
                        # Let's just log a warning or raise error?
                        # The user asked to "check that the tool Data is in Fanuc Star with T1-T99".
                        # I'll raise an error if it's out of range.
                        
                        raise_nc_error(
                            ExceptionTyps.NCCodeErrors, 
                            200, 
                            message=f"Tool number T{t_val} out of range ({min_t}-{max_t}) for {state.machine_config.name}", 
                            value=t_str
                        )

            except ValueError:
                # T might be a string name (Siemens allows T="EndMill")
                # If config expects integer range, this might be an issue, 
                # but Siemens 840D supports names.
                # Our config has a range, implying integer tools.
                pass

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
