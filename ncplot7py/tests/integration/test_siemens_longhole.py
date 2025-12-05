import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_longhole():
    # LONGHOLE(RTP, RFP, SDIS, DP, DPR, NUM, LENG, CPA, CPO, RAD, STA1, INDA)
    # RTP=10, RFP=0, SDIS=2, DP=-5, DPR=None, NUM=2, LENG=20, CPA=50, CPO=50, RAD=30, STA1=0, INDA=180
    
    nc_code = """
    N10 G17 G90 G54
    N20 LONGHOLE(10, 0, 2, -5, , 2, 20, 50, 50, 30, 0, 180)
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
    
    # We expect 2 longholes.
    # Hole 1: Angle 0. Center (50+30, 50) = (80, 50). Length 20.
    # Radial alignment.
    # Start: 80 - 10 = 70, 50.
    # End: 80 + 10 = 90, 50.
    
    # Hole 2: Angle 180. Center (50-30, 50) = (20, 50). Length 20.
    # Radial alignment.
    # Start: 20 - (-10) = 30, 50? No, direction is radial from center?
    # Angle 180 direction is (-1, 0).
    # Center is (20, 50).
    # Vector is (-1, 0).
    # P1 = Center - (L/2)*Vector = (20, 50) - 10*(-1, 0) = (30, 50).
    # P2 = Center + (L/2)*Vector = (20, 50) + 10*(-1, 0) = (10, 50).
    
    # Check for points at depth -5
    points_at_depth = [p for p in points if p.z == -5.0]
    assert len(points_at_depth) > 0
    
    # Check Hole 1
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 90.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    
    # Check Hole 2
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 10.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
