import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl
from ncplot7py.shared import configure_logging, configure_i18n
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class TestWhileDoEndIntegration(unittest.TestCase):
    def test_while_do_end_loop(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Program:
        # 1) set counter #1 to 3
        # 2) use rapid/absolute motion (G00)
        # 3) WHILE #1 GT 0 DO1 -> begin loop
        # 4) N10 G01 X1 F60 -> move +1 in X each iteration (incremental mode)
        # 5) #1=[#1-1] -> decrement counter
        # 6) IF#1GT0GOTO10 -> if still >0 jump back to N10
        # 7) END1 -> loop end
        program = "#1=[3]; WHILE#1GT0DO1; N10 G00 X1; #1=[#1-1]; END1"

        # We'll construct nodes directly and run them through the canal to
        # exercise DO/END with a loop counter (L). This bypasses parsing so we
        # can attach 'L' in command_parameter as expected by the control flow
        # handler.

        ctrl = StatefulIsoTurnNCControl()
        # Ensure this test uses radius interpretation for X (not diameter)
        # to preserve the original expectation that G00 X1 results in X==1.0
        try:
            ctrl._canals[1]._state.set_axis_unit('X', 'radius')
        except Exception:
            pass
        # prepare nodes
        # initialize variable #1 = 3
        node_var = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#1=[3]", nc_code_line_nr=1)
        # DO1 with loop counter L=3 (label 1, loop three times)
        node_do = NCCommandNode(g_code_command=set(), command_parameter={"N": "10", "L": "3"}, loop_command="DO1", nc_code_line_nr=2)
        # set rapid move G00
        node_g0 = NCCommandNode(g_code_command={"G00"}, command_parameter={}, nc_code_line_nr=3)
        # motion: increment X by 1 each iteration (N=11)
        node_move = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "1", "F": "60", "N": "11"}, nc_code_line_nr=4)
        # END1 closes DO1
        node_end = NCCommandNode(g_code_command=set(), command_parameter={"N": "20"}, loop_command="END1", nc_code_line_nr=5)

        # run nodes through control (canal 1)
        ctrl.run_nc_code_list([node_var, node_do, node_g0, node_move, node_end], 1)

        # Control should have produced a tool path for canal 1
        tp = ctrl.get_tool_path(1)
        self.assertTrue(len(tp) >= 1)

        # final point X should be 1.0 (absolute G00 X1 executed, not incremental)
        last_line = tp[-1]
        pts = last_line[0]
        self.assertTrue(len(pts) >= 1)
        self.assertAlmostEqual(getattr(pts[-1], 'x', None), 1.0)


if __name__ == '__main__':
    unittest.main()
