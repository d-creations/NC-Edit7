import unittest
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

class TestSiemensMill(unittest.TestCase):
    def setUp(self):
        self.control = StatefulSiemensMillControl(count_of_canals=1)
        self.parser = NCParser()

    def test_simple_motion(self):
        code = """
        G290
        G17 G90 G94
        G0 X0 Y0 Z10
        G1 X10 Y10 F100
        """
        nodes = self.parser.parse(code)
        self.control.run_nc_code_list(nodes, 1)
        path = self.control.get_tool_path(1)
        
        # Check path points
        # 1. (0,0,10)
        # 2. (10,10,10)
        self.assertTrue(len(path) > 0)
        last_seg = path[-1][0]
        last_pt = last_seg[-1]
        self.assertAlmostEqual(last_pt.x, 10.0)
        self.assertAlmostEqual(last_pt.y, 10.0)
        self.assertAlmostEqual(last_pt.z, 10.0)

    def test_drilling_cycle_g81(self):
        code = """
        G290
        G17 G90 G94
        G0 X0 Y0 Z10
        G81 X10 Y10 Z-5 R2 F100
        X20
        G80
        """
        nodes = self.parser.parse(code)
        self.control.run_nc_code_list(nodes, 1)
        path = self.control.get_tool_path(1)
        
        # Analyze path
        # 1. G0 X0 Y0 Z10 -> Move to start
        # 2. G81 X10 Y10...
        #    - Move to X10 Y10 (at Z10)
        #    - Rapid to R2
        #    - Feed to Z-5
        #    - Retract to Z10 (G98 default)
        # 3. X20
        #    - Move to X20 Y10 (at Z10)
        #    - Rapid to R2
        #    - Feed to Z-5
        #    - Retract to Z10
        
        # Let's verify the Z depths reached
        min_z = 100.0
        for seg, dur in path:
            for pt in seg:
                if pt.z < min_z:
                    min_z = pt.z
        
        self.assertAlmostEqual(min_z, -5.0)

    def test_polar_coordinates(self):
        code = """
        G290
        G17 G90
        G0 X0 Y0
        G16 ; Polar On
        G1 X10 Y90 ; R10, Angle 90 -> X0, Y10
        G15 ; Polar Off
        """
        nodes = self.parser.parse(code)
        self.control.run_nc_code_list(nodes, 1)
        path = self.control.get_tool_path(1)
        
        last_seg = path[-1][0]
        last_pt = last_seg[-1]
        
        # X should be approx 0, Y approx 10
        self.assertAlmostEqual(last_pt.x, 0.0, places=3)
        self.assertAlmostEqual(last_pt.y, 10.0, places=3)

if __name__ == '__main__':
    unittest.main()
