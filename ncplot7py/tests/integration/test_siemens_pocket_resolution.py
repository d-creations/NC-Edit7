import pytest
import math
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_pocket4_resolution():
    # POCKET4(RTP, RFP, SDIS, DP, DPR, PRAD, CPA, CPO, ...)
    # Large Radius: PRAD=50
    # We expect high number of points due to adaptive resolution
    
    nc_code = """
    N10 G17 G90 G54
    N20 POCKET4(10, 0, 2, -10, 0, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
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
        
    # Filter points at depth -10 (the pocket bottom)
    points_at_depth = [p for p in points if p.z == -10.0]
    
    # Circumference = 2 * pi * 50 = 314.159 mm
    # Segment length = 0.1 mm
    # Expected steps approx 3141
    
    print(f"Points at depth: {len(points_at_depth)}")
    
    # Assert we have at least 2000 points (allowing for some margin)
    # Previously it was ~36 points
    assert len(points_at_depth) > 2000

def test_siemens_slot2_resolution():
    # SLOT2(RTP, RFP, SDIS, DP, DPR, NUM, AFSL, WID, CPA, CPO, RAD, STA1, INDA)
    # Large Arc Slot
    # RAD=50, AFSL=180 (Half circle)
    
    nc_code = """
    N10 G17 G90 G54
    N20 SLOT2(10, 0, 2, -10, 0, 1, 180, 10, 0, 0, 50, 0, 0)
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
    
    # Arc Length = pi * 50 = 157 mm
    # Segment length = 0.1 mm
    # Expected steps approx 1570
    
    print(f"Slot points at depth: {len(points_at_depth)}")
    
    assert len(points_at_depth) > 1000
