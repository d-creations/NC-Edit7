import unittest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenCanal as UniversalConfigDrivenCanal
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

class TestFanucWhileLoopIntegration(unittest.TestCase):
    def test_variable_increment_in_while_loop(self):
        """
        Tests that variables correctly update across loops, and that the original 
        command strings like 'X#20' remain intact for dynamic re-evaluation.
        """
        nc_code = """
        G90 G54
        G0 X0 Y0 Z0
        #20=1.0
        #21=5.0
        WHILE[#20LT#21]DO1
        G1 X#20 Y#20 Z#20 F1000
        #20=#20+1.0
        END1
        M30
        """
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        cstate.extra['polar_interpolate_axis'] = 'X'
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)

        #canal = UniversalConfigDrivenCanal("TestTurn")
        parser = NCCommandStringParser()
    
        nodes = []
        for line in nc_code.strip().split('\n'):
            nodes.append(parser.parse(line.strip()))
        
        canal.run_nc_code_list(nodes)
    
        path = canal.get_tool_path()
        points = []
        for segment, duration in path:
            if hasattr(segment, '__iter__'):
                points.extend(segment)
            
        z_values = [p.z for p in points]
        
        # In a Turn canal, X might be interpreted as diameter and divided by 2.
        # Z should strictly follow the standard 1.0, 2.0, 3.0, 4.0 scaling.
        self.assertIn(1.0, z_values, "Should contain point with Z=1.0")
        self.assertIn(2.0, z_values, "Should contain point with Z=2.0")
        self.assertIn(3.0, z_values, "Should contain point with Z=3.0")
        self.assertIn(4.0, z_values, "Should contain point with Z=4.0")
        
        # Loop terminates when #20 (Z) is 5.0 (#20 < #21=5.0)
        self.assertNotIn(5.0, z_values, "Should NOT contain point with Z=5.0 as loop breaks before")

if __name__ == "__main__":
    unittest.main()
