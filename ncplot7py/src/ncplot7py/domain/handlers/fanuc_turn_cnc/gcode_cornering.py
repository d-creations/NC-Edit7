from __future__ import annotations

import math
from typing import Optional, Tuple, List, Dict

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState

def _to_float(v: Optional[str], default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default

class FanucCorneringHandler(Handler):
    """Handler for Fanuc-style Chamfering (C, ,C, I, K) and Corner R (R, ,R).

    This handler implements the Look-Ahead Buffer logic required to process
    cornering blocks. When it encounters a G1 block with a cornering parameter,
    it looks ahead to the next motion block, calculates the physical intersection,
    and synthesizes a new arc (G2/G3) or chamfer (G1) block. 
    """

    def _get_active_plane_axes(self, state: CNCState) -> Tuple[str, str]:
        # Determine the active plane (G17: X-Y, G18: Z-X, G19: Y-Z)
        plane = getattr(state, "extra", {}).get("g_group_16_plane", "X_Z")
        if hasattr(plane, "value"):
            plane = plane.value
        plane_name = str(plane)
        if plane_name.endswith("X_Y"):   return ("X", "Y")
        if plane_name.endswith("Y_Z"):   return ("Y", "Z")
        return ("Z", "X") # Default to G18 Z-X for lathe


    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # Only process G1 moves that might have corner attributes
        if not ("G01" in (g.upper() for g in node.g_code) or "G1" in (g.upper() for g in node.g_code)):
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        # Check for Corner R (R or ,R) or Chamfer (,C, C, I, K)
        # Note: Fanuc standard cornering parameters might show up as 'R', 'C', 'I', 'K'
        # if the tokenizer captures them without the comma, or ',R', ',C', ',A' if it does.
        has_corner = False
        corner_type = None
        corner_val = 0.0

        for key in list(node.command_parameter.keys()):
            upper_key = key.upper()
            if upper_key in ("C", "I", "K"):
                has_corner = True
                corner_type = "CHAMFER"
                corner_val = float(node.command_parameter.pop(key))
                break
            elif upper_key in ("R"):
                has_corner = True
                corner_type = "CORNER_R"
                corner_val = float(node.command_parameter.pop(key))
                break
        
        # Check DDDP parameters (e.g. ',C0.2', ',R0.5', ',A10.0')
        angle_val = None
        for dddp in list(node.dddp_command):
            # dddp is like ',C0.2', ',R0.5', ',A10.0'
            up_dddp = dddp.upper()
            if up_dddp.startswith(",C"):
                has_corner = True
                corner_type = "CHAMFER"
                corner_val = float(up_dddp[2:])
                node.dddp_command.remove(dddp)
            elif up_dddp.startswith(",R"):
                has_corner = True
                corner_type = "CORNER_R"
                corner_val = float(up_dddp[2:])
                node.dddp_command.remove(dddp)
            elif up_dddp.startswith(",A"):
                angle_val = float(up_dddp[2:])
                node.dddp_command.remove(dddp)
                
        # Also check for standard 'A' parameter if DDDP angle is used without comma in some dialects
        if angle_val is None:
            for key in list(node.command_parameter.keys()):
                if key.upper() in ("A"):
                    # Only map A to angle if we suspect it's DDDP
                    angle_val = float(node.command_parameter.pop(key))
                    break
                
        if not has_corner and angle_val is None:
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        # --- We have a Corner/Chamfer! Now Look-Ahead ---
        # Find next motion node
        next_motion = None
        curr = node._next_ncCode
        while curr:
            # check if it's a motion block
            g_codes = [g.upper() for g in curr.g_code]
            if "G01" in g_codes or "G1" in g_codes or "G00" in g_codes or "G0" in g_codes:
                next_motion = curr
                break
            curr = curr._next_ncCode
            
        if not next_motion:
            # No next motion found, just execute as normal
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        # -------------------------------------------------------------
        # 1. Resolve Target Coordinates (P_start -> P_corner -> P_end)
        # -------------------------------------------------------------
        ax1, ax2 = self._get_active_plane_axes(state)
        
        start = state.axes.copy()
        start_1 = start.get(ax1, 0.0)
        start_2 = start.get(ax2, 0.0)

        # Get P_end (Target of next node, evaluated from arbitrary far start to get its line equation)
        # We need P_end FIRST to calculate intersection if Angle DDDP is used
        tmp_state = state.axes.copy()
        
        # We evaluate next_motion assuming it starts at start_1, start_2
        # If next is absolute, it will resolve correctly.
        abs_target_spec_2 = {}
        for k, v in next_motion.command_parameter.items():
            if k.upper() in ("X", "Y", "Z", "A", "B", "C"):
                abs_target_spec_2[k.upper()] = float(v)
                
        normalized_spec_2 = state.normalize_target_spec(abs_target_spec_2)
        target_2 = state.resolve_target(normalized_spec_2, absolute=True)
        end_1 = target_2.get(ax1, start_1)
        end_2 = target_2.get(ax2, start_2)

        # Get P_corner (End of current node, which becomes corner intersection)
        abs_target_spec_1 = {}
        for k, v in node.command_parameter.items():
            if k.upper() in ("X", "Y", "Z", "A", "B", "C"):
                abs_target_spec_1[k.upper()] = float(v)
        
        normalized_spec_1 = state.normalize_target_spec(abs_target_spec_1)
        target_1 = state.resolve_target(normalized_spec_1, absolute=True)
        corner_1 = target_1.get(ax1, start_1)
        corner_2 = target_1.get(ax2, start_2)

        # DDDP Angle explicit override of P_corner
        if angle_val is not None:
            # We have a starting angle. The current node might miss ax1 or ax2.
            # We must intersect the line (start_1, start_2) at angle_val 
            # with the next node's line.
            
            # Fanuc standard DDDP angles: 0 is +ax1, 90 is +ax2
            rad = math.radians(angle_val)
            v_dir_1 = math.cos(rad)
            v_dir_2 = math.sin(rad)
            
            has_1 = ax1 in normalized_spec_1
            has_2 = ax2 in normalized_spec_1
            
            if not has_2 and has_1:
                # We know ax1 = corner_1, solve for ax2 using the vector
                if abs(v_dir_1) > 1e-6:
                    t = (corner_1 - start_1) / v_dir_1
                    corner_2 = start_2 + t * v_dir_2
            elif not has_1 and has_2:
                # We know ax2 = corner_2, solve for ax1
                if abs(v_dir_2) > 1e-6:
                    t = (corner_2 - start_2) / v_dir_2
                    corner_1 = start_1 + t * v_dir_1
            elif not has_1 and not has_2:
                # Intersect with the NEXT block!
                has_next_1 = ax1 in normalized_spec_2
                has_next_2 = ax2 in normalized_spec_2
                
                if has_next_1 and not has_next_2:
                    if abs(v_dir_1) > 1e-6:
                        t = (end_1 - start_1) / v_dir_1
                        corner_1 = end_1
                        corner_2 = start_2 + t * v_dir_2
                elif has_next_2 and not has_next_1:
                    if abs(v_dir_2) > 1e-6:
                        t = (end_2 - start_2) / v_dir_2
                        corner_2 = end_2
                        corner_1 = start_1 + t * v_dir_1

        # Re-resolve P_end now that we have the exact true P_corner
        state.update_axes({ax1: corner_1, ax2: corner_2})
        target_2 = state.resolve_target(normalized_spec_2, absolute=True)
        end_1 = target_2.get(ax1, corner_1)
        end_2 = target_2.get(ax2, corner_2)
        
        # Restore state
        state.axes = tmp_state

        # -------------------------------------------------------------
        # 2. Vector Math for Intersection Offset calculation
        # -------------------------------------------------------------
        # Vector V1: Corner -> Start
        dx1, d2_1 = start_1 - corner_1, start_2 - corner_2
        len1 = math.hypot(dx1, d2_1)
        
        # Vector V2: Corner -> End
        dx2, d2_2 = end_1 - corner_1, end_2 - corner_2
        len2 = math.hypot(dx2, d2_2)

        # If zero length lines, geometry fails, cancel
        if len1 < 1e-6 or len2 < 1e-6:
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        v1x, v1y = dx1 / len1, d2_1 / len1
        v2x, v2y = dx2 / len2, d2_2 / len2

        # Dot product for angle between
        dot = v1x * v2x + v1y * v2y
        dot = max(-1.0, min(1.0, dot))  # Clamp
        theta = math.acos(dot)
        
        # Cross product to determine CW vs CCW
        cross = v1y * v2x - v1x * v2y
        cw = cross > 0  # if cross > 0, v2 is roughly to the right of v1. In standard Cartesian, CW is cross < 0.
        # Wait, typical mapping: if v1 crossed to v2 is negative -> CW arc required.
        # Let's keep typical convention (this assumes standard right hand Cartesian view)
        cw = cross < 0
        
        if theta < 1e-6 or abs(theta - math.pi) < 1e-6:
            # Parallel or collinear lines
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        # -------------------------------------------------------------
        # 3. Calculate New Points
        # -------------------------------------------------------------
        synthetic_node = NCCommandNode(nc_code_line_nr=node.nc_code_line_nr)
        
        if corner_type == "CORNER_R":
            R = abs(corner_val)
            tan_half = math.tan(theta / 2.0)
            
            # Distance from corner to arc start/end
            D = R / tan_half
            
            p_start_new_1 = corner_1 + D * v1x
            p_start_new_2 = corner_2 + D * v1y
            
            p_end_new_1 = corner_1 + D * v2x
            p_end_new_2 = corner_2 + D * v2y
            
            synthetic_node._g_code.add("G02" if cw else "G03")
            synthetic_node._command_parameter["R"] = str(R)
            
            ax1_diam_mult = 2.0 if state.get_axis_unit(ax1) == "diameter" else 1.0
            ax2_diam_mult = 2.0 if state.get_axis_unit(ax2) == "diameter" else 1.0
            
            synthetic_node._command_parameter[ax1] = str(round(p_end_new_1 * ax1_diam_mult, 4))
            synthetic_node._command_parameter[ax2] = str(round(p_end_new_2 * ax2_diam_mult, 4))
            
        else: # "CHAMFER"
            C = abs(corner_val)
            
            # Fanuc standard chamfer distance D along axis
            D = C / math.sin(theta / 2.0) 
            if abs(theta - math.pi / 2.0) < 1e-3:
                D = C  # Simple 90 deg axis distance
                
            p_start_new_1 = corner_1 + D * v1x
            p_start_new_2 = corner_2 + D * v1y
            
            p_end_new_1 = corner_1 + D * v2x
            p_end_new_2 = corner_2 + D * v2y
            
            synthetic_node._g_code.add("G01")
            
            ax1_diam_mult = 2.0 if state.get_axis_unit(ax1) == "diameter" else 1.0
            ax2_diam_mult = 2.0 if state.get_axis_unit(ax2) == "diameter" else 1.0
            synthetic_node._command_parameter[ax1] = str(round(p_end_new_1 * ax1_diam_mult, 4))
            synthetic_node._command_parameter[ax2] = str(round(p_end_new_2 * ax2_diam_mult, 4))

        # -------------------------------------------------------------
        # 4. Mutate the AST Linked List
        # -------------------------------------------------------------
        # Adjust the target of the 'current' line to stop early at the intersection
        ax1_diam_mult_curr = 2.0 if state.get_axis_unit(ax1) == "diameter" else 1.0
        ax2_diam_mult_curr = 2.0 if state.get_axis_unit(ax2) == "diameter" else 1.0
        node._command_parameter[ax1] = str(round(p_start_new_1 * ax1_diam_mult_curr, 4))
        node._command_parameter[ax2] = str(round(p_start_new_2 * ax2_diam_mult_curr, 4))
        
        ax1_diam_mult_next = 2.0 if state.get_axis_unit(ax1) == "diameter" else 1.0
        ax2_diam_mult_next = 2.0 if state.get_axis_unit(ax2) == "diameter" else 1.0
        next_motion._command_parameter[ax1] = str(round(end_1 * ax1_diam_mult_next, 4))
        next_motion._command_parameter[ax2] = str(round(end_2 * ax2_diam_mult_next, 4))
        next_motion.command_parameter.pop("U", None)
        next_motion.command_parameter.pop("W", None)

        # Link the synthetic node into the chain
        synthetic_node._next_ncCode = node._next_ncCode
        if synthetic_node._next_ncCode:
            synthetic_node._next_ncCode._before_ncCode = synthetic_node
            
        node._next_ncCode = synthetic_node
        synthetic_node._before_ncCode = node

        # Delegate execution
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
