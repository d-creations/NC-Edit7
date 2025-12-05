import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_pocket2():
    # POCKET2(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, ...)
    # RTP=10, RFP=0, SDIS=2, DP=-10, DPR=None, PRAD=20, CPA=50, CPO=50
    
    nc_code = """
    N10 G17 G90 G54
    N20 POCKET2(10, 0, 2, -10, , 20, 50, 50)
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
    
    # Center (50, 50), Radius 20.
    # Check points on circle.
    # (70, 50), (30, 50), (50, 70), (50, 30)
    
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 50.0) < 0.1 and abs(p.y - 70.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 50.0) < 0.1 and abs(p.y - 30.0) < 0.1 for p in points_at_depth)
