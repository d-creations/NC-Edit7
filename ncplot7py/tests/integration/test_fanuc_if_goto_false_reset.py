import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnCanal
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser


class TestFanucIfGotoFalseReset(unittest.TestCase):
    def test_if_goto_false_pointer_reset(self):
        """
        Integration test to ensure that when an IF condition evaluates to FALSE,
        the internal _next_ncCode pointer correctly resets to point to the next
        consecutive node, rather than continuing to point at the GOTO target from
        a previous TRUE evaluation (which would skip intermediate nodes like variable
        assignments).
        """
        code = """#142=2
#10=9
IF#10LT9GOTO300
#142=0
N300
G1 W#142"""

        parser = NCCommandStringParser()
        nodes = []
        for line in code.strip().splitlines():
            if line.strip():
                nodes.append(parser.parse(line))

        state = CNCState()
        canal = StatefulIsoTurnCanal("C1", init_state=state)
        canal.run_nc_code_list(nodes)

        # Since 9 < 9 is FALSE, the IF should not jump to N300 and should instead
        # fall through to the #142=0 execution block.
        # Thus the final state parameter '#142' evaluated as 0.0.
        
        self.assertIn("142", state.parameters)
        self.assertEqual(float(state.parameters["142"]), 0.0)


if __name__ == "__main__":
    unittest.main()
