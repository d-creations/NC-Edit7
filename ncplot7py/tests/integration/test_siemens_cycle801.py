import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle801():
    # CYCLE801(SPCA, SPCO, STA1, DIS1, DIS2, NUM1, NUM2)
    # SPCA=0, SPCO=0, STA1=0, DIS1=10, DIS2=10, NUM1=2, NUM2=2
    # Grid 2x2 starting at 0,0 with spacing 10.
    # Points: (0,0), (0,10), (10,0), (10,10)
    
    # Needs a modal cycle active. Let's use CYCLE81.
    
    nc_code = """
    N10 G17 G90 G54
    N20 MCALL CYCLE81(10, 0, 2, -5, 0)
    N30 CYCLE801(0, 0, 0, 10, 10, 2, 2)
    N40 M30
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
    
    # We expect 1 point from N20 (at current pos 0,0 probably)
    # And 4 points from N30.
    
    # Check grid points
    assert any(abs(p.x - 0.0) < 0.1 and abs(p.y - 0.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 0.0) < 0.1 and abs(p.y - 10.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 10.0) < 0.1 and abs(p.y - 0.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 10.0) < 0.1 and abs(p.y - 10.0) < 0.1 for p in points_at_depth)
