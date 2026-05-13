import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode


class TestVariableNestedExpressions(unittest.TestCase):
    def test_nested_bracket_expression_in_parameter(self):
        from ncplot7py.domain.handlers.variable import VariableHandler
        from ncplot7py.domain.exec_chain import Handler

        test_case = self
        class MockHandler(Handler):
            def handle(self, node, state):
                test_case.assertIn("Y", node.command_parameter)
                val = float(node.command_parameter["Y"])
                test_case.assertAlmostEqual(val, -3.46, places=5)
                return None, None

        state = CNCState()
        mock = MockHandler()
        vh = VariableHandler(next_handler=mock)

        # parameter with nested bracket expression
        node = NCCommandNode(g_code_command=set(), command_parameter={"Y": "[2*[-1.73]]"}, nc_code_line_nr=1)
        vh.handle(node, state)

    def test_nested_bracket_expression_in_variable_assignment(self):
        from ncplot7py.domain.handlers.variable import VariableHandler

        state = CNCState()
        vh = VariableHandler()

        node_var = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#100=[2*[-1.73]]", nc_code_line_nr=2)
        vh.handle(node_var, state)

        self.assertIn("100", state.parameters)
        self.assertAlmostEqual(float(state.parameters["100"]), -3.46, places=6)

    def test_uppercase_trig_functions_are_evaluated(self):
        from ncplot7py.domain.handlers.variable import VariableHandler

        state = CNCState()
        state.parameters["4"] = 60.0
        vh = VariableHandler()

        node_var = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#7=COS[#4/2]", nc_code_line_nr=3)
        vh.handle(node_var, state)

        self.assertIn("7", state.parameters)
        self.assertAlmostEqual(float(state.parameters["7"]), 0.8660254, places=6)


if __name__ == "__main__":
    unittest.main()
