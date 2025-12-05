import pytest
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.domain.handlers.siemens_mill_cnc.cycles_handler import SiemensISOCyclesHandler
from ncplot7py.shared.nc_nodes import NCCommandNode

# I will need to mock the chain or use the real one.
# For now, I'll just test the handler logic if I can instantiate it.

def test_parse_cycle81():
    parser = NCCommandStringParser()
    # CYCLE81(RTP, RFP, SDIS, DP, DPR)
    # Example: CYCLE81(10, 0, 2, -20, 0)
    line = "N10 CYCLE81(10, 0, 2, -20, 0)"
    node = parser.parse(line)
    
    assert "CYCLE81(10,0,2,-20,0)" in node.variable_command or "CYCLE81" in str(node.variable_command)
    # The parser might have masked it. Let's check what the parser produces.
    print(f"Variable command: {node.variable_command}")

if __name__ == "__main__":
    test_parse_cycle81()
