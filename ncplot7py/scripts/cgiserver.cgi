#!/usr/bin/env python3
"""
CGI Server for NC-Edit7 Plot Interface
Handles machine data requests and returns plot data using the real ncplot7py engine.
"""

import sys
import json
import os
import re
import logging
import traceback
from typing import Dict, List, Any, Optional
from pathlib import Path

# Ensure ncplot7py/src is in sys.path
# This script is in ncplot7py/scripts/
# We want to add ncplot7py/src/ to sys.path
current_dir = Path(__file__).resolve().parent
package_src = current_dir.parent / "src"
if package_src.exists() and str(package_src) not in sys.path:
    sys.path.insert(0, str(package_src))

# Import ncplot7py internals
try:
    from ncplot7py.application.nc_execution import NCExecutionEngine
    from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnControl
    from ncplot7py.infrastructure.machines.stateful_siemens_mill_control import StatefulSiemensMillControl
    from ncplot7py.cli.main import bootstrap as cli_bootstrap
    from ncplot7py.domain.machines import (
        get_available_machines,
        get_machine_regex_patterns,
        get_machine_config,
    )
    from ncplot7py.domain.cnc_state import CNCState
    from ncplot7py.domain.exceptions import ExceptionNode
except Exception as e:
    # If imports fail, we can't do much. We'll log it and fail later if needed.
    sys.stderr.write(f"Failed to import ncplot7py: {e}\n")
    sys.stderr.write(traceback.format_exc())
    NCExecutionEngine = None
    StatefulIsoTurnControl = None
    StatefulSiemensMillControl = None
    cli_bootstrap = None
    get_available_machines = None
    get_machine_regex_patterns = None
    CNCState = None
    ExceptionNode = None

# Set content type for CGI
print("Content-Type: application/json")
print()

# Configure logging to stderr so it appears in server logs but doesn't break JSON output
logging.basicConfig(stream=sys.stderr, level=logging.INFO)

def sanitize_program(program: str) -> str:
    """Conservative sanitizer exposed at module level for reuse and testing."""
    if not isinstance(program, str):
        return program

    # Remove parenthetical comments (single-line)
    program = re.sub(r"\(.*?\)", "", program)

    def sanitize_subcmd(sub: str) -> str:
        parts = [p for p in sub.strip().split() if p != ""]
        axis_re = re.compile(r'^([XYZIJKxyzijk])')
        last_axis = {}
        others = []
        # record last index for axis tokens and keep others with position
        for i, p in enumerate(parts):
            m = axis_re.match(p)
            if m:
                last_axis[m.group(1).upper()] = i
            else:
                others.append((i, p))

        if not last_axis and not others:
            return sub.strip()

        axis_by_index = {idx: parts[idx] for idx in last_axis.values()}

        merged = []
        for i in range(len(parts)):
            if i in axis_by_index:
                merged.append(axis_by_index[i])
            else:
                # append any other token at this position
                for pos, val in others:
                    if pos == i:
                        merged.append(val)
                        break

        return " ".join(merged)

    sanitized_lines = []
    for line in program.splitlines():
        # split by semicolon but keep semantic separators
        subs = [s for s in line.split(";")]
        san_subs = [sanitize_subcmd(s) for s in subs]
        sanitized_lines.append(";".join([s for s in san_subs if s is not None]))

    return "\n".join(sanitized_lines)

def build_segments_from_engine_output(canal_output: Dict[str, Any]) -> Dict[str, Any]:
    """Convert NCExecutionEngine canal output to the legacy response shape."""
    segments = []
    timing = []
    executed_lines = canal_output.get("programExec", [])

    plot_list = canal_output.get("plot", [])

    for idx, entry in enumerate(plot_list):
        x = entry.get("x", [])
        y = entry.get("y", [])
        z = entry.get("z", [])
        t = entry.get("t", 0)

        # Build start/end points (first and last)
        if len(x) == 0:
            continue
        start = {"x": x[0], "y": y[0] if len(y) > 0 else None, "z": z[0] if len(z) > 0 else None}
        end = {"x": x[-1], "y": y[-1] if len(y) > 0 else None, "z": z[-1] if len(z) > 0 else None}

        seg = {
            "type": "RAPID" if (not t or float(t) == 0) else "LINEAR",
            "lineNumber": executed_lines[idx] if idx < len(executed_lines) else None,
            "toolNumber": 1,
            "points": [start, end],
        }
        segments.append(seg)
        try:
            timing.append(float(t))
        except Exception:
            timing.append(0.0)

    return {"segments": segments, "executedLines": executed_lines, "variables": {}, "timing": timing}

