import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.handlers.variable import VariableHandler
from ncplot7py.domain.cnc_state import CNCState

code = """#142=0"""
parser = NCCommandStringParser()
node = parser.parse(code)
handler = VariableHandler()
state = CNCState()
state.parameters['142'] = 2.0
handler.handle(node, state)
print("After assignment:", state.parameters['142'])

