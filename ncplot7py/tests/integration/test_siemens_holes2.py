import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_holes2():
    # HOLES2(CPA, CPO, RAD, STA1, INDA, NUM)
    # CPA=50, CPO=50, RAD=20, STA1=0, INDA=90, NUM=4
    # Circle center (50,50), Radius 20. 4 holes at 0, 90, 180, 270.
    
    nc_code = """
    N10 G17 G90 G54
    N20 MCALL CYCLE81(10, 0, 2, -5, 0)
    N30 HOLES2(50, 50, 20, 0, 90, 4)
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
    
    # (70, 50), (50, 70), (30, 50), (50, 30)
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 50.0) < 0.1 and abs(p.y - 70.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 30.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    assert any(abs(p.x - 50.0) < 0.1 and abs(p.y - 30.0) < 0.1 for p in points_at_depth)
