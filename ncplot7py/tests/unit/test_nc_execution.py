import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine


class _Point:
    def __init__(self, x, y, z):
        self.x = x
        self.y = y
        self.z = z


class _Node:
    def __init__(self, nr):
        self.nc_code_line_nr = nr


class FakeControlHappy:
    def __init__(self):
        self._ran = []

    def get_canal_count(self):
        return 1

    def run_nc_code_list(self, node_list, canal):
        # accept list of nodes
        self._ran.append((list(node_list), canal))

    def get_tool_path(self, canal: int):
        # return two lines: first with one point and time 0.5, second with one point and time 1.0
        return [([_Point(1, 1, 1)], 0.5), ([_Point(2, 2, 2)], 1.0)]

    def get_exected_nodes(self, canal: int):
        return [_Node(0), _Node(1)]

    def get_canal_name(self, idx: int):
        return f"C{idx}"

    def synchro_points(self, tool_paths, nodes):
        # no-op
        return None


class FakeControlError:
    def get_canal_count(self):
        return 1

    def run_nc_code_list(self, node_list, canal):
        # raise a generic error
        raise RuntimeError("control failed")


class TestNCExecutionEngine(unittest.TestCase):
    def test_happy_path_returns_plot_structure(self):
        ctrl = FakeControlHappy()
        engine = NCExecutionEngine(ctrl)
        programs = ["G1 X1 Y1 Z1;G1 X2 Y2 Z2"]
        result = engine.get_Syncro_plot(programs, synch=False)
        # one canal
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        canal = result[0]
        self.assertIn("plot", canal)
        self.assertEqual(canal["canalNr"], "C0")
        plot = canal["plot"]
        self.assertEqual(len(plot), 2)
        self.assertEqual(plot[0]["x"], [1])
        self.assertEqual(plot[0]["y"], [1])
        self.assertEqual(plot[0]["z"], [1])
        self.assertEqual(plot[0]["t"], 0.5)
        self.assertEqual(plot[1]["x"], [2])
        self.assertEqual(canal["programExec"], [0, 1])

    def test_control_error_returns_empty_lists(self):
        ctrl = FakeControlError()
        engine = NCExecutionEngine(ctrl)
        programs = ["G1 X1 Y1 Z1"]
        result = engine.get_Syncro_plot(programs, synch=False)
        self.assertEqual(result, [[], []])


if __name__ == "__main__":
    unittest.main()
