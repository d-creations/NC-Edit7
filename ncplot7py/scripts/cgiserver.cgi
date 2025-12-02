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


def get_machine_regex_patterns(control_type: str) -> Dict[str, Any]:
    """Return regex patterns for parsing NC code based on control type.

    Each machine has specific patterns for:
    - tools: Regular tool calls (e.g., T1-T99)
    - variables: Variable references (e.g., #1 - #999)
    - keywords: Special codes like M-codes and extended T-codes

    Returns a dictionary with pattern strings and descriptions.
    """
    # Base patterns common to most machines
    base_patterns = {
        "tools": {
            "pattern": r"T([1-9]|[1-9][0-9])(?!\d)",
            "description": "Tools T1-T99",
            "range": {"min": 1, "max": 99}
        },
        "variables": {
            "pattern": r"#([1-9]|[1-9][0-9]{1,2})(?!\d)",
            "description": "Variables #1 - #999",
            "range": {"min": 1, "max": 999}
        },
        "keywords": {
            "pattern": r"(T(100|[1-9][0-9]{2,3})|M(2[0-9]{2}|[3-8][0-8]{2})|M82|M83|M20|G[0-3]|M(0|1|3|5|30))",
            "description": "Keywords: T100-T9999, M200-M888, M82, M83, M20, G0-G3, M0, M1, M3, M5, M30",
            "codes": {
                "extended_tools": {"pattern": r"T(100|[1-9][0-9]{2,3})", "range": {"min": 100, "max": 9999}},
                "m_codes_range": {"pattern": r"M(2[0-9]{2}|[3-8][0-8]{2})", "range": {"min": 200, "max": 888}},
                "special_m_codes": ["M82", "M83", "M20"],
                "g_codes": ["G0", "G1", "G2", "G3"],
                "program_control": ["M0", "M1", "M3", "M5", "M30"]
            }
        }
    }

    # Patterns are currently the same for all control types
    # This structure allows future customization per control type if needed
    return base_patterns


def get_mock_machines() -> List[Dict[str, Any]]:
    """Return list of available machines with their regex patterns"""
    machines = [
        {"machineName": "ISO_MILL", "controlType": "MILL"},
        {"machineName": "FANUC_T", "controlType": "TURN"},
        {"machineName": "SB12RG_F", "controlType": "MILL"},
        {"machineName": "SB12RG_B", "controlType": "MILL"},
        {"machineName": "SR20JII_F", "controlType": "MILL"},
        {"machineName": "SR20JII_B", "controlType": "MILL"},
    ]

    # Add regex patterns to each machine
    for machine in machines:
        machine["regexPatterns"] = get_machine_regex_patterns(machine["controlType"])

    return machines


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
