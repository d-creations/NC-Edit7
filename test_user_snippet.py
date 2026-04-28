import sys
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
try:
    code = """#10=1
#142=1
WHILE[#10LT999]DO1
#10=#10+1
IF[#142GT0]GOTO200
#10=9999
G1 W#142
N200
IF[#10LT9]GOTO300
#142=0
N300
END1"""
    control = StatefulIsoTurnControl()
    nodes = control._parse(code)
    control.run_nc_code_list(nodes, 1)
    print('10 =', control._state.get_parameter('10'))
    print('142 =', control._state.get_parameter('142'))
except Exception as e:
    import traceback
    traceback.print_exc()
