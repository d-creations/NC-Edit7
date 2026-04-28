import sys
sys.path.insert(0, "src")
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.handlers.variable import VariableHandler, CNCState

parser = NCCommandStringParser()
line = "#29=FIX[2/[6*[0.1+0.2]]]"
node = parser.parse(line)
print("NODE VAR CMD:", repr(node.variable_command))
print("G CODE:", node.g_code)
print("PARAMS:", node.command_parameter)

state = CNCState()
v = VariableHandler()
v.handle(node, state)
print("VAR 29 =", state.parameters.get("29"))
