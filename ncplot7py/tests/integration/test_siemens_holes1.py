import pytest
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_holes1_execution():
    canal = StatefulSiemensMillCanal("TestCanal")
    parser = NCCommandStringParser()
    
    code = """
    N10 G0 X0 Y0 Z100
    N20 MCALL CYCLE81(10, 0, 2, -10, 0)
    N30 HOLES1(0, 0, 0, 10, 10, 3)
    N40 MCALL
    N50 M30
    """
    # HOLES1(SPCA=0, SPCO=0, STA1=0, FDIS=10, DBH=10, NUM=3)
    # Angle 0.
    # Hole 1: dist = 10 + 0*10 = 10. X=10, Y=0.
    # Hole 2: dist = 10 + 1*10 = 20. X=20, Y=0.
    # Hole 3: dist = 10 + 2*10 = 30. X=30, Y=0.
    
    nodes = []
    for line in code.strip().split('\n'):
        node = parser.parse(line.strip())
        print(f"Line: {line.strip()}, VarCmd: {node.variable_command}")
        nodes.append(node)
        
    canal.run_nc_code_list(nodes)
    
    path = canal.get_tool_path()
    points = []
    for segment, duration in path:
        points.extend(segment)
        
    # Check X coordinates where Z goes down to -10
    drilled_x = []
    for p in points:
        if p.z == -10.0:
            drilled_x.append(p.x)
            
    print(f"Drilled X: {drilled_x}")
    
    assert 10.0 in drilled_x
    assert 20.0 in drilled_x
    assert 30.0 in drilled_x
    assert len(drilled_x) == 3

if __name__ == "__main__":
    test_holes1_execution()
