import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle76():
    # CYCLE76(RTP, RFP, SDIS, DP, DPR, LENG, WID, CRAD, CPA, CPO, STA1, ...)
    # Same as POCKET1 test basically
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE76(10, 0, 2, -10, , 40, 20, 0, 50, 50, 0)
    N30 M30
    """
    
    canal = StatefulSiemensMillCanal("TestMill")
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
    
    # Check corners (same as POCKET1 test)
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 40.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 40.0) < 0.1 for p in points_at_depth)
