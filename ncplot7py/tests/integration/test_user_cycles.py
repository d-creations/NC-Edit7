import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_cycle61_behavior():
    # From user_siemens_program.mpf:
    # N108 CYCLE61(35.8,25.88,5,0,0,0,102,105,2,80,0.2,3000,31,0,1,11010)
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE61(35.8, 25.88, 5, 0, 0, 0, 102, 105, 2, 80, 0.2, 3000, 31, 0, 1, 11010)
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
        
    # If CYCLE61 is not implemented, points might be empty or just start/end
    # If implemented as Face Milling, we expect points at DP=0
    
    points_at_depth = [p for p in points if abs(p.z - 0.0) < 0.001]
    
    # Currently expected to fail or return 0 points if not implemented
    if len(points_at_depth) == 0:
        print("CYCLE61 produced no points at depth 0")
    else:
        print(f"CYCLE61 produced {len(points_at_depth)} points at depth 0")
        
    # We want to assert that it DOES produce points once fixed
    assert len(points_at_depth) > 0

def test_pocket4_behavior():
    # From user_siemens_program.mpf:
    # N113 POCKET4(10,0,2,15,40,50,51.75,2,0.1,0.1,2000,2000,0,21,50,9,15,6,1,0,1,2,10100,111,111)
    
    nc_code = """
    N10 G17 G90 G54
    N20 POCKET4(10, 0, 2, 15, 40, 50, 51.75, 2, 0.1, 0.1, 2000, 2000, 0, 21, 50, 9, 15, 6, 1, 0, 1, 2, 10100, 111, 111)
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
        
    # Check Z levels
    zs = sorted(list(set([p.z for p in points])))
    print(f"POCKET4 Z levels: {zs}")
    
    # If DP=15, we expect points at Z=15
    points_at_15 = [p for p in points if abs(p.z - 15.0) < 0.001]
    print(f"Points at Z=15: {len(points_at_15)}")
    
    # If it's a pocket, it should have some width (PRAD=50)
    if len(points_at_15) > 0:
        xs = [p.x for p in points_at_15]
        ys = [p.y for p in points_at_15]
        print(f"X range: {min(xs)} to {max(xs)}")
        print(f"Y range: {min(ys)} to {max(ys)}")
