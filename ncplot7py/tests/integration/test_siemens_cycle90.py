import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle90():
    # CYCLE90(RTP, RFP, SDIS, DP, DPR, DIATH, KDIAM, PIT, FFR, CDIR, TYTH, CPA, CPO)
    # RTP=10, RFP=0, SDIS=2, DP=-10, DPR=None, DIATH=20, KDIAM=0, PIT=2, ... CPA=50, CPO=50
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE90(10, 0, 2, -10, , 20, 0, 2, 100, 2, 0, 50, 50)
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
    
    # Check helix points
    # Radius 10. Center 50,50.
    # Should have points at various Z levels with radius 10 from center.
    
    helix_points = [p for p in points if p.z < 0 and p.z > -10]
    for p in helix_points:
        dist = ((p.x - 50)**2 + (p.y - 50)**2)**0.5
        assert abs(dist - 10.0) < 0.1
