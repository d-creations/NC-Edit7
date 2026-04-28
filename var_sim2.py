import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

code = """#142=2
#10=9
IF#10LT9GOTO300
#142=0
N300
G1 W#142"""

parser = NCCommandStringParser()
nodes = []
for line in code.strip().splitlines():
    if line.strip():
        nodes.append(parser.parse(line))

control = StatefulIsoTurnControl()
control.run_nc_code_list(nodes, 1)

print("AFTER RUN: W parameter of last node =", nodes[-1].command_parameter.get('W'))

