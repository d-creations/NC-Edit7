import os
import sys
import unittest
from pathlib import Path

# ensure imports from src are available
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl
from ncplot7py.shared import configure_logging, configure_i18n


class TestPolarPlaneRestoreIntegration(unittest.TestCase):
    def test_polar_enable_disable_restores_plane(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Construct a small program that sets plane to G18 (X_Z), then enables
        # polar (G112) which forces X_Y, and then disables polar (G113).
        # After G113 we expect the original plane (X_Z) to be restored.
        program = (
            "G18;"  # set plane X_Z
            "G112;"  # polar on (should set X_Y and remember previous)
            "G1 X0 Y0;"  # simple motion while polar active
            "G113;"  # polar off (should restore previous plane X_Z)
        )

        ctrl = StatefulIsoTurnNCControl(count_of_canals=1)
        engine = NCExecutionEngine(ctrl)
        result = engine.get_Syncro_plot([program], synch=False)

        # basic execution sanity
        self.assertIsInstance(result, list)

        # inspect canal state to verify plane was restored
        canal_state = ctrl._canals[1]._state
        final_plane = canal_state.extra.get('g_group_16_plane')

        # Expect the final plane to be X_Z (string or enum value accepted)
        self.assertTrue(final_plane == 'X_Z' or str(final_plane).endswith('X_Z'))


if __name__ == '__main__':
    unittest.main()
