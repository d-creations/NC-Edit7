"""Run a Siemens Mill Example."""
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser

class NCParser:
    def __init__(self):
        self.parser = NCCommandStringParser()
    
    def parse(self, code):
        nodes = []
        lines = code.strip().split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            
            # Remove comments
            if ';' in line:
                line = line.split(';')[0].strip()
            if '(' in line:
                # Simple handling: take everything before first '('
                line = line.split('(')[0].strip()
            
            if not line: continue
            
            # Skip % and O numbers if parser doesn't support them
            if line.startswith('%'): continue
            if line.startswith('O') and line[1:].isdigit(): continue

            node = self.parser.parse(line, i+1)
            nodes.append(node)
        return nodes

def main():
    code = """
    %
    O1000 (SIEMENS MILL TEST)
    G290 (SIEMENS MODE)
    G17 G90 G94 G54
    G0 X0 Y0 Z50
    
    (DRILLING CYCLE)
    G98 G81 X10 Y10 Z-5 R2 F200
    X20
    Y20
    G80
    
    (POLAR COORDINATES)
    G0 X0 Y0
    G16
    G1 X20 Y0 F500
    G3 X20 Y90 R20
    G15
    
    M30
    %
    """
    
    print("Parsing NC Code...")
    parser = NCParser()
    nodes = parser.parse(code)
    
    print("Initializing Control...")
    control = StatefulSiemensMillControl()
    
    print("Running Simulation...")
    control.run_nc_code_list(nodes, 1)
    
    path = control.get_tool_path(1)
    print(f"Simulation Complete. Generated {len(path)} path segments.")
    
    for i, (pts, dur) in enumerate(path):
        start = pts[0]
        end = pts[-1]
        print(f"Seg {i}: {start.x:.2f},{start.y:.2f},{start.z:.2f} -> {end.x:.2f},{end.y:.2f},{end.z:.2f} (Dur: {dur:.2f}s)")

if __name__ == "__main__":
    main()
