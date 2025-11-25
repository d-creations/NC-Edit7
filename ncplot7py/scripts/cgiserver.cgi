#!/usr/bin/env python3
"""
CGI Server for NC-Edit7 Plot Interface
Handles machine data requests and returns plot data
"""

import sys
import json
import os
from typing import Dict, List, Any, Optional

# Set content type for CGI
print("Content-Type: application/json")
print()


def get_mock_machines() -> List[Dict[str, str]]:
    """Return list of available machines"""
    return [
        {"machineName": "ISO_MILL", "controlType": "MILL"},
        {"machineName": "FANUC_T", "controlType": "TURN"},
        {"machineName": "SB12RG_F", "controlType": "MILL"},
        {"machineName": "SB12RG_B", "controlType": "MILL"},
        {"machineName": "SR20JII_F", "controlType": "MILL"},
        {"machineName": "SR20JII_B", "controlType": "MILL"},
    ]


def parse_nc_program(program: str, machine_name: str) -> Dict[str, Any]:
    """
    Parse NC program and generate mock plot data
    In production, this would call the actual NC parser
    """
    lines = [line.strip() for line in program.split('\n') if line.strip()]
    
    # Generate mock plot segments
    segments = []
    current_pos = {"x": 0, "y": 0, "z": 0}
    
    for i, line in enumerate(lines):
        # Simple G-code parsing for demo
        if line.startswith('G0') or line.startswith('G1'):
            # Extract coordinates
            new_pos = current_pos.copy()
            
            parts = line.split()
            for part in parts:
                if part.startswith('X'):
                    try:
                        new_pos['x'] = float(part[1:])
                    except ValueError:
                        pass
                elif part.startswith('Y'):
                    try:
                        new_pos['y'] = float(part[1:])
                    except ValueError:
                        pass
                elif part.startswith('Z'):
                    try:
                        new_pos['z'] = float(part[1:])
                    except ValueError:
                        pass
            
            # Create segment
            segment = {
                "type": "RAPID" if line.startswith('G0') else "LINEAR",
                "lineNumber": i + 1,
                "toolNumber": 1,
                "points": [
                    current_pos.copy(),
                    new_pos.copy()
                ]
            }
            segments.append(segment)
            current_pos = new_pos
    
    return {
        "segments": segments,
        "executedLines": list(range(1, len(lines) + 1)),
        "variables": {},
        "timing": [0.1] * len(lines)
    }


def handle_list_machines() -> Dict[str, Any]:
    """Handle machine list request"""
    return {
        "machines": get_mock_machines(),
        "success": True
    }


def handle_execute_programs(programs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Handle program execution request"""
    canal_results = {}
    messages = []
    
    for program_entry in programs:
        program = program_entry.get("program", "")
        machine_name = program_entry.get("machineName", "ISO_MILL")
        canal_nr = program_entry.get("canalNr", "1")
        
        # Validate machine name
        valid_machines = ["SB12RG_F", "FANUC_T", "SR20JII_F", "SB12RG_B", "SR20JII_B", "ISO_MILL"]
        if machine_name not in valid_machines:
            messages.append(f"Invalid machine name: {machine_name}")
            continue
        
        # Parse program
        try:
            result = parse_nc_program(program, machine_name)
            canal_results[canal_nr] = result
            messages.append(f"Successfully processed {machine_name} canal {canal_nr}")
        except Exception as e:
            messages.append(f"Error processing {machine_name} canal {canal_nr}: {str(e)}")
    
    return {
        "canal": canal_results,
        "message": messages,
        "success": True
    }


def main():
    """Main CGI entry point"""
    try:
        # Get request method
        request_method = os.environ.get("REQUEST_METHOD", "GET")
        
        if request_method != "POST":
            response = {
                "error": "Only POST requests are supported",
                "message_TEST": ["Method not allowed"]
            }
            print(json.dumps(response))
            return
        
        # Read POST data
        content_length = int(os.environ.get("CONTENT_LENGTH", 0))
        if content_length == 0:
            response = {
                "error": "Empty request body",
                "message_TEST": ["No data provided"]
            }
            print(json.dumps(response))
            return
        
        post_data = sys.stdin.read(content_length)
        request_data = json.loads(post_data)
        
        # Handle different request types
        if "action" in request_data:
            action = request_data["action"]
            
            if action in ["list_machines", "get_machines"]:
                response = handle_list_machines()
            else:
                response = {
                    "error": f"Unknown action: {action}",
                    "message_TEST": [f"Invalid action: {action}"]
                }
        
        elif "machinedata" in request_data:
            programs = request_data["machinedata"]
            response = handle_execute_programs(programs)
        
        elif isinstance(request_data, list):
            # Direct array format
            response = handle_execute_programs(request_data)
        
        else:
            response = {
                "error": "Invalid request format",
                "message_TEST": ["Request must contain 'action' or 'machinedata'"]
            }
        
        # Return response
        print(json.dumps(response))
    
    except json.JSONDecodeError as e:
        response = {
            "error": "Invalid JSON",
            "message_TEST": [f"JSON parse error: {str(e)}"]
        }
        print(json.dumps(response))
    
    except Exception as e:
        response = {
            "error": "Internal server error",
            "message_TEST": [f"Server error: {str(e)}"]
        }
        print(json.dumps(response))


if __name__ == "__main__":
    main()
