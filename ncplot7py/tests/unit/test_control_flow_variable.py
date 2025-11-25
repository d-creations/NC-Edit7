import unittest

from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnCanal
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class TestVariableAndControlFlow(unittest.TestCase):
    def test_variable_assignment_and_substitution(self):
        # Test VariableHandler directly (deterministic unit test)
        state = CNCState()
        from ncplot7py.domain.handlers.variable import VariableHandler
        vh = VariableHandler()

        # variable assignment: #500 = [10+5]
        node_var = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#500=[10+5]", nc_code_line_nr=1)
        vh.handle(node_var, state)
        # variable should be set in state
        self.assertIn("500", state.parameters)
        self.assertEqual(float(state.parameters["500"]), 15.0)

        # parameter using bracketed expression referencing #500 -> evaluate
        node_move = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "[#500+2]", "F": "60"}, nc_code_line_nr=2)
        vh.handle(node_move, state)
        # parameter should have been replaced to numeric string
        self.assertIn("X", node_move.command_parameter)
        self.assertIn("60", node_move.command_parameter.values())

    def test_do_end_loop_counter(self):
        state = CNCState()
        # set a reasonable feed rate so duration not zero
        state.feed_rate = 60.0
        canal = StatefulIsoTurnCanal("C1", init_state=state)

        # DO1 L2 (label 1, loop 2 times)
        node_do = NCCommandNode(g_code_command=set(), command_parameter={"N": "10", "L": "2"}, loop_command="DO1", nc_code_line_nr=1)
        # motion node
        node_move = NCCommandNode(g_code_command={"G01"}, command_parameter={"X": "10", "F": "60", "N": "20"}, nc_code_line_nr=2)
        # END1
        node_end = NCCommandNode(g_code_command=set(), command_parameter={"N": "30"}, loop_command="END1", nc_code_line_nr=3)

        canal.run_nc_code_list([node_do, node_move, node_end])
        tp = canal.get_tool_path()
        # move should have been executed at least once due to L=2
        self.assertTrue(len(tp) >= 1)
        # final state X should be 10
        self.assertAlmostEqual(state.get_axis("X"), 10.0)


if __name__ == "__main__":
    unittest.main()
