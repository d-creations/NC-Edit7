import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_pocket1():
    # POCKET1(RTP, RFP, SDIS, DP, DPR, LENG, WID, CRAD, CPA, CPO, STA1, ...)
    # RTP=10, RFP=0, SDIS=2, DP=-10, DPR=None, LENG=40, WID=20, CRAD=0, CPA=50, CPO=50, STA1=0
    
    nc_code = """
    N10 G17 G90 G54
    N20 POCKET1(10, 0, 2, -10, , 40, 20, 0, 50, 50, 0)
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
        
    # Check for points at depth -10
    points_at_depth = [p for p in points if p.z == -10.0]
    assert len(points_at_depth) > 0
    
    # Center is (50, 50). Length 40, Width 20.
    # Corners:
    # (50-20, 50-10) = (30, 40)
    # (50+20, 50-10) = (70, 40)
    # (50+20, 50+10) = (70, 60)
    # (50-20, 50+10) = (30, 60)
    
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 40.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 40.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 60.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 60.0) < 0.1 for p in points_at_depth)
