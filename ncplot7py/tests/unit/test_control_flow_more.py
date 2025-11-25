import unittest

from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnCanal
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class TestControlFlowMore(unittest.TestCase):
    def test_if_goto_with_variable(self):
        state = CNCState()
        canal = StatefulIsoTurnCanal("C1", init_state=state)

        # set variable #500 to 5 using VariableHandler via canal
        node_set = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#500=[5]", nc_code_line_nr=1)
        # IF#500GT3GOTO20 should jump to node with N=20
        node_if = NCCommandNode(g_code_command=set(), command_parameter={}, loop_command="IF#500GT3GOTO20", nc_code_line_nr=2)
        # target node
        node_target = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "7", "F": "60", "N": "20"}, nc_code_line_nr=3)

        canal.run_nc_code_list([node_set, node_if, node_target])

        # move should have executed because IF condition true
        tp = canal.get_tool_path()
        self.assertTrue(len(tp) >= 1)
        self.assertAlmostEqual(state.get_axis("X"), 7.0)

    def test_goto_to_do_label(self):
        state = CNCState()
        state.feed_rate = 60.0
        canal = StatefulIsoTurnCanal("C1", init_state=state)

        # GOTO1 should jump to DO1
        node_goto = NCCommandNode(g_code_command=set(), command_parameter={}, loop_command="GOTO1", nc_code_line_nr=1)
        node_before = NCCommandNode(g_code_command=set(), command_parameter={}, nc_code_line_nr=2)
        node_do = NCCommandNode(g_code_command=set(), command_parameter={"N": "10"}, loop_command="DO1", nc_code_line_nr=3)
        node_move = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "3", "F": "60", "N": "11"}, nc_code_line_nr=4)

        canal.run_nc_code_list([node_goto, node_before, node_do, node_move])

        tp = canal.get_tool_path()
        self.assertTrue(len(tp) >= 1)
        self.assertAlmostEqual(state.get_axis("X"), 3.0)

    def test_nested_do_end_loops(self):
        state = CNCState()
        state.feed_rate = 60.0
        canal = StatefulIsoTurnCanal("C1", init_state=state)

        # outer DO1 L2
        node_do1 = NCCommandNode(g_code_command=set(), command_parameter={"N": "10", "L": "2"}, loop_command="DO1", nc_code_line_nr=1)
        # inner DO2 L3
        node_do2 = NCCommandNode(g_code_command=set(), command_parameter={"N": "11", "L": "3"}, loop_command="DO2", nc_code_line_nr=2)
        # move inside inner loop
        node_move = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "5", "F": "60", "N": "12"}, nc_code_line_nr=3)
        node_end2 = NCCommandNode(g_code_command=set(), command_parameter={"N": "13"}, loop_command="END2", nc_code_line_nr=4)
        node_end1 = NCCommandNode(g_code_command=set(), command_parameter={"N": "14"}, loop_command="END1", nc_code_line_nr=5)

        canal.run_nc_code_list([node_do1, node_do2, node_move, node_end2, node_end1])

        tp = canal.get_tool_path()
        # expected: inner loop 3 times per outer loop, outer loops 2 times => 6 moves
        self.assertTrue(len(tp) >= 6)
        self.assertAlmostEqual(state.get_axis("X"), 5.0)


if __name__ == "__main__":
    unittest.main()
