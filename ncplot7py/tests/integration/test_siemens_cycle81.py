import pytest
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.shared.point import Point

def test_cycle81_execution():
    canal = StatefulSiemensMillCanal("TestCanal")
    parser = NCCommandStringParser()
    
    code = """
    N10 G0 X0 Y0 Z100
    N20 CYCLE81(10, 0, 2, -20, 0)
    N30 M30
    """
    
    nodes = []
    for line in code.strip().split('\n'):
        nodes.append(parser.parse(line.strip()))
        
    canal.run_nc_code_list(nodes)
    
    # Check tool path
    path = canal.get_tool_path()
    # Flatten path
    points = []
    for segment, duration in path:
        points.extend(segment)
        
    # Expected points:
    # 1. G0 X0 Y0 Z100 (from N10)
    # 2. CYCLE81:
    #    - Rapid to RFP+SDIS = 0+2 = 2 (Z=2)
    #    - Feed to DP = -20 (Z=-20)
    #    - Rapid to RTP = 10 (Z=10)
    
    # Note: N10 sets Z=100.
    # CYCLE81 starts.
    # Move to Z=2 (Rapid)
    # Move to Z=-20 (Feed)
    # Move to Z=10 (Rapid)
    
    # Let's verify Z coordinates
    z_coords = [p.z for p in points]
    print(f"Z coords: {z_coords}")
    
    # Check sequence roughly
    # We expect Z to go down to -20 and back to 10
    assert -20.0 in z_coords
    assert 10.0 in z_coords

if __name__ == "__main__":
    test_cycle81_execution()
