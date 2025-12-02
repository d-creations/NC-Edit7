"""Handler for Siemens ISO Milling Cycles (G81-G89, etc.)."""
from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.point import Point


class SiemensISOCyclesHandler(Handler):
    """Handle G81-G89 Drilling/Boring Cycles.

    Expands cycles into a sequence of motions:
    1. Rapid to XY location (if provided).
    2. Rapid to R plane.
    3. Feed to Z depth.
    4. Dwell/Spindle ops (simulated as duration).
    5. Retract to R plane or Initial plane (G98/G99).
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # 1. Check for G98/G99 (Return Mode)
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum == 98:
                        state.extra["cycle_return_mode"] = 98
                    elif gnum == 99:
                        state.extra["cycle_return_mode"] = 99
            except Exception:
                continue

        # 2. Check for Cycle Codes (Activation/Cancellation)
        cycle_code = None
        is_cycle_definition = False
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if 73 <= gnum <= 89 and gnum != 80:
                        cycle_code = gnum
                        is_cycle_definition = True
                    elif gnum == 80:
                        # Cancel cycle
                        state.extra["active_cycle"] = None
                        state.extra["cycle_initial_z"] = None
            except Exception:
                continue

        if cycle_code:
            state.extra["active_cycle"] = cycle_code
            # If defining a new cycle, capture the current Z as initial Z (if not already set or if reset)
            # Actually, G98 returns to the Z level present *before* the cycle operation starts.
            # If we are defining it, the current Z is the initial level.
            state.extra["cycle_initial_z"] = state.axes.get("Z", 0.0)

        # 3. Update Cycle Parameters (R, Z, F, etc.)
        # These are modal in the sense that once set in a cycle def, they persist?
        # Usually R and Z are required in the definition.
        if "R" in node.command_parameter:
            state.extra["cycle_r"] = float(node.command_parameter["R"])
        if "Z" in node.command_parameter:
            state.extra["cycle_z"] = float(node.command_parameter["Z"])
        if "F" in node.command_parameter:
            # F is handled by state.feed_rate usually, but we ensure it's updated
            try:
                state.feed_rate = float(node.command_parameter["F"])
            except Exception:
                pass
        
        # 4. Determine if we should execute the cycle
        # Execute if:
        # - A cycle is active (or just defined)
        # - AND (We have X/Y motion OR it is the definition block)
        # Note: Some controls repeat cycle if just X/Y given.
        # If G80 was just called, we do NOT execute.
        
        active_cycle = state.extra.get("active_cycle")
        if not active_cycle:
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        has_motion = "X" in node.command_parameter or "Y" in node.command_parameter
        should_execute = is_cycle_definition or has_motion

        if not should_execute:
            # Just parameter update or non-motion block
            if self.next_handler is not None:
                return self.next_handler.handle(node, state)
            return None, None

        # --- Execute Cycle ---
        points: List[Point] = []
        total_duration = 0.0

        # A. Move to XY (Rapid)
        # We need to resolve the target XY.
        # Use state.resolve_target but only for X and Y.
        target_xy = {}
        if "X" in node.command_parameter:
            target_xy["X"] = float(node.command_parameter["X"])
        if "Y" in node.command_parameter:
            target_xy["Y"] = float(node.command_parameter["Y"])
        
        # Resolve absolute/incremental
        # We need to know if G90/G91 is active.
        # This is usually handled by MotionHandler or we check state.
        # Let's assume we can check state modal.
        is_inc = state.get_modal("distance") == "G91"
        
        # Current Pos
        start_x = state.axes.get("X", 0.0)
        start_y = state.axes.get("Y", 0.0)
        start_z = state.axes.get("Z", 0.0) # This is Initial Z for this move

        # Calculate Target XY
        if is_inc:
            dest_x = start_x + target_xy.get("X", 0.0)
            dest_y = start_y + target_xy.get("Y", 0.0)
        else:
            dest_x = target_xy.get("X", start_x)
            dest_y = target_xy.get("Y", start_y)

        # Generate XY Motion (Rapid)
        # Simplified: just add end point. In real implementation, interpolate.
        # We'll just add the point.
        points.append(Point(x=dest_x, y=dest_y, z=start_z))
        # Update state
        state.axes["X"] = dest_x
        state.axes["Y"] = dest_y

        # B. Rapid to R Plane
        r_level = state.extra.get("cycle_r", start_z) # Default to current if not set?
        # Note: R is usually absolute in G90, or incremental from Initial Z in G91?
        # Fanuc/Siemens ISO: G90 -> R is absolute Z. G91 -> R is distance from Initial Z.
        if is_inc:
            r_abs = start_z + r_level
        else:
            r_abs = r_level
        
        points.append(Point(x=dest_x, y=dest_y, z=r_abs))
        state.axes["Z"] = r_abs

        # C. Feed to Z Depth
        z_param = state.extra.get("cycle_z", r_abs)
        if is_inc:
            z_bottom = r_abs + z_param # In G91, Z is distance from R level
        else:
            z_bottom = z_param
        
        # Feed motion
        # Calculate duration based on feed
        dist = abs(z_bottom - r_abs)
        feed = state.feed_rate or 100.0
        # Assuming mm/min for simplicity, convert to sec
        duration = (dist / feed) * 60.0 if feed > 0 else 0.0
        total_duration += duration

        points.append(Point(x=dest_x, y=dest_y, z=z_bottom))
        state.axes["Z"] = z_bottom

        # D. Dwell (if G82/G89) - Not implemented yet, just placeholder
        
        # E. Retract
        # G98 -> Return to Initial Z (start_z)
        # G99 -> Return to R level (r_abs)
        return_mode = state.extra.get("cycle_return_mode", 98)
        
        retract_z = start_z if return_mode == 98 else r_abs
        
        points.append(Point(x=dest_x, y=dest_y, z=retract_z))
        state.axes["Z"] = retract_z

        return points, total_duration
