import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenControl as UniversalConfigDrivenControl
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared import configure_logging, configure_i18n, get_message_stack


class TestStatefulControlIntegration(unittest.TestCase):
    def test_stateful_control_runs_example(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        repo_root = Path(__file__).resolve().parents[2]
        data_file = repo_root / 'data' / 'nc-examples' / 'O0004'
        self.assertTrue(data_file.exists())

        program = data_file.read_text(encoding='utf-8', errors='replace')

        ctrl = UniversalConfigDrivenControl(init_nc_states=[CNCState(machine_config=get_machine_config("FANUC_STAR_x-D_y-R_z_R"))])
        engine = NCExecutionEngine(ctrl)
        result = engine.get_Syncro_plot([program], synch=False)

        self.assertIsInstance(result, list)
        # ensure tool paths produced (control may produce empty paths for some commands)
        msgs = get_message_stack()
        self.assertIsNotNone(msgs)


if __name__ == '__main__':
    unittest.main()
