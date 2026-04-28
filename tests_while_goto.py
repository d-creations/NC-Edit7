import pytest
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl

def test_while_goto_integration():
    code = """
#10=0
#142=2
#143=0
WHILE[#10LT99]DO1
#10=#10+6*[#142+#143]
IF[#142GT0]GOTO400
#10=9999
N400
END1
    """
    control = StatefulIsoTurnControl()
    nodes = control._parse(code)
    control.run_nc_code_list(nodes, 1)
    # the loop terminates. #10 goes beyond 99.
    val10 = control._state.get_parameter("10")
    assert val10 > 99
