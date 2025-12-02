import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck import GcodePreCheckExecChainLink
from ncplot7py.domain.exceptions import ExceptionNode, ExceptionTyps


class TestGcodePreCheck(unittest.TestCase):
    def test_uppercase_parameters_pass(self):
        handler = GcodePreCheckExecChainLink()
        state = CNCState()

        node = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "10.0", "Z": "5.0"})

        pts, dur = handler.handle(node, state)

        # Should delegate and not raise; returns None, None by default
        self.assertIsNone(pts)
        self.assertIsNone(dur)

    def test_lowercase_parameter_raises_exceptionnode(self):
        handler = GcodePreCheckExecChainLink()
        state = CNCState()

        node = NCCommandNode(g_code_command={"G1"}, command_parameter={"x": "10.0"})

        with self.assertRaises(ExceptionNode) as cm:
            handler.handle(node, state)

        exc = cm.exception
        self.assertEqual(exc.typ, ExceptionTyps.NCCodeErrors)
        self.assertEqual(exc.code, 130)


if __name__ == '__main__':
    unittest.main()
