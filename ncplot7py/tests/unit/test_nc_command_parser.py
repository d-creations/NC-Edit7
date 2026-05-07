import unittest

from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.exceptions import ExceptionNode


class TestNCCommandParser(unittest.TestCase):
    def setUp(self) -> None:
        self.parser = NCCommandStringParser()

    def test_basic_g_and_params(self):
        node = self.parser.parse("G1 X10 Y5", line_nr=7)
        self.assertIn("G1", node.g_code)
        self.assertEqual(node.command_parameter.get("X"), "10")
        self.assertEqual(node.command_parameter.get("Y"), "5")
        self.assertEqual(node.nc_code_line_nr, 7)

    def test_duplicate_parameter_raises(self):
        # Two X parameters should trigger a duplication error
        with self.assertRaises(ExceptionNode):
            self.parser.parse("X10 X20")

    def test_variable_command_capture(self):
        node = self.parser.parse("#100", line_nr=1)
        self.assertEqual(node.variable_command, "#100")
        self.assertEqual(node.g_code, set())
        self.assertEqual(node.command_parameter, {})

    def test_dddp_parsing_after_comma(self):
        node = self.parser.parse(",R10")
        # the parser places the token following the comma into dddp_command
        self.assertIn(",R10", node.dddp_command)

    def test_loop_detection(self):
        node = self.parser.parse("GOTO100", line_nr=3)
        self.assertEqual(node.loop_command, "GOTO100")
        self.assertEqual(node.g_code, set())

    def test_uppercase_trig_in_variable_command_not_split(self):
        node = self.parser.parse("#8=#7+[#5-#6]*#20*TAN[[#4/2]]+COS[#1]", line_nr=10)
        self.assertIn("TAN", node.variable_command)
        self.assertIn("COS", node.variable_command)
        self.assertEqual(node.command_parameter, {})

    def test_fanuc_parenthesis_comment_is_ignored(self):
        node = self.parser.parse("T0101(SR20 JII MODEL HEAD 1)")
        self.assertEqual(node.command_parameter.get("T"), "0101")

    def test_inline_macro_comment_is_ignored(self):
        node = self.parser.parse("#501=0.2(SUREPAISSEUR DRESSAGE)")
        self.assertEqual(node.variable_command, "#501=0.2")

if __name__ == "__main__":
    unittest.main()
