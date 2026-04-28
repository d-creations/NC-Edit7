import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

code = """#142=1
#10=1
WHILE[#10LT999]DO1
#10=#10+1
IF[#142GT0]GOTO200
#10=9999
G1W#142(LAST TIME WITH 0)
N200
IF#10LT9GOTO300
#142=0
N300
END1"""

try:
    parser = NCCommandStringParser()
    nodes = []
    for line in code.strip().splitlines():
        if line.strip():
            nodes.append(parser.parse(line))

    control = StatefulIsoTurnControl()
    control.run_nc_code_list(nodes, 1)

    print('10 =', nodes[0]._state.get_parameter('10') if hasattr(nodes[0], '_state') else "cannot read state")
except Exception as e:
    import traceback
    traceback.print_exc()

