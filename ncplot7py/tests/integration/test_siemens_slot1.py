import pytest
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_slot1_execution():
    canal = StatefulSiemensMillCanal("TestCanal")
    parser = NCCommandStringParser()
    
    # SLOT1(RTP=10, RFP=0, SDIS=2, DP=-10, DPR=0, NUM=4, LENG=20, WID=10, CPA=50, CPO=50, RAD=30, STA1=0, INDA=90)
    # 4 slots on circle radius 30 at 50,50.
    # Slot 1 at 0 deg (X=80, Y=50). Length 20.
    # Slot 2 at 90 deg (X=50, Y=80).
    # Slot 3 at 180 deg (X=20, Y=50).
    # Slot 4 at 270 deg (X=50, Y=20).
    
    code = """
    N10 G0 X0 Y0 Z100
    N20 SLOT1(10, 0, 2, -10, 0, 4, 20, 10, 50, 50, 30, 0, 90)
    N30 M30
    """
    
    nodes = []
    for line in code.strip().split('\n'):
        node = parser.parse(line.strip())
        nodes.append(node)
        
    canal.run_nc_code_list(nodes)
    
    path = canal.get_tool_path()
    points = []
    for segment, duration in path:
        points.extend(segment)
        
    # Check for Z=-10
    zs = [p.z for p in points]
    assert -10.0 in zs
    
    # Check approximate X/Y
    # Slot 1 center is 80, 50.
    # Slot 1 ends are 80 +/- 10, 50 => (70, 50) and (90, 50).
    
    xs = [p.x for p in points if p.z == -10.0]
    ys = [p.y for p in points if p.z == -10.0]
    
    print(f"Xs: {xs}")
    print(f"Ys: {ys}")
    
    # Check for 70 and 90 in X (approx)
    found_70 = any(abs(x - 70) < 0.1 for x in xs)
    found_90 = any(abs(x - 90) < 0.1 for x in xs)
    
    assert found_70
    assert found_90

if __name__ == "__main__":
    test_slot1_execution()
