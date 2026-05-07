import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.base_stateful_control import UniversalConfigDrivenCanal as UniversalConfigDrivenCanal
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle77():
    # CYCLE77(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, ...)
    # Same as POCKET2 test basically
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE77(10, 0, 2, -10, , 20, 50, 50)
    N30 M30
    """
    
    canal = UniversalConfigDrivenCanal("TestMill", init_state=CNCState(machine_config=get_machine_config("SIEMENS_840D")))
    parser = NCCommandStringParser()
    
    nodes = []
    for line in nc_code.strip().split('\n'):
        nodes.append(parser.parse(line.strip()))
        
    canal.run_nc_code_list(nodes)
    
    path = canal.get_tool_path()
    points = []
    for segment, duration in path:
        points.extend(segment)
        
    points_at_depth = [p for p in points if p.z == -10.0]
    assert len(points_at_depth) > 0
    
    # Check circle points (same as POCKET2 test)
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
