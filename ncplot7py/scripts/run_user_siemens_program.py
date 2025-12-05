"""Run the user's Siemens Mill Program."""
import sys
import os
import re
from typing import List, Optional, Tuple

# Add src to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillControl
from ncplot7py.infrastructure.parsers.nc_command_parser import NCCommandStringParser
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.exec_chain import Handler
from ncplot7py.domain.cnc_state import CNCState

class SiemensProceduresHandler(Handler):
    """Handle Siemens specific procedure calls like CYCLE800, POCKET4, etc."""
    
    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # Check if we have a special procedure call stored in variable_command
        cmd = node.variable_command
        if cmd and '(' in cmd and ')' in cmd:
            # It's likely a function call
            # Parse name and args
            match = re.match(r"([A-Z0-9_]+)\((.*)\)", cmd)
            if match:
                name = match.group(1)
                args_str = match.group(2)
                # Split args by comma, respecting quotes? Simple split for now
                args = [a.strip() for a in args_str.split(',')]
                
                print(f"Executing Siemens Cycle: {name} with args {args}")
                
                if name == "CYCLE81":
                    try:
                        rtp = float(args[0]) if args[0] else 0
                        rfp = float(args[1]) if args[1] else 0
                        sdis = float(args[2]) if args[2] else 0
                        dp = float(args[3]) if args[3] else 0
                        
                        state.extra["active_cycle"] = 81
                        state.extra["cycle_z"] = dp
                        state.extra["cycle_r"] = rfp + sdis
                    except Exception as e:
                        print(f"Error parsing CYCLE81 args: {e}")

                elif name == "CYCLE83":
                     state.extra["active_cycle"] = 83
                     try:
                        rfp = float(args[1]) if len(args)>1 and args[1] else 0
                        sdis = float(args[2]) if len(args)>2 and args[2] else 0
                        dp = float(args[3]) if len(args)>3 and args[3] else 0
                        state.extra["cycle_z"] = dp
                        state.extra["cycle_r"] = rfp + sdis
                     except:
                         pass

                elif name == "CYCLE800":
                    pass
                
                elif name == "POCKET4":
                    pass
                
                elif name == "CYCLE61":
                    pass

        # Handle MCALL
        if "MCALL" in node.g_code:
            if not cmd:
                state.extra["active_cycle"] = None
                print("MCALL Cancelled")
            else:
                print("MCALL Set")

        return self.next_handler.handle(node, state)

class CustomSiemensMillControl(StatefulSiemensMillControl):
    def __init__(self, count_of_canals=1):
        super().__init__(count_of_canals)
        
        # Modify the canal(s)
        for canal_id, canal in self._canals.items():
            # canal is StatefulSiemensMillCanal
            # It has _chain
            
            old_next = canal._chain.next_handler
            proc_handler = SiemensProceduresHandler(next_handler=old_next)
            canal._chain.next_handler = proc_handler


class CustomNCParser:
    def __init__(self):
        self.std_parser = NCCommandStringParser()
    
    def parse(self, code):
        nodes = []
        lines = code.strip().split('\n')
        for i, line in enumerate(lines):
            line = line.strip()
            if not line: continue
            
            # Remove comments
            if ';' in line:
                line = line.split(';')[0].strip()
            
            if not line: continue
            
            # Handle N numbers
            if re.match(r"^N\d+\s+", line):
                line = re.sub(r"^N\d+\s+", "", line)
            
            # Handle T="string"
            if 'T="' in line:
                line = re.sub(r'T="[^"]+"', '', line)
            
            # Handle MCALL
            is_mcall = False
            if line.startswith("MCALL"):
                is_mcall = True
                line = line[5:].strip() # Remove MCALL
            
            # Handle Cycle Calls: NAME(...)
            match = re.match(r"^([A-Z0-9_]+)\(.*\)", line)
            if match:
                node = NCCommandNode(
                    nc_code_line_nr=i+1,
                    variable_command=line # Store full call
                )
                if is_mcall:
                    node._g_code.add("MCALL")
                nodes.append(node)
                continue
            
            if is_mcall and not line:
                node = NCCommandNode(nc_code_line_nr=i+1)
                node._g_code.add("MCALL")
                nodes.append(node)
                continue

            # Standard Parse
            try:
                node = self.std_parser.parse(line, i+1)
                if is_mcall:
                    node._g_code.add("MCALL")
                nodes.append(node)
            except Exception as e:
                print(f"Error parsing line {i+1}: {line}")
        return nodes

def main():
    program_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'nc-examples', 'user_siemens_program.mpf')
    
    if not os.path.exists(program_path):
        print(f"Error: File not found at {program_path}")
        return

    print(f"Reading program from {program_path}...")
    with open(program_path, 'r') as f:
        code = f.read()

    print("Initializing Custom Siemens Mill Control...")
    control = CustomSiemensMillControl(count_of_canals=1)
    parser = CustomNCParser()

    print("Parsing NC code...")
    nodes = parser.parse(code)
    print(f"Parsed {len(nodes)} commands.")

    print("Running simulation...")
    try:
        control.run_nc_code_list(nodes, 1)
        print("Simulation completed successfully.")
        
        path = control.get_tool_path(1)
        print(f"Generated {len(path)} toolpath segments.")
        
        if path:
            print("First 3 segments:")
            for i in range(min(3, len(path))):
                print(f"  Segment {i}: {path[i]}")
            
            print("Last 3 segments:")
            for i in range(max(0, len(path)-3), len(path)):
                print(f"  Segment {i}: {path[i]}")

    except Exception as e:
        print("Error during simulation:")
        print(e)
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