def mock_parse_nc_program(program: str, machine_name: str) -> Dict[str, Any]:
    """
    Parse NC program and generate mock plot data (legacy behavior).
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

def run_mock_parser(machinedata: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run the mock parser for all programs in machinedata."""
    canal_results = {}
    messages = []
    
    for program_entry in machinedata:
        program = program_entry.get("program", "")
        machine_name = program_entry.get("machineName", "ISO_MILL")
        canal_nr = str(program_entry.get("canalNr", "1"))
        
        # Parse program
        try:
            result = mock_parse_nc_program(program, machine_name)
            canal_results[canal_nr] = result
            messages.append(f"Successfully processed {machine_name} canal {canal_nr} (mock)")
        except Exception as e:
            messages.append(f"Error processing {machine_name} canal {canal_nr}: {str(e)}")
    
    return {
        "canal": canal_results,
        "message": messages,
        "success": True
    }

def handle_list_machines() -> Dict[str, Any]:
    if get_available_machines is None:
        return {"machines": [], "success": False, "message": "ncplot7py not available"}

    machines = get_available_machines()

    # Add regex patterns to each machine
    for machine in machines:
        if get_machine_regex_patterns:
            machine["regexPatterns"] = get_machine_regex_patterns(machine["controlType"])
        config = get_machine_config(machine["machineName"])
        machine["variablePrefix"] = config.variable_prefix

    return {
        "machines": machines,
        "success": True,
    }

