import math

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.shared.nc_nodes import NCCommandNode


def test_off_center_c_axis_move_plots_circle_about_z_axis():
    state = CNCState()
    state.update_axes({"X": 0.0, "Y": 50.0, "C": 0.0})
    state.feed_rate = 60.0

    node = NCCommandNode(g_code_command={"G1"}, command_parameter={"C": "180"})

    points, duration = MotionHandler().handle(node, state)

    assert duration and duration > 0.0
    assert len(points) > 2
    assert math.isclose(state.get_axis("X"), 0.0, abs_tol=1e-6)
    assert math.isclose(state.get_axis("Y"), 50.0, abs_tol=1e-6)
    assert math.isclose(state.get_axis("C"), 180.0, abs_tol=1e-6)
    assert math.isclose(points[0].x, 0.0, abs_tol=1e-6)
    assert math.isclose(points[0].y, 50.0, abs_tol=1e-6)
    assert math.isclose(points[-1].x, 0.0, abs_tol=1e-6)
    assert math.isclose(points[-1].y, -50.0, abs_tol=1e-6)
    assert any(abs(point.x) > 1.0 for point in points[1:-1])

    for point in points:
        radius = math.hypot(point.x, point.y)
        assert math.isclose(radius, 50.0, rel_tol=1e-6, abs_tol=1e-6)


def test_off_center_h_axis_move_is_incremental_c_rotation():
    state = CNCState()
    state.update_axes({"X": 0.0, "Y": 50.0, "C": 90.0})
    state.feed_rate = 60.0

    node = NCCommandNode(g_code_command={"G1"}, command_parameter={"H": "90"})

    points, duration = MotionHandler().handle(node, state)

    assert duration and duration > 0.0
    assert len(points) > 2
    assert math.isclose(state.get_axis("X"), 0.0, abs_tol=1e-6)
    assert math.isclose(state.get_axis("Y"), 50.0, abs_tol=1e-6)
    assert math.isclose(state.get_axis("C"), 180.0, abs_tol=1e-6)
    assert math.isclose(points[0].x, -50.0, abs_tol=1e-6)
    assert math.isclose(points[0].y, 0.0, abs_tol=1e-6)
    assert math.isclose(points[-1].x, 0.0, abs_tol=1e-6)
    assert math.isclose(points[-1].y, -50.0, abs_tol=1e-6)