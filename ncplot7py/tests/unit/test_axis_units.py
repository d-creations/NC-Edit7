from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.shared.nc_nodes import NCCommandNode


def test_linear_conversion_diameter_x():
    state = CNCState()
    state.set_axis("X", 0.0)
    state.set_axis_unit("X", "diameter")

    node = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "10"})
    mh = MotionHandler()
    points, duration = mh.handle(node, state)

    assert state.get_axis("X") == 5.0
    assert points[-1].x == 5.0


def test_negative_diameter_conversion():
    state = CNCState()
    state.set_axis("X", 0.0)
    state.set_axis_unit("X", "diameter")

    node = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "-8"})
    mh = MotionHandler()
    points, duration = mh.handle(node, state)

    assert state.get_axis("X") == -4.0
    assert points[-1].x == -4.0
