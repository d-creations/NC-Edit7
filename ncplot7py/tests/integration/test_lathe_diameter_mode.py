import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared import configure_logging, configure_i18n, get_message_stack


class TestLatheDiameterModeIntegration(unittest.TestCase):
    def test_lathe_diameter_interprets_x_as_diameter(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # prepare initial state where X axis is interpreted as a diameter
        init_state = CNCState()
        init_state.set_axis('X', 0.0)
        init_state.set_axis_unit('X', 'diameter')

        # create control with this initial state
        ctrl = StatefulIsoTurnNCControl(init_nc_states=[init_state])
        engine = NCExecutionEngine(ctrl)

        # simple program: move X to 10 (interpreted as diameter -> radius 5)
        program = "G1 X10"
        result = engine.get_Syncro_plot([program], synch=False)

        # Verify engine produced a plot structure
        self.assertIsInstance(result, list)
        # Check the canal's CNCState got updated to radius value (5.0)
        state_after = ctrl._canals[1]._state
        self.assertAlmostEqual(state_after.get_axis('X'), 5.0)

        # Also ensure tool path contains final point with x==5.0
        tool_path = ctrl.get_tool_path(1)
        # find last point in last segment
        last_x = None
        if tool_path and len(tool_path) > 0:
            seg_pts, _ = tool_path[-1]
            if seg_pts:
                last_x = getattr(seg_pts[-1], 'x', None)
        self.assertAlmostEqual(last_x, 5.0)


if __name__ == '__main__':
    unittest.main()
