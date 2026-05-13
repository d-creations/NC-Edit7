import unittest

from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenCanal as UniversalConfigDrivenCanal
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group2_speed_mode import SpeedMode
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode import FeedMode


class TestFanucModals(unittest.TestCase):
    def test_fanuc_mill_g0_remains_active_for_axis_only_blocks(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_MILL")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        nodes = [
            NCCommandNode(g_code_command={'G0'}, command_parameter={'X': '0.0', 'Y': '0.0', 'Z': '20.0'}),
            NCCommandNode(g_code_command=set(), command_parameter={'Z': '-10.0', 'F': '180.0'}),
            NCCommandNode(g_code_command=set(), command_parameter={'X': '20.0'}),
            NCCommandNode(g_code_command=set(), command_parameter={'Y': '20.0'}),
        ]

        canal.run_nc_code_list(nodes)

        self.assertEqual(cstate.get_modal('G_GROUP_1'), 'G00')
        self.assertAlmostEqual(cstate.get_axis('X'), 20.0)
        self.assertAlmostEqual(cstate.get_axis('Y'), 20.0)
        self.assertAlmostEqual(cstate.get_axis('Z'), -10.0)
        self.assertEqual(len(canal.get_tool_path()), 4)

    def test_g96_sets_surface_speed_mode(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        node = NCCommandNode(g_code_command={'G96'}, command_parameter={})
        canal.run_nc_code_list([node])
        self.assertIn('surface_speed_mode', cstate.extra)
        val = cstate.extra['surface_speed_mode']
        # Accept both Enum and string values
        self.assertTrue(val == SpeedMode.CONSTANT_CUTSPEED or val == SpeedMode.CONSTANT_CUTSPEED.value)

    def test_g97_sets_constant_rev(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        node = NCCommandNode(g_code_command={'G97'}, command_parameter={})
        canal.run_nc_code_list([node])
        self.assertIn('surface_speed_mode', cstate.extra)
        val = cstate.extra['surface_speed_mode']
        self.assertTrue(val == SpeedMode.CONSTANT_REV or val == SpeedMode.CONSTANT_REV.value)

    def test_g98_and_g99_conflict_raises(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        node = NCCommandNode(g_code_command={'G98','G99'}, command_parameter={})
        # Running should raise an exception from the handler; capture via unittest
        with self.assertRaises(Exception):
            canal.run_nc_code_list([node])

    def test_g98_sets_feed_per_min(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        node = NCCommandNode(g_code_command={'G98'}, command_parameter={})
        canal.run_nc_code_list([node])
        self.assertIn('feed_mode', cstate.extra)
        val = cstate.extra['feed_mode']
        self.assertTrue(val == FeedMode.FEED_PER_MIN or val == FeedMode.FEED_PER_MIN.value)

    def test_g99_sets_feed_per_rev(self):
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        node = NCCommandNode(g_code_command={'G99'}, command_parameter={})
        canal.run_nc_code_list([node])
        self.assertIn('feed_mode', cstate.extra)
        val = cstate.extra['feed_mode']
        self.assertTrue(val == FeedMode.FEED_PER_REV or val == FeedMode.FEED_PER_REV.value)


if __name__ == '__main__':
    unittest.main()
