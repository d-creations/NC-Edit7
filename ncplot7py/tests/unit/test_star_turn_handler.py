import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.handlers.star_machine.star_turn_handler import StarTurnHandler


class TestStarTurnHandler(unittest.TestCase):
    def test_g125_removes_z_parameter(self):
        handler = StarTurnHandler()
        state = CNCState()

        node = NCCommandNode(g_code_command={"G125"}, command_parameter={"Z": "10.0", "X": "5.0"})

        pts, dur = handler.handle(node, state)

        # handler should have removed Z but left X intact
        self.assertNotIn("Z", node.command_parameter)
        self.assertIn("X", node.command_parameter)
        self.assertIsNone(pts)
        self.assertIsNone(dur)

    def test_g266_maps_parameters_to_state_variables_and_pops(self):
        handler = StarTurnHandler()
        state = CNCState()

        params = {
            "A": "1.5",
            "W": "2.0",
            "S": "300",
            "F": "120.0",
            "B": "2.0",
            "X": "15.0",
            "Z": "15.0",
            "T": "100",
        }
        node = NCCommandNode(g_code_command={"G266"}, command_parameter=dict(params))

        pts, dur = handler.handle(node, state)

        # parameters should be removed from the node
        for k in params.keys():
            self.assertNotIn(k, node.command_parameter)

        # state.parameters should contain mapped numeric entries as floats
        expected = {
            "531": 1.5,  # A
            "530": 2.0,  # W
            "529": 300.0,  # S
            "522": 120.0,  # F
            "528": 2.0,  # B
            "524": 15.0,  # X
            "525": 15.0,  # Z
            "523": 100.0,  # T
        }
        for k, v in expected.items():
            self.assertIn(k, state.parameters)
            self.assertAlmostEqual(float(state.parameters[k]), float(v))

        self.assertIsNone(pts)
        self.assertIsNone(dur)

    def test_g300_is_noop(self):
        handler = StarTurnHandler()
        state = CNCState()

        node = NCCommandNode(g_code_command={"G300"}, command_parameter={"Z": "5.0"})

        pts, dur = handler.handle(node, state)

        # G300 should be a no-op: Z remains
        self.assertIn("Z", node.command_parameter)
        self.assertEqual(node.command_parameter["Z"], "5.0")
        self.assertIsNone(pts)
        self.assertIsNone(dur)


if __name__ == '__main__':
    unittest.main()
