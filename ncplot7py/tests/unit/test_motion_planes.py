import math
import unittest

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.shared.nc_nodes import NCCommandNode


class TestMotionPlanes(unittest.TestCase):
    def test_modal_group_1_controls_axis_only_block(self):
        state = CNCState()
        state.feed_rate = 600.0
        state.set_modal("G_GROUP_1", "G00")

        node = NCCommandNode(g_code_command=set(), command_parameter={"X": "10.0", "Y": "5.0"})

        points, duration = MotionHandler().handle(node, state)

        self.assertIsNotNone(points)
        self.assertIsNotNone(duration)
        self.assertGreater(len(points), 1)
        self.assertAlmostEqual(state.get_axis("X"), 10.0)
        self.assertAlmostEqual(state.get_axis("Y"), 5.0)

    def test_g18_radius_arc_stays_in_xz_plane(self):
        state = CNCState()
        state.update_axes({"X": 2.0, "Y": 0.0, "Z": 0.0})
        state.feed_rate = 60.0
        state.extra["g_group_16_plane"] = "X_Z"

        node = NCCommandNode(g_code_command={"G2"}, command_parameter={"X": "0.0", "Z": "2.0", "R": "2.0"})

        points, duration = MotionHandler().handle(node, state)

        self.assertIsNotNone(duration)
        self.assertGreater(duration, 0.0)
        self.assertGreater(len(points), 2)
        self.assertAlmostEqual(state.get_axis("X"), 0.0)
        self.assertAlmostEqual(state.get_axis("Z"), 2.0)

        for point in points:
            self.assertAlmostEqual(point.y, 0.0, places=6)
            self.assertGreaterEqual(point.x, -1e-6)
            self.assertGreaterEqual(point.z, -1e-6)
            self.assertAlmostEqual(math.hypot(point.x, point.z), 2.0, places=6)

        mid = points[len(points) // 2]
        self.assertAlmostEqual(mid.x, math.sqrt(2.0), delta=0.25)
        self.assertAlmostEqual(mid.z, math.sqrt(2.0), delta=0.25)


if __name__ == "__main__":
    unittest.main()