import pytest
from ncplot7py.shared.point import Point
from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillCanal
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

def test_siemens_cycle800():
    # CYCLE800(FR, TC, ST, MODE, X0, Y0, Z0, A, B, C, X1, Y1, Z1, DIR)
    # Just check it doesn't crash
    
    nc_code = """
    N10 G17 G90 G54
    N20 CYCLE800(0, "TABLE", 0, 57, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1)
    N30 M30
    """
    
    canal = StatefulSiemensMillCanal("TestMill")
    parser = NCCommandStringParser()
    
    nodes = []
    for line in nc_code.strip().split('\n'):
        nodes.append(parser.parse(line.strip()))
        
    canal.run_nc_code_list(nodes)
    
    # Should run without error
    assert True