def handle_execute_programs(machinedata: List[Dict[str, Any]]) -> Dict[str, Any]:
    if NCExecutionEngine is None:
        return run_mock_parser(machinedata)

    # Ensure parser registration
    try:
        if cli_bootstrap:
            cli_bootstrap()
    except Exception:
        logging.exception("Bootstrap failed")

    # Build programs list, canal names, tool values, custom variables, and machine names
    programs: List[str] = []
    canal_names: List[str] = []
    tool_values_list: List[List[Dict[str, Any]]] = []
    custom_variables_list: List[List[Dict[str, Any]]] = []
    machine_names: List[str] = []

    for entry in machinedata:
        prog = entry.get("program", "")
        prog_sanitized = sanitize_program(prog)
        programs.append(prog_sanitized)
        canal_names.append(str(entry.get("canalNr", "1")))
        machine_names.append(str(entry.get("machineName", "ISO_MILL")))
        
        # Extract toolValues (Q quadrant 1-9 and R radius for tool compensation)
        tool_values = entry.get("toolValues", [])
        tool_values_list.append(tool_values)
        
        # Extract customVariables (user-defined variables)
        custom_vars = entry.get("customVariables", [])
        custom_variables_list.append(custom_vars)

    # Create initial CNC states with custom variables and tool data
    init_states = []
    for idx in range(len(programs)):
        if CNCState is not None:
            state = CNCState()
            # Set custom variables into state parameters
            custom_vars = custom_variables_list[idx] if idx < len(custom_variables_list) else []
            for var in custom_vars:
                var_name = str(var.get("name", ""))
                var_value = var.get("value", 0)
                if var_name:
                    try:
                        state.set_parameter(var_name, float(var_value))
                    except (ValueError, TypeError):
                        logging.warning(f"Invalid custom variable value: {var_name}={var_value}")
            
            # Store tool Q/R values in state extra for later use by tool compensation handlers
            tool_vals = tool_values_list[idx] if idx < len(tool_values_list) else []
            tool_data = {}
            for tv in tool_vals:
                t_num = tv.get("toolNumber")
                if t_num is not None:
                    try:
                        key = int(t_num)
                    except ValueError:
                        key = str(t_num)

                    tool_data[key] = {
                        "qValue": tv.get("qValue"),  # Quadrant Q1-Q9
                        "rValue": tv.get("rValue"),  # Tool radius R
                    }
            state.extra["tool_compensation_data"] = tool_data
            init_states.append(state)
        else:
            init_states.append(None)

    # Determine control type based on machine name
    first_machine = machine_names[0] if machine_names else ""
    is_siemens_mill = (
        "SIEMENS" in first_machine.upper() or 
        first_machine.upper() == "ISO_MILL" or
        (first_machine.upper().endswith("_MILL") and "FANUC" not in first_machine.upper())
    )
    if not first_machine:
        is_siemens_mill = True

    engine_output = None
    errors: List[Dict[str, Any]] = []
    try:
        if is_siemens_mill and StatefulSiemensMillControl is not None:
            control = StatefulSiemensMillControl(
                count_of_canals=len(programs), 
                canal_names=canal_names,
                init_nc_states=init_states if any(s is not None for s in init_states) else None
            )
        else:
            control = StatefulIsoTurnControl(
                count_of_canals=len(programs), 
                canal_names=canal_names,
                init_nc_states=init_states if any(s is not None for s in init_states) else None
            )
        engine = NCExecutionEngine(control)
        engine_output = engine.get_Syncro_plot(programs, False)
        
        errors = getattr(engine, 'errors', [])
    except ExceptionNode as e:
        error_info = {
            "type": e.typ.name if hasattr(e.typ, 'name') else str(e.typ),
            "code": e.code,
            "line": e.line,
            "message": e.localized("en"),
            "value": str(e.value) if e.value else "",
        }
        errors.append(error_info)
        logging.warning("NC execution error: %s", error_info)
    except Exception as e:
        logging.warning("Real engine failed: %s. Falling back to mock parser.", e)

    use_mock = False
    if engine_output is None:
        use_mock = True
    else:
        total_points = 0
        for canal in engine_output:
            if isinstance(canal, dict):
                total_points += len(canal.get("plot", []))
            elif isinstance(canal, list):
                total_points += len(canal)
        
        if total_points == 0 and any(len(p.strip()) > 0 for p in programs):
            logging.info("Real engine returned 0 points for non-empty program. Falling back to mock.")
            use_mock = True

    if use_mock:
        result = run_mock_parser(machinedata)
        if errors:
            result["errors"] = errors
        return result

    canal_results = {}
    messages = []
    for idx, canal in enumerate(engine_output):
        canal_nr = canal_names[idx] if idx < len(canal_names) else str(idx + 1)
        try:
            if isinstance(canal, list):
                canal = {"plot": canal, "programExec": []}

            converted = build_segments_from_engine_output(canal)
            canal_results[canal_nr] = converted
            messages.append(f"Successfully processed canal {canal_nr}")
        except Exception as e:
            logging.exception("Failed converting canal output for canal %s", canal_nr)
            return {
                "canal": canal_results,
                "message": [f"Conversion error for canal {canal_nr}: {str(e)}"],
                "success": False,
                "errors": errors,
            }

    response = {"canal": canal_results, "message": messages, "success": True}
    if errors:
        response["errors"] = errors
        response["hasErrors"] = True
    return response

def main():
    """Main CGI entry point"""
    try:
        request_method = os.environ.get("REQUEST_METHOD", "GET")
        
        if request_method != "POST":
            response = {
                "error": "Only POST requests are supported",
                "message_TEST": ["Method not allowed"]
            }
            print(json.dumps(response))
            return
        
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
            response = handle_execute_programs(request_data)
        
        else:
            response = {
                "error": "Invalid request format",
                "message_TEST": ["Request must contain 'action' or 'machinedata'"]
            }
        
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
