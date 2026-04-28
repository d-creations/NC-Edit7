import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
import logging
logging.basicConfig(level=logging.DEBUG)

from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

code = """#10=1
#142=2
WHILE[#10LT11]DO1
#10=#10+1
IF[#142GT0]GOTO200
#10=9999
G1 W#142
N200
IF[#10LT9]GOTO300
#142=0
N300
END1"""

parser = NCCommandStringParser()
nodes = []
for line in code.strip().splitlines():
    if line.strip():
        nodes.append(parser.parse(line))

control = StatefulIsoTurnControl()
control.run_nc_code_list(nodes, 1)
