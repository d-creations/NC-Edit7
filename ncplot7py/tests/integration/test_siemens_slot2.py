import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_slot2_circumferential():
    # SLOT2(RTP, RFP, SDIS, DP, DPR, NUM, AFSL, WID, CPA, CPO, RAD, STA1, INDA)
    # RTP=10, RFP=0, SDIS=2, DP=-5, DPR=None, NUM=2, AFSL=45, WID=10, CPA=50, CPO=50, RAD=20, STA1=0, INDA=90
    
    nc_code = """
    N10 G17 G90 G54
    N20 SLOT2(10, 0, 2, -5, , 2, 45, 10, 50, 50, 20, 0, 90)
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
    
    # We expect 2 slots.
    # Slot 1: Start Angle 0, Length Angle 45. Center (50, 50), Radius 20.
    # Start Point: 50+20*cos(0)=70, 50+20*sin(0)=50.
    # End Point: 50+20*cos(45)=64.14, 50+20*sin(45)=64.14.
    
    # Slot 2: Start Angle 90, Length Angle 45.
    # Start Point: 50+20*cos(90)=50, 50+20*sin(90)=70.
    # End Point: 50+20*cos(135)=35.86, 50+20*sin(135)=64.14.
    
    # Check for points at depth -5
    points_at_depth = [p for p in points if p.z == -5.0]
    assert len(points_at_depth) > 0
    
    # Check approximate coordinates for Slot 1 start/end
    # Start
    assert any(abs(p.x - 70.0) < 0.1 and abs(p.y - 50.0) < 0.1 for p in points_at_depth)
    # End
    assert any(abs(p.x - 64.14) < 0.1 and abs(p.y - 64.14) < 0.1 for p in points_at_depth)
    
    # Check approximate coordinates for Slot 2 start/end
    # Start
    assert any(abs(p.x - 50.0) < 0.1 and abs(p.y - 70.0) < 0.1 for p in points_at_depth)
    # End
    assert any(abs(p.x - 35.86) < 0.1 and abs(p.y - 64.14) < 0.1 for p in points_at_depth)
