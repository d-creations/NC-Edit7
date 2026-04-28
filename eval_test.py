import sys
import os
sys.path.insert(0, os.path.join(os.getcwd(), 'src'))
from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
from ncplot7py.domain.cnc_state import CNCState

handler = ControlFlowHandler()
state = CNCState()
state.parameters['10'] = 2

# test evaluation of IF without brackets
print("Testing '_is_true' with #10LT9 :", handler._is_true('#10LT9', state))
