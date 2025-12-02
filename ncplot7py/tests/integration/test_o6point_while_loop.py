import os
import sys
import unittest
from pathlib import Path

# Ensure package imports from src are resolvable when running tests directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl
from ncplot7py.shared import configure_logging, configure_i18n
from ncplot7py.shared.file_adapter import get_program


class TestO6PointWhileLoopIntegration(unittest.TestCase):
    def test_o6point_while_runs_expected_iterations_and_produces_toolpath(self):
        # Minimal logging configuration for tests
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Inline O6POINT program (equivalent to data/nc-examples/O6POINT)
        program_lines = [
            "O0001(SB12 RG FRONT)",
            "T1400",
            "M36S3000",
            "G99",
            "F200 G98",
            "G112",
            "#100 =0",
            "#101 = 2",
            "WHILE[#100 LT #101]DO1",
            "#100 = #100 + 1",
            "G1 X0 C0",
            "G1 X-8.0 C0",
            "G1 X-8.0 C-1.73",
            "G3 X-7.0 C-2.66 R1.0",
            "G1 X-1.0 C-4.33",
            "G3 X1.0 C-4.33 R1.0",
            "G1 X7.0 C-2.66",
            "G3 X8.0 C-1.73 R1.0",
            "G1 X8.0 C1.73",
            "G3 X7.0 C2.66 R1.0",
            "G1 X1.0 C4.33",
            "G3 X-1.0 C4.33 R1.0",
            "G1 X-7.0 C2.66",
            "G3 X-8.0 C1.73 R1.0",
            "G1 X-8.0 C0",
            "G1W1.0",
            "END1",
            "G113",
        ]
        # Use the project's file adapter helper to perform the same
        # preprocessing (remove parentheses, normalize whitespace).
        programs = get_program(program_lines, split_on_blank_line=True)
        # create control with same number of canals as programs
        ctrl = StatefulIsoTurnNCControl(count_of_canals=max(1, len(programs)))
        engine = NCExecutionEngine(ctrl)

        result = engine.get_Syncro_plot(programs, synch=False)

        # result should be a list with at least one canal
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

        # Check that variable #100 was incremented twice (final value == 2)
        # Variable store keys are strings without the leading '#'
        state_params = ctrl._canals[1]._state.parameters
        # ensure parameter exists
        self.assertIn('100', state_params)
        self.assertAlmostEqual(float(state_params.get('100')), 2.0)

        # Ensure tool path was produced for canal 1
        tp = ctrl.get_tool_path(1)
        self.assertIsInstance(tp, list)
        self.assertGreater(len(tp), 0)


if __name__ == '__main__':
    unittest.main()
