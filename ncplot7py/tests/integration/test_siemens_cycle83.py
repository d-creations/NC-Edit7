import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle83():
    # CYCLE83(RTP, RFP, SDIS, DP, DPR, FDEP, FDPR, DAM, DTB, DTS, FRF, VARI)
    # RTP=10, RFP=0, SDIS=2, DP=-30, DPR=None, ...
    # Depth is 30. Logic says if depth > 10, it pecks.
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE83(10, 0, 2, -30, 0, 10, 0, 5, 0, 0, 1, 0)
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
        
    # Check for points at depth -30
    points_at_depth = [p for p in points if p.z == -30.0]
    assert len(points_at_depth) > 0
    
    # Check for intermediate pecks (approximate logic)
    # Start Z = 2. Final Z = -30. Depth = 32.
    # Logic: start_z - depth/3 = 2 - 10.66 = -8.66
    # start_z - 2*depth/3 = 2 - 21.33 = -19.33
    
    peck1 = [p for p in points if abs(p.z - (-8.66)) < 1.0]
    peck2 = [p for p in points if abs(p.z - (-19.33)) < 1.0]
    
    assert len(peck1) > 0
    assert len(peck2) > 0
