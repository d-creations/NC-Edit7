import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.machines import FANUC_GENERIC_CONFIG, MachineConfig, get_machine_config
from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenCanal


class TestMachineSetup(unittest.TestCase):
    def test_unknown_machine_name_falls_back_to_generic_config(self):
        config = get_machine_config("DOES_NOT_EXIST")

        self.assertIs(config, FANUC_GENERIC_CONFIG)
        self.assertEqual(config.name, "FANUC_GENERIC")

    def test_cnc_state_defaults_to_generic_machine_config(self):
        state = CNCState()

        self.assertIs(state.machine_config, FANUC_GENERIC_CONFIG)
        self.assertEqual(state.machine_config.name, "FANUC_GENERIC")

    def test_initial_plane_comes_from_machine_default_plane(self):
        custom_turn_mill = MachineConfig(
            name="TEST_TURN_MILL_G19",
            control_type="FANUC",
            variable_pattern=r'#(\d+)',
            variable_prefix='#',
            tool_range=(0, 99),
            machine_type="TURN_MILL",
            default_plane="G19",
            supported_gcode_groups=("motion",),
        )
        state = CNCState(machine_config=custom_turn_mill)

        canal = UniversalConfigDrivenCanal("C1", init_state=state)

        self.assertEqual(canal._state.extra["g_group_16_plane"], "Y_Z")


if __name__ == '__main__':
    unittest.main()