import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle71():
    # CYCLE71(RTP, RFP, SDIS, DP, PA, PO, LENG, WID, STA, ...)
    # RTP=10, RFP=0, SDIS=2, DP=-5, PA=0, PO=0, LENG=100, WID=50, STA=0
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE71(10, 0, 2, -5, 0, 0, 100, 50, 0)
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
        
    # Check for points at depth -5
    points_at_depth = [p for p in points if p.z == -5.0]
    assert len(points_at_depth) > 0
    
    # Check bounds
    # PA=0, PO=0. LENG=100, WID=50.
    # Should cover 0,0 to 100,50 roughly.
    
    xs = [p.x for p in points_at_depth]
    ys = [p.y for p in points_at_depth]
    
    assert min(xs) >= -0.1
    assert max(xs) <= 100.1
    assert min(ys) >= -0.1
    assert max(ys) <= 50.1
