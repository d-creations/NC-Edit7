import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode


class TestVariableNestedExpressions(unittest.TestCase):
    def test_nested_bracket_expression_in_parameter(self):
        from ncplot7py.domain.handlers.variable import VariableHandler

        state = CNCState()
        vh = VariableHandler()

        # parameter with nested bracket expression
        node = NCCommandNode(g_code_command=set(), command_parameter={"Y": "[2*[-1.73]]"}, nc_code_line_nr=1)
        vh.handle(node, state)

        self.assertIn("Y", node.command_parameter)
        # numeric value should be replaced and parseable as float
        val = float(node.command_parameter["Y"])
        self.assertAlmostEqual(val, -3.46, places=6)

    def test_nested_bracket_expression_in_variable_assignment(self):
        from ncplot7py.domain.handlers.variable import VariableHandler

        state = CNCState()
        vh = VariableHandler()

        node_var = NCCommandNode(g_code_command=set(), command_parameter={}, variable_command="#100=[2*[-1.73]]", nc_code_line_nr=2)
        vh.handle(node_var, state)

        self.assertIn("100", state.parameters)
        self.assertAlmostEqual(float(state.parameters["100"]), -3.46, places=6)


if __name__ == "__main__":
    unittest.main()
