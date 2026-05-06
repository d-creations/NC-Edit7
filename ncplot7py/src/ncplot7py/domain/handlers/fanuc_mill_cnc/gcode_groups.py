from __future__ import annotations
from typing import Optional, Tuple, List
from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps

# Fanuc Mill G-Code Groups based on user specification
FANUC_MILL_GCODE_GROUPS = {
    "G00": 1, "G01": 1, "G02": 1, "G03": 1,
    "G02.1": 1, "G03.1": 1, "G02.2": 1, "G03.2": 1,
    "G02.3": 1, "G03.3": 1, "G02.4": 1, "G03.4": 1,
    "G33": 1, "G34": 1, "G35": 1, "G36": 1,
    "G06.2": 1, "G73": 1, "G74": 1, "G75": 1, "G76": 1, "G77": 1, "G78": 1, "G79": 1,
    
    "G04": 0, "G05": 0, "G05.1": 0, "G05.4": 0, "G07": 0, "G07.1": 0, "G08": 0, "G09": 0, 
    "G10": 0, "G10.6": 0, "G10.9": 0, "G11": 0, "G20": 0, "G21": 0, "G22": 0, "G23": 0,
    "G25": 0, "G26": 0, "G27": 0, "G28": 0, "G28.2": 0, "G29": 0, "G30": 0, "G30.1": 0, 
    "G30.2": 0, "G31": 0, "G31.8": 0, "G37": 0, "G45": 0, "G46": 0, "G47": 0, "G48": 0,
    "G49": 0, "G49.1": 0, "G50": 0, "G51": 0, "G50.1": 0, "G51.1": 0, "G50.2": 0, "G51.2": 0,
    "G50.4": 0, "G50.5": 0, "G50.6": 0, "G51.4": 0, "G51.5": 0, "G51.6": 0, "G52": 0, "G53": 0,
    "G53.1": 0, "G53.6": 0, "G60": 0, "G65": 0, "G70.7": 0, "G71.7": 0, "G72.7": 0, "G73.7": 0,
    "G74.7": 0, "G75.7": 0, "G76.7": 0, "G72.1": 0, "G72.2": 0, "G81.1": 0, "G90": 0, "G91": 0,
    "G91.1": 0, "G92": 0, "G92.1": 0, "G96": 0, "G97": 0, "G96.1": 0, "G96.2": 0, "G96.3": 0,
    "G96.4": 0, "G107": 0, "G13.4": 0,
    
    "G12.1": 21, "G13.1": 21,
    "G12.4": 2, "G15": 17, "G16": 17,
    "G17": 2, "G17.1": 2, "G18": 2, "G19": 2, 
    
    "G38": 7, "G39": 7, 
    
    "G40": 7, "G41": 7, "G42": 7, "G41.2": 7, "G41.3": 7, "G41.4": 7, "G41.5": 7, "G41.6": 7,
    "G42.2": 7, "G42.4": 7, "G42.5": 7, "G42.6": 7,
    
    "G40.1": 18, "G41.1": 18, "G42.1": 18,
    
    "G43": 8, "G44": 8, "G43.1": 8, "G43.3": 8, "G43.4": 8, "G43.5": 8, "G43.7": 8, "G44.1": 8,
    "G49": 8, "G44.9": 8, "G49.9": 8,
    
    "G54": 14, "G54.1": 14, "G55": 14, "G56": 14, "G57": 14, "G58": 14, "G59": 14,
    
    "G54.2": 15, "G54.4": 15,
    
    "G61": 12, "G62": 12, "G63": 12, "G64": 12,
    
    "G66": 12, "G66.1": 12, "G67": 12,  # Call modals
    
    "G68": 16, "G69": 16, "G68.2": 16, "G68.3": 16, "G68.4": 16,
    
    "G80": 9, "G81": 9, "G82": 9, "G83": 9, "G84": 9, "G84.2": 9, "G84.3": 9, "G85": 9,
    "G86": 9, "G87": 9, "G88": 9, "G89": 9,
    
    "G80.4": 34, "G81.4": 34,
    
    "G80.5": 24, "G81.5": 24,
    
    "G93": 5, "G94": 5, "G95": 5,
    
    "G98": 10, "G99": 10,
    
    "G112": 21, "G113": 21,
    
    "G160": 20, "G161": 20
}

class FanucMillGCodeGroupValidator(Handler):
    """Validates Fanuc Mill G-code group collisions and updates modal state."""

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        seen_groups = {}
        for g_raw in node.g_code:
            try:
                g = g_raw.upper()
                if not g.startswith("G"):
                    continue
            except Exception:
                continue
                
            group_num = FANUC_MILL_GCODE_GROUPS.get(g, -1)
            
            # Group 0 doesn't conflict and -1 means unknown group
            if group_num not in (0, -1):
                if group_num in seen_groups:
                    # Conflict!
                    raise_nc_error( ExceptionTyps.NCCodeErrors, 200, message=f"Too many G-codes of one group (Group {group_num})", value=f"{seen_groups[group_num]} and {g}" )
                seen_groups[group_num] = g
                
                # Update modal state
                state.set_modal(f"G_GROUP_{group_num}", g)
            elif group_num == 0:
                pass 
                
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
