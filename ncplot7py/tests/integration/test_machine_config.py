"""Integration test for Machine Config Refactoring (Variables and Tools)."""
import unittest
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillControl
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.exceptions import ExceptionNode as NCError

class TestRefactoringVerification(unittest.TestCase):

    def _parse(self, code):
        parser = NCCommandStringParser()
        nodes = []
        for line in code.strip().splitlines():
            if line.strip():
                nodes.append(parser.parse(line))
        return nodes

    def test_siemens_variables_and_tools(self):
        """Test Siemens 840D: R-parameters and Tool Range (0-9999)."""
        control = StatefulSiemensMillControl()
        
        # 1. Valid R-parameter and Valid Tool
        code_valid = """
        R1=10
        G0 X=R1
        T100
        """
        nodes = self._parse(code_valid)
        control.run_nc_code_list(nodes, 1)
        # Should pass without error

        # 2. Invalid Tool (T10000 is out of range 0-9999)
        code_invalid_tool = """
        T10000
        """
        nodes = self._parse(code_invalid_tool)
        with self.assertRaises(NCError) as cm:
            control.run_nc_code_list(nodes, 1)
        self.assertIn("Tool number T10000 out of range", str(cm.exception))

    def test_fanuc_variables_and_tools(self):
        """Test Fanuc Star: #-parameters and Tool Range (0-99)."""
        control = StatefulIsoTurnControl()

        # 1. Valid #-parameter and Valid Tool
        code_valid = """
        #1=10
        G0 X#1
        T1
        """
        nodes = self._parse(code_valid)
        control.run_nc_code_list(nodes, 1)

        # 2. Invalid Tool (T10000 is out of range 0-99)
        # T100 is valid (Tool 1, Offset 00)
        code_invalid_tool = """
        T10000
        """
        nodes = self._parse(code_invalid_tool)
        with self.assertRaises(NCError) as cm:
            control.run_nc_code_list(nodes, 1)
        self.assertIn("Tool number T10000 out of range", str(cm.exception))

        # 3. Test T0101 (101) - Should be valid (Tool 1, Offset 1)
        code_t0101 = """
        T0101
        """
        nodes = self._parse(code_t0101)
        control.run_nc_code_list(nodes, 1)



if __name__ == '__main__':
    unittest.main()
