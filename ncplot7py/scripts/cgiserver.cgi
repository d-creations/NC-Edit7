#!/usr/bin/env python3
"""
CGI Server for NC-Edit7 Plot Generation

This script handles HTTP requests to process NC code and return plot data
for 3D visualization in the NC-Edit7 application.
"""

import json
import os
import sys
import re
from typing import Dict, List, Any


def parse_nc_code(program: str) -> Dict[str, Any]:
    """
    Parse NC code and generate plot data for 3D visualization.
    
    Args:
        program: The NC program code as a string
        
    Returns:
        Dictionary containing plot points and segments
    """
    points: List[Dict[str, Any]] = []
    segments: List[Dict[str, Any]] = []
    
    # Current position
    x, y, z = 0.0, 0.0, 0.0
    
    # Parse NC code line by line
    lines = program.replace(';', '\n').split('\n')
    line_number = 0
    
    # Movement mode: G00 = rapid, G01 = feed
    mode = 'rapid'
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        line_number += 1
        
        # Detect movement mode using word boundary regex for precise matching
        g0_match = re.search(r'\bG0+\b', line, re.IGNORECASE)
        g1_match = re.search(r'\bG0*1\b', line, re.IGNORECASE)
        g2_match = re.search(r'\bG0*2\b', line, re.IGNORECASE)
        g3_match = re.search(r'\bG0*3\b', line, re.IGNORECASE)
        
        if g0_match:
            mode = 'rapid'
        elif g1_match:
            mode = 'feed'
        elif g2_match:
            mode = 'arc'
        elif g3_match:
            mode = 'arc'
        
        # Extract coordinates
        prev_x, prev_y, prev_z = x, y, z
        
        x_match = re.search(r'X\s*(-?\d+\.?\d*)', line, re.IGNORECASE)
        y_match = re.search(r'Y\s*(-?\d+\.?\d*)', line, re.IGNORECASE)
        z_match = re.search(r'Z\s*(-?\d+\.?\d*)', line, re.IGNORECASE)
        
        if x_match:
            x = float(x_match.group(1))
        if y_match:
            y = float(y_match.group(1))
        if z_match:
            z = float(z_match.group(1))
        
        # Only add segment if position changed
        if (x != prev_x or y != prev_y or z != prev_z):
            start_point = {'x': prev_x, 'y': prev_y, 'z': prev_z, 'lineNumber': line_number}
            end_point = {'x': x, 'y': y, 'z': z, 'lineNumber': line_number}
            
            # Add start point if not already added
            if not points or (points[-1]['x'] != prev_x or points[-1]['y'] != prev_y or points[-1]['z'] != prev_z):
                points.append(start_point)
            
            points.append(end_point)
            
            segments.append({
                'startPoint': start_point,
                'endPoint': end_point,
                'type': mode,
                'toolNumber': 1
            })
    
    return {
        'points': points,
        'segments': segments
    }


def handle_list_machines() -> Dict[str, Any]:
    """Return a list of available machine profiles."""
    return {
        'machines': [
            {'machineName': 'SB12RG_F', 'controlType': 'Fanuc'},
            {'machineName': 'FANUC_T', 'controlType': 'Fanuc'},
            {'machineName': 'SR20JII_F', 'controlType': 'Fanuc'},
            {'machineName': 'SB12RG_B', 'controlType': 'Siemens'},
            {'machineName': 'SR20JII_B', 'controlType': 'Siemens'},
            {'machineName': 'ISO_MILL', 'controlType': 'ISO'}
        ]
    }


def handle_plot_request(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a plot request from the frontend.
    
    Args:
        data: Request data containing machinedata array
        
    Returns:
        Response with canal data containing plot metadata
    """
    machine_data = data.get('machinedata', [])
    
    if not machine_data:
        return {'message_TEST': 'No machine data provided'}
    
    canals = {}
    
    for entry in machine_data:
        program = entry.get('program', '')
        machine_name = entry.get('machineName', 'ISO_MILL')
        canal_nr = str(entry.get('canalNr', '1'))
        
        # Parse the NC code and generate plot data
        plot_data = parse_nc_code(program)
        
        canals[canal_nr] = {
            'plotMetadata': plot_data,
            'machineName': machine_name
        }
    
    return {
        'canal': canals,
        'message': 'Plot generated successfully'
    }


def main():
    """Main CGI handler function."""
    # Set CORS headers and content type
    print("Content-Type: application/json")
    print("Access-Control-Allow-Origin: *")
    print("Access-Control-Allow-Methods: POST, GET, OPTIONS")
    print("Access-Control-Allow-Headers: Content-Type")
    print()
    
    # Handle preflight OPTIONS request
    method = os.environ.get('REQUEST_METHOD', 'GET')
    if method == 'OPTIONS':
        print(json.dumps({'status': 'ok'}))
        return
    
    try:
        # Read input data
        content_length = int(os.environ.get('CONTENT_LENGTH', 0))
        
        if content_length > 0:
            input_data = sys.stdin.read(content_length)
            data = json.loads(input_data)
        else:
            data = {}
        
        # Route the request
        action = data.get('action', '')
        
        if action == 'list_machines' or action == 'get_machines':
            result = handle_list_machines()
        elif 'machinedata' in data:
            result = handle_plot_request(data)
        else:
            result = {'message': 'NC-Edit7 CGI Server Ready', 'version': '1.0.0'}
        
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({'message_TEST': f'Invalid JSON: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'message_TEST': f'Server error: {str(e)}'}))


if __name__ == '__main__':
    main()
