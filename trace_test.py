import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
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
visited = set()
execution_path = []

# Instrument run loop manually to see nodes visited
state = control._state
chain = control._chain

# prepare map
for n in nodes:
    chain._eval_helper.handle(n, state)

control._chain._nodes = nodes
from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
flow = None
for h in [control._chain]:
    curr = h
    while cur := getattr(curr, 'next_handler', None):
        curr = cur
        if isinstance(curr, ControlFlowHandler):
            flow = curr
            break
control._current_node = nodes[0]
control._run_context = True

print("Starting execution...")
while control._current_node:
    n = control._current_node
    param = getattr(n, 'command_parameter', {})
    print(f"[{n.nc_code_line_nr}] {n.g_code_command} {param} {n.loop_command}")
    control._chain.handle(n, state)
    
    # print state vars
    print("  #10 =", state.parameters.get('10'), "#142 =", state.parameters.get('142'))

    control._current_node = getattr(n, '_next_ncCode', None)

