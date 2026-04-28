import sys
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
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
try:
    control.run_nc_code_list(nodes, 1)
except Exception as e:
    print(e)
for n in nodes:
    print(getattr(n, 'nc_code_line_nr', '?'), n.loop_command, getattr(n, '_next_ncCode', None))
