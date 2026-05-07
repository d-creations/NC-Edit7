import unittest

from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenCanal as UniversalConfigDrivenCanal
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class TestGCodeGroup21Polar(unittest.TestCase):
    def test_polar_remap_c_to_v_and_h_to_u_with_axis_y(self):
        # Setup canal and state with polar axis Y
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        cstate.extra['polar_interpolate_axis'] = 'Y'
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)

        # Node enabling polar (G112) and specifying C and H
        node_enable = NCCommandNode(g_code_command={'G112'}, command_parameter={})
        node_motion = NCCommandNode(g_code_command={'G1'}, command_parameter={'C': '10.0', 'H': '2.5'})
        # link
        node_enable._next_ncCode = node_motion
        node_motion._before_ncCode = node_enable

        test_case = self
        from ncplot7py.domain.exec_chain import Handler
        class Verifier(Handler):
            def handle(self, node, state):
                if 'G1' in getattr(node, 'g_code', set()):
                    test_case.assertIn('V', node.command_parameter)
                    test_case.assertEqual(float(node.command_parameter['V']), 2.5)
                    test_case.assertIn('Y', node.command_parameter)
                    test_case.assertAlmostEqual(float(node.command_parameter['Y']), 10.0)
                    test_case.assertNotIn('C', node.command_parameter)
                    test_case.assertNotIn('H', node.command_parameter)
                return None, None
        curr = canal._chain
        while curr.next_handler is not None:
             curr = curr.next_handler
        curr.next_handler = Verifier()

        canal.run_nc_code_list([node_enable, node_motion])

    def test_arc_direction_swap_when_axis_x(self):
        # Setup state with polar axis X
        cstate = CNCState(); cstate.machine_config = get_machine_config("FANUC_TURN")
        cstate.extra['polar_interpolate_axis'] = 'X'
        canal = UniversalConfigDrivenCanal('C1', init_state=cstate)
        # Node enabling polar and an arc G2 (provide an R param so motion
        # handler has sufficient information for interpolation)
        node_enable = NCCommandNode(g_code_command={'G112'}, command_parameter={})
        node_arc = NCCommandNode(g_code_command={'G2'}, command_parameter={'X': '10.0', 'C': '5.0', 'R': '5.0'})
        node_enable._next_ncCode = node_arc
        node_arc._before_ncCode = node_enable

        test_case = self
        from ncplot7py.domain.exec_chain import Handler
        class ArcVerifier(Handler):
            def handle(self, node, state):
                if 'G2' in getattr(node, 'g_code', set()) or 'G3' in getattr(node, 'g_code', set()):
                    test_case.assertIn('G3', node.g_code)
                    test_case.assertNotIn('G2', node.g_code)
                return None, None
        curr = canal._chain
        while curr.next_handler is not None:
             curr = curr.next_handler
        curr.next_handler = ArcVerifier()

        canal.run_nc_code_list([node_enable, node_arc])


if __name__ == '__main__':
    unittest.main()
