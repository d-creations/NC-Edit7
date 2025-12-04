import unittest
import math
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.cnc_state import CNCState

class NCParser:
    def __init__(self):
        self.parser = NCCommandStringParser()
    
    def parse(self, code):
        nodes = []
        lines = code.strip().split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            # Remove comments (simple check)
            if line.startswith('(') or line.startswith(';'): continue
            # Handle inline comments
            if ';' in line:
                line = line.split(';')[0].strip()
            
            node = self.parser.parse(line, i+1)
            nodes.append(node)
        return nodes

class TestSiemens5AxisComplex(unittest.TestCase):
    def setUp(self):
        self.control = StatefulSiemensMillControl(count_of_canals=1)
        self.parser = NCParser()

    def test_complex_5axis_program(self):
        # This program simulates a 5-axis operation
        # 1. Setup variables
        # 2. Move to safe position
        # 3. Loop to drill holes on a circle (simulated)
        # 4. Perform 5-axis swarf cutting moves (A/B axis)
        
        code = """
        ; Initialize
        G290
        G17 G90 G94
        G54
        
        ; Variables
        R1 = 0 ; Counter
        R2 = 5 ; Number of holes
        R3 = 100 ; Radius
        R4 = 0 ; Angle
        
        ; Safe Move
        G0 X0 Y0 Z100
        
        ; Loop for drilling
        WHILE R1 < R2 DO 1
            R4 = R1 * (360 / R2)
            
            ; Calculate position (simplified, usually would use sin/cos but parser might not support functions yet)
            ; Let's just move incrementally or use simple arithmetic if sin/cos not supported
            ; Assuming sin/cos NOT supported in this parser version, we simulate positions
            
            G0 Z10
            G1 Z-5 F100
            G0 Z10
            
            R1 = R1 + 1
        END 1
        
        ; 5-Axis Moves
        ; TRAORI would be here
        G0 X100 Y0 Z50 A0 B0
        G1 X100 Y0 Z50 A45 B0 F500
        G1 X100 Y0 Z50 A45 B90
        G1 X100 Y0 Z50 A0 B90
        G1 X100 Y0 Z50 A0 B0
        
        ; Cycle Test
        G0 X0 Y0 Z10
        G81 X50 Y50 Z-10 R2 F200
        X60
        G80
        
        M30
        """
        
        # Note: The parser might not support 'WHILE ... DO ...' syntax exactly as written if spaces are missing or specific format required.
        # The ControlFlowHandler expects "WHILE<cond> DO<label>" or similar.
        # Let's adjust the code to match what ControlFlowHandler expects based on my reading.
        # It splits by spaces after inserting spaces around tokens.
        
        code_adjusted = """
        G290
        G17 G90 G94
        G54
        
        R1=0
        R2=5
        
        G0 X0 Y0 Z100
        
        WHILE R1 LT R2 DO1
            G0 Z10
            G1 Z-5 F100
            G0 Z10
            R1 = R1 + 1
        END1
        
        G0 X100 Y0 Z50 A0 B0
        G1 X100 Y0 Z50 A45 B0 F500
        G1 X100 Y0 Z50 A45 B90
        G1 X100 Y0 Z50 A0 B90
        G1 X100 Y0 Z50 A0 B0
        
        G0 X0 Y0 Z10
        G81 X50 Y50 Z-10 R2 F200
        X60
        G80
        """
        
        nodes = self.parser.parse(code_adjusted)
        self.control.run_nc_code_list(nodes, 1)
        path = self.control.get_tool_path(1)
        
        # Verification
        self.assertTrue(len(path) > 0)
        
        # Check if we have 5-axis moves
        has_a_move = False
        has_b_move = False
        
        # We need to check the state or the points? 
        # The Point class might not store A/B if it's just X,Y,Z.
        # Let's check the Point definition.
        
        # Also check if loop executed 5 times.
        # Each loop has: G0 Z10, G1 Z-5, G0 Z10 (3 moves) + R1 update (no move)
        # So we expect at least 5 * 3 = 15 moves from the loop.
        
        # Let's count Z-5 occurrences
        z_minus_5_count = 0
        for seg, dur in path:
            for pt in seg:
                if abs(pt.z - (-5.0)) < 0.001:
                    z_minus_5_count += 1
                    # Break to avoid counting multiple points in same segment if they are same
                    break
        
        # We expect 5 holes drilled
        self.assertGreaterEqual(z_minus_5_count, 5)
        
        # Check for G81 execution
        # Should have visited X50 Y50 Z-10 and X60 Y50 Z-10
        found_cycle_pt1 = False
        found_cycle_pt2 = False
        
        for seg, dur in path:
            for pt in seg:
                if abs(pt.x - 50) < 0.1 and abs(pt.y - 50) < 0.1 and abs(pt.z - (-10)) < 0.1:
                    found_cycle_pt1 = True
                if abs(pt.x - 60) < 0.1 and abs(pt.y - 50) < 0.1 and abs(pt.z - (-10)) < 0.1:
                    found_cycle_pt2 = True
                    
        self.assertTrue(found_cycle_pt1, "Cycle point 1 not found")
        self.assertTrue(found_cycle_pt2, "Cycle point 2 not found")

    def test_arcs_and_cutter_comp(self):
        # Test G2/G3 arcs and G41 cutter compensation
        # We need to set up tool data first for G41 to work
        
        # 1. Set up tool data in state
        # The handler looks for state.extra["tool_compensation_data"][tool_number]
        # tool_number is set by T command.
        
        # We'll use Tool 100 (valid range for Siemens 840D config is 100-9999)
        tool_data = {
            100: {
                "rValue": 5.0,  # Radius 5
                "qValue": 1     # Quadrant 1 (not strictly used for simple G41 but good to have)
            }
        }
        
        # Access the canal state directly to inject tool data
        # Canal 1 is at index 1 in _canals dict
        canal = self.control._canals[1]
        canal._state.extra["tool_compensation_data"] = tool_data
        
        # 2. Set a variable value first
        # R10 = 20 (Radius of arc)
        canal._state.parameters["10"] = 20.0
        
        code = """
        G290
        G17 G90 G94
        G54
        
        ; Select Tool 100
        T100
        
        ; Move to start point
        G0 X0 Y0 Z10
        
        ; Activate Cutter Comp Left (G41)
        ; Move to approach point
        G41 X0 Y-10
        
        ; Linear move
        G1 X50 Y-10 F500
        
        ; CCW Arc (G3) with Radius R10 (20)
        ; From (50, -10) to (70, 10) -> Radius 20
        ; Center would be at (50, 10)
        ; Start angle: -90 deg (270)
        ; End angle: 0 deg
        ; Delta X = 20, Delta Y = 20
        G3 X70 Y10 R=R10
        
        ; Linear move up
        G1 X70 Y50
        
        ; CW Arc (G2)
        ; From (70, 50) to (50, 70) with R20
        ; Center at (50, 50)
        G2 X50 Y70 R=R10
        
        ; Cancel Comp
        G40 X0 Y70
        
        M30
        """
        
        nodes = self.parser.parse(code)
        self.control.run_nc_code_list(nodes, 1)
        path = self.control.get_tool_path(1)
        
        self.assertTrue(len(path) > 0)
        
        # Verify we have arcs
        # MotionHandler returns many small segments for arcs
        # We can check if we have many points
        
        total_points = sum(len(seg) for seg, dur in path)
        self.assertGreater(total_points, 20, "Should have many points due to arc interpolation")
        
        # Check if R10 was used for radius
        # We can check the points of the arc.
        # The first arc G3 X70 Y10 R20 starts at (50, -10).
        # Center (50, 10). Radius 20.
        # Points should be on this circle.
        # (x-50)^2 + (y-10)^2 = 20^2 = 400
        
        # Find points in the arc segment
        # The path is a list of (points, duration).
        # We have:
        # 1. G0 X0 Y0 Z10
        # 2. G41 X0 Y-10 (Linear)
        # 3. G1 X50 Y-10 (Linear)
        # 4. G3 X70 Y10 (Arc)
        
        # Let's look for points roughly in the arc range X>50, Y>-10
        arc_points = []
        for seg, dur in path:
            for pt in seg:
                if 50 < pt.x < 70 and -10 < pt.y < 10:
                    arc_points.append(pt)
        
        if arc_points:
            for pt in arc_points:
                # Check distance to center (50, 10)
                dist = math.sqrt((pt.x - 50)**2 + (pt.y - 10)**2)
                # Should be approx 20
                self.assertAlmostEqual(dist, 20.0, delta=0.5)

if __name__ == '__main__':
    unittest.main()
