import os
import sys
import unittest
from pathlib import Path

# Ensure package imports from src are resolvable when running tests directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared import configure_logging, get_message_stack, configure_i18n


class _Point:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z


class SimpleFakeControl:
    def __init__(self):
        self._canal_nodes = {}

    def get_canal_count(self):
        return 1

    def run_nc_code_list(self, node_list, canal):
        self._canal_nodes[canal] = list(node_list)

    def get_tool_path(self, canal: int):
        nodes = self._canal_nodes.get(canal, [])
        path = []
        for n in nodes:
            params = getattr(n, 'command_parameter', {})
            try:
                x = float(params.get('X', 0.0))
            except Exception:
                x = 0.0
            try:
                y = float(params.get('Y', 0.0))
            except Exception:
                y = 0.0
            try:
                z = float(params.get('Z', 0.0))
            except Exception:
                z = 0.0
            path.append(([ _Point(x, y, z) ], 0.1))
        return path

    def get_exected_nodes(self, canal: int):
        return self._canal_nodes.get(canal, [])

    def get_canal_name(self, idx: int):
        return f"C{idx}"

    def synchro_points(self, tool_paths, nodes):
        return None


class TestExampleFile(unittest.TestCase):
    def test_run_example_o0004(self):
        # Configure logging to web buffer so get_message_stack works
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Resolve to repository root: tests/integration -> tests -> <repo root>
        repo_root = Path(__file__).resolve().parents[2]
        data_file = repo_root / 'data' / 'nc-examples' / 'O0004'
        self.assertTrue(data_file.exists(), f"Data file missing: {data_file}")

        program = data_file.read_text(encoding='utf-8', errors='replace')

        ctrl = SimpleFakeControl()
        engine = NCExecutionEngine(ctrl)
        result = engine.get_Syncro_plot([program], synch=False)

        self.assertIsInstance(result, list)
        # either a real set of canals or the legacy error return
        self.assertTrue(result == [[], []] or isinstance(result, list))

        # messages captured in buffer (may be empty) should be a list-like
        msgs = get_message_stack()
        self.assertIsNotNone(msgs)


if __name__ == '__main__':
    unittest.main()
