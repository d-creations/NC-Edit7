import unittest

from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnCanal
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class TestGCodeGroup21Polar(unittest.TestCase):
    def test_polar_remap_c_to_v_and_h_to_u_with_axis_y(self):
        # Setup canal and state with polar axis Y
        cstate = CNCState()
        cstate.extra['polar_interpolate_axis'] = 'Y'
        canal = StatefulIsoTurnCanal('C1', init_state=cstate)

        # Node enabling polar (G112) and specifying C and H
        node_enable = NCCommandNode(g_code_command={'G112'}, command_parameter={})
        node_motion = NCCommandNode(g_code_command={'G1'}, command_parameter={'C': '10.0', 'H': '2.5'})
        # link
        node_enable._next_ncCode = node_motion
        node_motion._before_ncCode = node_enable

        canal.run_nc_code_list([node_enable, node_motion])

        # After execution, the motion node should have V and not H, and Y (polar axis)
        self.assertIn('V', node_motion.command_parameter)
        self.assertEqual(float(node_motion.command_parameter['V']), 2.5)
        # C should be remapped into Y axis displacement
        self.assertIn('Y', node_motion.command_parameter)
        self.assertAlmostEqual(float(node_motion.command_parameter['Y']), 10.0)
        self.assertNotIn('C', node_motion.command_parameter)
        self.assertNotIn('H', node_motion.command_parameter)

    def test_arc_direction_swap_when_axis_x(self):
        # Setup state with polar axis X
        cstate = CNCState()
        cstate.extra['polar_interpolate_axis'] = 'X'
        canal = StatefulIsoTurnCanal('C1', init_state=cstate)
        # Node enabling polar and an arc G2 (provide an R param so motion
        # handler has sufficient information for interpolation)
        node_enable = NCCommandNode(g_code_command={'G112'}, command_parameter={})
        node_arc = NCCommandNode(g_code_command={'G2'}, command_parameter={'C': '5.0', 'R': '5.0'})
        node_enable._next_ncCode = node_arc
        node_arc._before_ncCode = node_enable

        canal.run_nc_code_list([node_enable, node_arc])

        # Arc direction should be swapped: G2 -> G3
        # Note: sets are unordered, check presence of G3 and absence of G2
        self.assertIn('G3', node_arc.g_code)
        self.assertNotIn('G2', node_arc.g_code)


if __name__ == '__main__':
    unittest.main()
