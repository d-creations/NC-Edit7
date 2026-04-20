"""Handler for Siemens ISO Milling Cycles (G81-G89) and Named Cycles (CYCLE81, etc.)."""
from __future__ import annotations

import re
import math
from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.point import Point


class SiemensNamedCyclesHandler(Handler):
    """Handle Siemens Named Cycles (CYCLE81, HOLES1, etc.)."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        cmd = node.variable_command
        
        is_modal_def = False
        cycle_call_params = None
        cycle_call_name = None

        if cmd:
            if "MCALL" in cmd:
                is_modal_def = True
                cmd = cmd.replace("MCALL", "").strip()
                if not cmd:
                    state.extra["active_named_cycle"] = None
            
            match = re.search(r"(CYCLE\d+|HOLES\d+|POCKET\d+|SLOT\d+|LONGHOLE)\s*\((.*)\)", cmd, re.IGNORECASE)
            if match:
                cycle_call_name = match.group(1).upper()
                params_str = match.group(2)
                cycle_call_params = [p.strip() for p in params_str.split(',')]

        if is_modal_def and cycle_call_name:
            state.extra["active_named_cycle"] = {
                "name": cycle_call_name,
                "params": cycle_call_params
            }
        
        target_cycle_name = None
        target_cycle_params = None
        
        if cycle_call_name:
            if not is_modal_def:
                target_cycle_name = cycle_call_name
                target_cycle_params = cycle_call_params
            else:
                # MCALL definition. Execute only if motion is present.
                has_motion = "X" in node.command_parameter or "Y" in node.command_parameter
                if has_motion:
                    target_cycle_name = cycle_call_name
                    target_cycle_params = cycle_call_params
        elif state.extra.get("active_named_cycle"):
            has_motion = "X" in node.command_parameter or "Y" in node.command_parameter
            if has_motion:
                target_cycle_name = state.extra["active_named_cycle"]["name"]
                target_cycle_params = state.extra["active_named_cycle"]["params"]

        if target_cycle_name:
            points = []
            if "X" in node.command_parameter or "Y" in node.command_parameter:
                dest_x = float(node.command_parameter.get("X", state.axes.get("X", 0.0)))
                dest_y = float(node.command_parameter.get("Y", state.axes.get("Y", 0.0)))
                points.append(Point(x=dest_x, y=dest_y, z=state.axes.get("Z", 0.0)))
                state.axes["X"] = dest_x
                state.axes["Y"] = dest_y

            method_name = f"handle_{target_cycle_name.lower()}"
            if hasattr(self, method_name):
                cycle_points, duration = getattr(self, method_name)(target_cycle_params, state)
                if cycle_points:
                    points.extend(cycle_points)
                return points, duration
            
        if self.next_handler:
            return self.next_handler.handle(node, state)
        return None, None

    def _parse_float(self, val: str, default: float = 0.0) -> float:
        if not val:
            return default
        try:
            return float(val)
        except ValueError:
            return default

    def handle_cycle81(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        rtp = self._parse_float(params[0]) if len(params) > 0 else 0.0
        rfp = self._parse_float(params[1]) if len(params) > 1 else 0.0
        sdis = self._parse_float(params[2]) if len(params) > 2 else 0.0
        dp = self._parse_float(params[3]) if len(params) > 3 else None
        dpr = self._parse_float(params[4]) if len(params) > 4 else None
        
        current_x = state.axes.get("X", 0.0)
        current_y = state.axes.get("Y", 0.0)
        
        final_z = 0.0
        if dp is not None and params[3]:
             final_z = dp
        elif dpr is not None:
             final_z = rfp - abs(dpr)
        else:
             final_z = rfp
             
        points = []
        start_z = rfp + abs(sdis)
        points.append(Point(x=current_x, y=current_y, z=start_z))
        points.append(Point(x=current_x, y=current_y, z=final_z))
        points.append(Point(x=current_x, y=current_y, z=rtp))
        state.axes["Z"] = rtp
        return points, 0.0

    def handle_cycle82(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        return self.handle_cycle81(params, state)

    def handle_holes1(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        spca = self._parse_float(params[0])
        spco = self._parse_float(params[1])
        sta1 = self._parse_float(params[2])
        fdis = self._parse_float(params[3])
        dbh = self._parse_float(params[4])
        num = int(self._parse_float(params[5]))
        
        active_cycle = state.extra.get("active_named_cycle")
        if not active_cycle:
            print("HOLES1: No active cycle")
            return [], 0.0
            
        cycle_name = active_cycle["name"]
        cycle_params = active_cycle["params"]
        method_name = f"handle_{cycle_name.lower()}"
        
        if not hasattr(self, method_name):
            print(f"HOLES1: Unknown cycle {cycle_name}")
            return [], 0.0
            
        points = []
        rad = math.radians(sta1)
        dx = math.cos(rad)
        dy = math.sin(rad)
        
        print(f"HOLES1: num={num}, cycle={cycle_name}")
        for i in range(num):
            dist = fdis + i * dbh
            x = spca + dist * dx
            y = spco + dist * dy
            points.append(Point(x=x, y=y, z=state.axes.get("Z", 0.0)))
            state.axes["X"] = x
            state.axes["Y"] = y
            p, d = getattr(self, method_name)(cycle_params, state)
            if p:
                points.extend(p)
        return points, 0.0

    def handle_holes2(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        cpa = self._parse_float(params[0])
        cpo = self._parse_float(params[1])
        rad = self._parse_float(params[2])
        sta1 = self._parse_float(params[3])
        inda = self._parse_float(params[4])
        num = int(self._parse_float(params[5]))
        
        active_cycle = state.extra.get("active_named_cycle")
        if not active_cycle:
            return [], 0.0
            
        cycle_name = active_cycle["name"]
        cycle_params = active_cycle["params"]
        method_name = f"handle_{cycle_name.lower()}"
        
        if not hasattr(self, method_name):
            return [], 0.0
            
        points = []
        for i in range(num):
            angle = sta1 + i * inda
            angle_rad = math.radians(angle)
            x = cpa + rad * math.cos(angle_rad)
            y = cpo + rad * math.sin(angle_rad)
            points.append(Point(x=x, y=y, z=state.axes.get("Z", 0.0)))
            state.axes["X"] = x
            state.axes["Y"] = y
            p, d = getattr(self, method_name)(cycle_params, state)
            if p:
                points.extend(p)
        return points, 0.0

    # --- Drilling Cycles ---
    def handle_cycle83(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE83(RTP, RFP, SDIS, DP, DPR, FDEP, FDPR, DAM, DTB, DTS, FRF, VARI)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        # We ignore pecking details for now and just drill to depth
        
        current_x = state.axes.get("X", 0.0)
        current_y = state.axes.get("Y", 0.0)
        
        final_z = 0.0
        if dp is not None:
             final_z = dp
        elif dpr is not None:
             final_z = rfp - abs(dpr)
        else:
             final_z = rfp
             
        points = []
        start_z = rfp + abs(sdis)
        points.append(Point(x=current_x, y=current_y, z=start_z))
        
        # Simulate pecking (simplified: 3 steps if deep)
        depth = start_z - final_z
        if depth > 10:
            points.append(Point(x=current_x, y=current_y, z=start_z - depth/3))
            points.append(Point(x=current_x, y=current_y, z=start_z + 1)) # Retract slightly
            points.append(Point(x=current_x, y=current_y, z=start_z - 2*depth/3))
            points.append(Point(x=current_x, y=current_y, z=start_z + 1))
            
        points.append(Point(x=current_x, y=current_y, z=final_z))
        points.append(Point(x=current_x, y=current_y, z=rtp))
        state.axes["Z"] = rtp
        return points, 0.0

    def handle_cycle84(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Rigid Tapping
        return self.handle_cycle81(params, state)

    def handle_cycle840(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Tapping with compensating chuck
        return self.handle_cycle81(params, state)

    def handle_cycle85(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Boring 1
        return self.handle_cycle81(params, state)

    def handle_cycle86(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Boring 2
        return self.handle_cycle81(params, state)

    def handle_cycle87(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Boring 3
        return self.handle_cycle81(params, state)

    def handle_cycle88(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Boring 4
        return self.handle_cycle81(params, state)

    def handle_cycle89(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Boring 5
        return self.handle_cycle81(params, state)
    def handle_cycle801(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE801(SPCA, SPCO, STA1, DIS1, DIS2, NUM1, NUM2)
        spca = self._parse_float(params[0])
        spco = self._parse_float(params[1])
        sta1 = self._parse_float(params[2])
        dis1 = self._parse_float(params[3])
        dis2 = self._parse_float(params[4])
        num1 = int(self._parse_float(params[5]))
        num2 = int(self._parse_float(params[6]))
        
        active_cycle = state.extra.get("active_named_cycle")
        if not active_cycle:
            return [], 0.0
            
        cycle_name = active_cycle["name"]
        cycle_params = active_cycle["params"]
        method_name = f"handle_{cycle_name.lower()}"
        
        if not hasattr(self, method_name):
            return [], 0.0
            
        points = []
        rad = math.radians(sta1)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        
        for i in range(num1):
            for j in range(num2):
                lx = i * dis1
                ly = j * dis2
                x = spca + lx * cos_a - ly * sin_a
                y = spco + lx * sin_a + ly * cos_a
                
                points.append(Point(x=x, y=y, z=state.axes.get("Z", 0.0)))
                state.axes["X"] = x
                state.axes["Y"] = y
                
                p, d = getattr(self, method_name)(cycle_params, state)
                if p:
                    points.extend(p)
        return points, 0.0

    def handle_slot1(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # SLOT1(RTP, RFP, SDIS, DP, DPR, NUM, LENG, WID, CPA, CPO, RAD, STA1, INDA, ...)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        num = int(self._parse_float(params[5]))
        leng = self._parse_float(params[6])
        wid = self._parse_float(params[7])
        cpa = self._parse_float(params[8])
        cpo = self._parse_float(params[9])
        rad_val = self._parse_float(params[10])
        sta1 = self._parse_float(params[11])
        inda = self._parse_float(params[12])

        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        
        for i in range(num):
            angle = sta1 + i * inda
            angle_rad = math.radians(angle)
            cx = cpa + rad_val * math.cos(angle_rad)
            cy = cpo + rad_val * math.sin(angle_rad)
            
            # Slot orientation: Radial? Or Tangential?
            # Usually slots on circle are radial or defined by angle.
            # Manual says: "Longitudinal axis of slot is aligned radially" usually.
            # Let's assume radial alignment for now.
            slot_angle = angle_rad
            
            # Calculate slot start/end points (center line)
            dx = (leng / 2.0) * math.cos(slot_angle)
            dy = (leng / 2.0) * math.sin(slot_angle)
            
            p1x, p1y = cx - dx, cy - dy
            p2x, p2y = cx + dx, cy + dy
            
            # Move to Center (Rapid)
            points.append(Point(x=cx, y=cy, z=state.axes.get("Z", 0.0)))
            points.append(Point(x=cx, y=cy, z=start_z))
            
            # Feed to Depth
            points.append(Point(x=cx, y=cy, z=final_z))
            
            # Mill Slot (Centerline)
            points.append(Point(x=p1x, y=p1y, z=final_z))
            points.append(Point(x=p2x, y=p2y, z=final_z))
            
            # Retract
            points.append(Point(x=p2x, y=p2y, z=rtp))
            
            state.axes["X"] = p2x
            state.axes["Y"] = p2y
            state.axes["Z"] = rtp
            
        return points, 0.0

    def handle_pocket1(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # POCKET1(RTP, RFP, SDIS, DP, DPR, LENG, WID, CRAD, CPA, CPO, STA1, ...)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        leng = self._parse_float(params[5])
        wid = self._parse_float(params[6])
        crad = self._parse_float(params[7])
        cpa = self._parse_float(params[8])
        cpo = self._parse_float(params[9])
        sta1 = self._parse_float(params[10])

        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        
        # Move to Center
        points.append(Point(x=cpa, y=cpo, z=state.axes.get("Z", 0.0)))
        points.append(Point(x=cpa, y=cpo, z=start_z))
        points.append(Point(x=cpa, y=cpo, z=final_z))
        
        # Draw Rectangle (Outline)
        # Rotate corners by STA1
        ang_rad = math.radians(sta1)
        cos_a = math.cos(ang_rad)
        sin_a = math.sin(ang_rad)
        
        w2 = wid / 2.0
        l2 = leng / 2.0
        
        corners = [
            (-l2, -w2), (l2, -w2), (l2, w2), (-l2, w2), (-l2, -w2)
        ]
        
        for cx, cy in corners:
            rx = cpa + cx * cos_a - cy * sin_a
            ry = cpo + cx * sin_a + cy * cos_a
            points.append(Point(x=rx, y=ry, z=final_z))
            
        # Retract
        points.append(Point(x=points[-1].x, y=points[-1].y, z=rtp))
        state.axes["Z"] = rtp
        
        return points, 0.0

    def handle_pocket2(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # POCKET2(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, ...)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        prad = self._parse_float(params[5])
        cpa = self._parse_float(params[6])
        cpo = self._parse_float(params[7])

        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        
        # Move to Center
        points.append(Point(x=cpa, y=cpo, z=state.axes.get("Z", 0.0)))
        points.append(Point(x=cpa, y=cpo, z=start_z))
        points.append(Point(x=cpa, y=cpo, z=final_z))
        
        # Draw Circle (Approximation)
        # Adaptive steps based on radius and desired segment length (e.g. 0.1mm for high res)
        segment_len = 0.1
        circumference = 2 * math.pi * prad
        steps = max(72, int(circumference / segment_len))
        
        # print(f"DEBUG: POCKET2/4 Radius={prad}, Steps={steps}")

        for i in range(steps + 1):
            ang = (i / steps) * 2 * math.pi
            x = cpa + prad * math.cos(ang)
            y = cpo + prad * math.sin(ang)
            points.append(Point(x=x, y=y, z=final_z))
            
        # Retract
        points.append(Point(x=points[-1].x, y=points[-1].y, z=rtp))
        state.axes["Z"] = rtp
        
        return points, 0.0

    def handle_slot2(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # SLOT2(RTP, RFP, SDIS, DP, DPR, NUM, AFSL, WID, CPA, CPO, RAD, STA1, INDA)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        num = int(self._parse_float(params[5]))
        afsl = self._parse_float(params[6])
        wid = self._parse_float(params[7])
        cpa = self._parse_float(params[8])
        cpo = self._parse_float(params[9])
        rad_val = self._parse_float(params[10])
        sta1 = self._parse_float(params[11])
        inda = self._parse_float(params[12])

        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        
        for i in range(num):
            start_angle = sta1 + i * inda
            end_angle = start_angle + afsl
            
            # Arc center is (cpa, cpo)
            # Start point on arc
            sa_rad = math.radians(start_angle)
            sx = cpa + rad_val * math.cos(sa_rad)
            sy = cpo + rad_val * math.sin(sa_rad)
            
            # End point on arc
            ea_rad = math.radians(end_angle)
            ex = cpa + rad_val * math.cos(ea_rad)
            ey = cpo + rad_val * math.sin(ea_rad)
            
            # Move to Start (Rapid)
            points.append(Point(x=sx, y=sy, z=state.axes.get("Z", 0.0)))
            points.append(Point(x=sx, y=sy, z=start_z))
            
            # Feed to Depth
            points.append(Point(x=sx, y=sy, z=final_z))
            
            # Mill Arc
            # We can approximate arc with points
            # Adaptive steps
            arc_len = (abs(afsl) / 360.0) * 2 * math.pi * rad_val
            segment_len = 0.1
            steps = max(36, int(arc_len / segment_len))
            
            for k in range(1, steps + 1):
                a = start_angle + (afsl * k / steps)
                a_rad = math.radians(a)
                ax = cpa + rad_val * math.cos(a_rad)
                ay = cpo + rad_val * math.sin(a_rad)
                points.append(Point(x=ax, y=ay, z=final_z))
            
            # Retract
            points.append(Point(x=ex, y=ey, z=rtp))
            
            state.axes["X"] = ex
            state.axes["Y"] = ey
            state.axes["Z"] = rtp
            
        return points, 0.0

    def handle_longhole(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # LONGHOLE(RTP, RFP, SDIS, DP, DPR, NUM, LENG, CPA, CPO, RAD, STA1, INDA)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        num = int(self._parse_float(params[5]))
        leng = self._parse_float(params[6])
        cpa = self._parse_float(params[7])
        cpo = self._parse_float(params[8])
        rad_val = self._parse_float(params[9])
        sta1 = self._parse_float(params[10])
        inda = self._parse_float(params[11])

        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        
        for i in range(num):
            angle = sta1 + i * inda
            angle_rad = math.radians(angle)
            cx = cpa + rad_val * math.cos(angle_rad)
            cy = cpo + rad_val * math.sin(angle_rad)
            
            # Longhole is like a slot but maybe just drilled multiple times or milled?
            # Manual: "Elongated hole". Usually milled.
            # Assume radial alignment like SLOT1.
            
            dx = (leng / 2.0) * math.cos(angle_rad)
            dy = (leng / 2.0) * math.sin(angle_rad)
            
            p1x, p1y = cx - dx, cy - dy
            p2x, p2y = cx + dx, cy + dy
            
            # Move to Center (Rapid)
            points.append(Point(x=cx, y=cy, z=state.axes.get("Z", 0.0)))
            points.append(Point(x=cx, y=cy, z=start_z))
            
            # Feed to Depth
            points.append(Point(x=cx, y=cy, z=final_z))
            
            # Mill (Centerline)
            points.append(Point(x=p1x, y=p1y, z=final_z))
            points.append(Point(x=p2x, y=p2y, z=final_z))
            
            # Retract
            points.append(Point(x=p2x, y=p2y, z=rtp))
            
            state.axes["X"] = p2x
            state.axes["Y"] = p2y
            state.axes["Z"] = rtp
            
        return points, 0.0

    def handle_cycle61(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE61 appears to be Face Milling, similar to CYCLE71
        return self.handle_cycle71(params, state)

    def handle_cycle71(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE71(RTP, RFP, SDIS, DP, PA, PO, LENG, WID, STA, ...)
        # Face milling
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3])
        pa = self._parse_float(params[4])
        po = self._parse_float(params[5])
        leng = self._parse_float(params[6])
        wid = self._parse_float(params[7])
        sta = self._parse_float(params[8])
        
        points = []
        start_z = rfp + abs(sdis)
        
        # Move to Start
        points.append(Point(x=pa, y=po, z=state.axes.get("Z", 0.0)))
        points.append(Point(x=pa, y=po, z=start_z))
        points.append(Point(x=pa, y=po, z=dp))
        
        # Face mill area (Zigzag approximation)
        # Rotate corners
        ang_rad = math.radians(sta)
        cos_a = math.cos(ang_rad)
        sin_a = math.sin(ang_rad)
        
        # Simple zigzag: 4 lines
        for i in range(5):
            y_offset = (i / 4.0) * wid
            x_start = 0
            x_end = leng
            
            if i % 2 == 1:
                x_start, x_end = x_end, x_start
                
            p1x = pa + x_start * cos_a - y_offset * sin_a
            p1y = po + x_start * sin_a + y_offset * cos_a
            
            p2x = pa + x_end * cos_a - y_offset * sin_a
            p2y = po + x_end * sin_a + y_offset * cos_a
            
            points.append(Point(x=p1x, y=p1y, z=dp))
            points.append(Point(x=p2x, y=p2y, z=dp))
            
        # Retract
        points.append(Point(x=points[-1].x, y=points[-1].y, z=rtp))
        state.axes["Z"] = rtp
        return points, 0.0

    def handle_cycle72(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Contour milling - requires contour definition which is complex to resolve here.
        # We just move to retract plane.
        return [], 0.0

    def handle_cycle76(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE76(RTP, RFP, SDIS, DP, DPR, LENG, WID, CRAD, CPA, CPO, STA1, ...)
        # Rectangular spigot - similar to POCKET1 but external
        # We reuse POCKET1 logic but maybe add a comment or slight offset if we were precise.
        # For plotting, the outline is the same.
        return self.handle_pocket1(params, state)

    def handle_cycle77(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE77(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, ...)
        # Circular spigot - similar to POCKET2
        return self.handle_pocket2(params, state)

    def handle_cycle73(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Pocket with islands
        return [], 0.0

    def handle_cycle74(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Transfer pocket edge contour
        return [], 0.0

    def handle_cycle75(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Transfer island contour
        return [], 0.0

    def handle_cycle90(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE90(RTP, RFP, SDIS, DP, DPR, DIATH, KDIAM, PIT, FFR, CDIR, TYTH, CPA, CPO)
        # Thread milling
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3])
        diath = self._parse_float(params[5])
        pit = self._parse_float(params[7])
        cpa = self._parse_float(params[11])
        cpo = self._parse_float(params[12])
        
        points = []
        start_z = rfp + abs(sdis)
        
        # Move to Center
        points.append(Point(x=cpa, y=cpo, z=state.axes.get("Z", 0.0)))
        points.append(Point(x=cpa, y=cpo, z=start_z))
        
        # Helical interpolation down to DP
        radius = diath / 2.0
        current_z = start_z
        angle = 0.0
        
        while current_z > dp:
            angle += 0.5 # radians step
            current_z -= (pit * 0.5 / (2 * math.pi))
            if current_z < dp: current_z = dp
            
            x = cpa + radius * math.cos(angle)
            y = cpo + radius * math.sin(angle)
            points.append(Point(x=x, y=y, z=current_z))
            
        # Retract
        points.append(Point(x=cpa, y=cpo, z=rtp))
        state.axes["Z"] = rtp
        return points, 0.0

    def handle_cycle800(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # CYCLE800(FR, TC, ST, MODE, X0, Y0, Z0, A, B, C, X1, Y1, Z1, DIR)
        # Swiveling cycle.
        # In a full implementation, this would update the coordinate system frame.
        # For this plotter, we acknowledge the command but do not rotate the view yet.
        
        try:
            # Parse rotation angles (indices 7, 8, 9)
            # Note: params might have empty strings for missing args
            rot_a = self._parse_float(params[7]) if len(params) > 7 else 0.0
            rot_b = self._parse_float(params[8]) if len(params) > 8 else 0.0
            rot_c = self._parse_float(params[9]) if len(params) > 9 else 0.0
            
            # Store in state for potential future use or by other handlers
            state.extra["rotation"] = {"A": rot_a, "B": rot_b, "C": rot_c}
            
            # We might also need translation (X0, Y0, Z0) - indices 4, 5, 6
            trans_x = self._parse_float(params[4]) if len(params) > 4 else 0.0
            trans_y = self._parse_float(params[5]) if len(params) > 5 else 0.0
            trans_z = self._parse_float(params[6]) if len(params) > 6 else 0.0
            state.extra["rotation_origin"] = {"X": trans_x, "Y": trans_y, "Z": trans_z}
            
        except Exception as e:
            # Log error but don't crash
            pass

        return [], 0.0

    def handle_cycle832(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # High speed settings
        return [], 0.0

    def handle_cycle60(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # Engraving
        return [], 0.0

    def handle_pocket3(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # POCKET3(RTP, RFP, SDIS, DP, DPR, LENG, WID, CRAD, CPA, CPO, STA1, FALD, FALW, MID, FAL, FF1, FF2, CDIR, VARI, MIDA, AP1, AP2, AD, RAD1, DP1)
        # Rectangular pocket with any tool
        # We can reuse POCKET1 logic for the outline
        return self.handle_pocket1(params, state)

    def handle_pocket4(self, params: List[str], state: CNCState) -> Tuple[List[Point], float]:
        # POCKET4(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, FALD, FALW, MID, FAL, FFD, FFP1, VARI, MIDA, ...)
        rtp = self._parse_float(params[0])
        rfp = self._parse_float(params[1])
        sdis = self._parse_float(params[2])
        dp = self._parse_float(params[3]) if len(params) > 3 and params[3] else None
        dpr = self._parse_float(params[4]) if len(params) > 4 and params[4] else None
        prad = self._parse_float(params[5])
        cpa = self._parse_float(params[6])
        cpo = self._parse_float(params[7])
        
        # Try to parse MIDA (index 16) - Wait, standard is 15. Let's check both or stick to one.
        # Based on standard: 15 is MIDA.
        # But let's keep the logic flexible or check what I did before.
        # I'll read index 15 first, if it looks like MIDA.
        
        mida = 0.0
        if len(params) > 15:
             mida = self._parse_float(params[15])
        
        # If MIDA is 0 or missing, default to something reasonable (e.g. 50% of radius)
        if mida <= 0:
            mida = prad / 2.0
            
        # Handle case where PRAD is 0 (e.g. helical drilling or defined by other params)
        # If PRAD is 0, check RAD1 (index 20)
        if prad == 0 and len(params) > 20:
            prad = self._parse_float(params[20])
            
        final_z = dp if dp is not None else (rfp - abs(dpr) if dpr is not None else rfp)
        start_z = rfp + abs(sdis)
        
        points = []
        duration = 0.0
        # Ensure non-zero feed rate to avoid division by zero
        current_feed = state.feed_rate if state.feed_rate is not None else 0.0
        feed_rate = current_feed if current_feed > 0 else 1000.0
        
        ffd = self._parse_float(params[12]) if len(params) > 12 else 0.0
        ffp1 = self._parse_float(params[13]) if len(params) > 13 else 0.0
        
        plunge_feed = ffd if ffd > 0 else feed_rate
        machining_feed = ffp1 if ffp1 > 0 else feed_rate
        
        # Move to Center
        points.append(Point(x=cpa, y=cpo, z=state.axes.get("Z", 0.0)))
        points.append(Point(x=cpa, y=cpo, z=start_z))
        
        # Feed to Depth
        points.append(Point(x=cpa, y=cpo, z=final_z))
        dist_plunge = abs(start_z - final_z)
        duration += (dist_plunge / plunge_feed) * 60.0
        
        last_x, last_y = cpa, cpo
        
        # Generate concentric circles (clearing)
        # If prad is still 0, we can't draw a circle, so just stay at center (drill)
        if prad > 0:
            current_rad = 0.0
            while current_rad < prad:
                current_rad += mida
                if current_rad > prad:
                    current_rad = prad
                
                # Adaptive steps
                segment_len = 0.1
                circumference = 2 * math.pi * current_rad
                steps = max(36, int(circumference / segment_len))
                
                # Move to start of circle (0 degrees)
                start_x = cpa + current_rad
                start_y = cpo
                points.append(Point(x=start_x, y=start_y, z=final_z))
                
                # Add distance from previous point to start of circle
                dist = math.hypot(start_x - last_x, start_y - last_y)
                duration += (dist / machining_feed) * 60.0
                last_x, last_y = start_x, start_y

                for i in range(1, steps + 1):
                    ang = (i / steps) * 2 * math.pi
                    x = cpa + current_rad * math.cos(ang)
                    y = cpo + current_rad * math.sin(ang)
                    points.append(Point(x=x, y=y, z=final_z))
                    
                    dist = math.hypot(x - last_x, y - last_y)
                    duration += (dist / machining_feed) * 60.0
                    last_x, last_y = x, y
                    
                if current_rad >= prad:
                    break
                
        # Retract
        points.append(Point(x=points[-1].x, y=points[-1].y, z=rtp))
        state.axes["Z"] = rtp
        
        return points, duration


class SiemensISOCyclesHandler(Handler):
    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        for g in node.g_code:
            if not isinstance(g, str): continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum == 98: state.extra["cycle_return_mode"] = 98
                    elif gnum == 99: state.extra["cycle_return_mode"] = 99
            except Exception: continue

        cycle_code = None
        is_cycle_definition = False
        for g in node.g_code:
            if not isinstance(g, str): continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if 73 <= gnum <= 89 and gnum != 80:
                        cycle_code = gnum
                        is_cycle_definition = True
                    elif gnum == 80:
                        state.extra["active_cycle"] = None
                        state.extra["cycle_initial_z"] = None
            except Exception: continue

        if cycle_code:
            state.extra["active_cycle"] = cycle_code
            state.extra["cycle_initial_z"] = state.axes.get("Z", 0.0)

        if "R" in node.command_parameter: state.extra["cycle_r"] = float(node.command_parameter["R"])
        if "Z" in node.command_parameter: state.extra["cycle_z"] = float(node.command_parameter["Z"])
        if "F" in node.command_parameter:
            try: state.feed_rate = float(node.command_parameter["F"])
            except Exception: pass
        
        active_cycle = state.extra.get("active_cycle")
        if not active_cycle:
            if self.next_handler is not None: return self.next_handler.handle(node, state)
            return None, None

        has_motion = "X" in node.command_parameter or "Y" in node.command_parameter
        should_execute = is_cycle_definition or has_motion

        if not should_execute:
            if self.next_handler is not None: return self.next_handler.handle(node, state)
            return None, None

        points: List[Point] = []
        total_duration = 0.0

        target_xy = {}
        if "X" in node.command_parameter: target_xy["X"] = float(node.command_parameter["X"])
        if "Y" in node.command_parameter: target_xy["Y"] = float(node.command_parameter["Y"])
        
        is_inc = state.get_modal("distance") == "G91"
        start_x = state.axes.get("X", 0.0)
        start_y = state.axes.get("Y", 0.0)
        start_z = state.axes.get("Z", 0.0)

        if is_inc:
            dest_x = start_x + target_xy.get("X", 0.0)
            dest_y = start_y + target_xy.get("Y", 0.0)
        else:
            dest_x = target_xy.get("X", start_x)
            dest_y = target_xy.get("Y", start_y)

        points.append(Point(x=dest_x, y=dest_y, z=start_z))
        state.axes["X"] = dest_x
        state.axes["Y"] = dest_y

        r_level = state.extra.get("cycle_r", start_z)
        if is_inc: r_abs = start_z + r_level
        else: r_abs = r_level
        
        points.append(Point(x=dest_x, y=dest_y, z=r_abs))
        state.axes["Z"] = r_abs

        z_param = state.extra.get("cycle_z", r_abs)
        if is_inc: z_bottom = r_abs + z_param
        else: z_bottom = z_param
        
        dist = abs(z_bottom - r_abs)
        feed = state.feed_rate or 100.0
        duration = (dist / feed) * 60.0 if feed > 0 else 0.0
        total_duration += duration

        points.append(Point(x=dest_x, y=dest_y, z=z_bottom))
        state.axes["Z"] = z_bottom

        return_mode = state.extra.get("cycle_return_mode", 98)
        retract_z = start_z if return_mode == 98 else r_abs
        
        points.append(Point(x=dest_x, y=dest_y, z=retract_z))
        state.axes["Z"] = retract_z

        return points, total_duration
