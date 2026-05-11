from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass, field
import json
import os

@dataclass
class MachineConfig:
    """Configuration for a specific machine/control type."""
    name: str
    control_type: str  # "FANUC", "SIEMENS"
    variable_pattern: str  # Regex for variables, e.g. r"#(\d+)" or r"R(\d+)"
    variable_prefix: str   # Prefix for variables, e.g. "#" or "R"
    tool_range: Tuple[int, int]
    machine_type: str = "MILL"
    channels: int = 1
    synchronization_strategy: str = "NONE"
    supported_gcode_groups: Tuple[str, ...] = field(default_factory=tuple)
    default_plane: str = "G17"
    default_feed_mode: str = "FEED_PER_MIN"
    a_axis_rollover: bool = False
    b_axis_rollover: bool = False
    c_axis_rollover: bool = False
    a_axis_shortest_path: bool = False
    b_axis_shortest_path: bool = False
    c_axis_shortest_path: bool = False
    polar_interpolate_axis: str = "Y"
    diameter_axes: Tuple[str, ...] = ()


FANUC_GENERIC_CONFIG = MachineConfig(
    name='FANUC_GENERIC',
    control_type='FANUC',
    variable_pattern=r'#(\d+)',
    variable_prefix='#',
    tool_range=(0, 9999),
)

# --- Machine Definitions ---

# Registry of configs
MACHINE_CONFIGS: Dict[str, MachineConfig] = {}

def load_machine_configs():
    global MACHINE_CONFIGS
    MACHINE_CONFIGS = {'FANUC_GENERIC': FANUC_GENERIC_CONFIG}
    config_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'config', 'machines.json')
    try:
        with open(config_path, 'r') as f:
            data = json.load(f)
            
        # First pass: load base configs
        for key, val in data.items():
            if isinstance(val, dict):
                MACHINE_CONFIGS[key] = MachineConfig(
                    name=val['name'],
                    control_type=val['control_type'],
                    variable_pattern=val['variable_pattern'],
                    variable_prefix=val['variable_prefix'],
                    tool_range=tuple(val['tool_range']),
                    machine_type=val.get('machine_type', 'MILL'),
                    channels=val.get('channels', 1),
                    synchronization_strategy=val.get('synchronization_strategy', 'NONE'),
                    supported_gcode_groups=tuple(val.get('supported_gcode_groups', [])),
                    default_plane=val.get('default_plane', 'G17'),
                    default_feed_mode=val.get('default_feed_mode', 'FEED_PER_MIN'),
                    a_axis_rollover=val.get('a_axis_rollover', False),
                    b_axis_rollover=val.get('b_axis_rollover', False),
                    c_axis_rollover=val.get('c_axis_rollover', False),
                    a_axis_shortest_path=val.get('a_axis_shortest_path', False),
                    b_axis_shortest_path=val.get('b_axis_shortest_path', False),
                    c_axis_shortest_path=val.get('c_axis_shortest_path', False),
                    polar_interpolate_axis=val.get('polar_interpolate_axis', 'Y'),
                    diameter_axes=tuple(val.get('diameter_axes', []))
                )
                
        # Second pass: resolve aliases
        for key, val in data.items():
            if isinstance(val, str) and val in MACHINE_CONFIGS:
                MACHINE_CONFIGS[key] = MACHINE_CONFIGS[val]
                
    except Exception as e:
        print(f"Warning: Failed to load machines.json: {e}")

load_machine_configs()

def get_machine_config(machine_name: str) -> MachineConfig:
    """Retrieve configuration for a given machine name."""
    return MACHINE_CONFIGS.get(machine_name) or FANUC_GENERIC_CONFIG

def get_machine_regex_patterns(control_type: str) -> Dict[str, Any]:
    """Return regex patterns for parsing NC code based on control type.

    Each machine has specific patterns for:
    - tools: Regular tool calls (e.g., T1-T99)
    - variables: Variable references (e.g., #1 - #999)
    - keywords: Special codes like M-codes and extended T-codes

    Returns a dictionary with pattern strings and descriptions.
    """
    # Determine config based on control type string (heuristic)
    # In a real app, we'd pass the specific machine name.
    # For backward compatibility, we map control_type to a config.
    
    config = MACHINE_CONFIGS.get(control_type, MACHINE_CONFIGS.get('FANUC_GENERIC'))
    
    if config is None or config.name == 'FANUC_GENERIC':
        for key, c in MACHINE_CONFIGS.items():
            if c.control_type == control_type:
                config = c
                break

    tool_pattern = fr"T([{config.tool_range[0]}-{config.tool_range[1]}])(?!\\d)" if config.tool_range[1] < 100 else r"T([1-9][0-9]*)(?!\\d)"
    
    if config.control_type == "SIEMENS":
        # Support T="ToolName"
        tool_pattern = r"(?:T([1-9][0-9]*)(?!\\d)|T=\"[^\"]+\")"

    # Define keyword patterns
    keyword_pattern = r"(T(100|[1-9][0-9]{2,3})|M(2[0-9]{2}|[3-8][0-8]{2})|M82|M83|M20|G(?:255|266)|M30)"
    keyword_desc = "Keywords: T100-T9999, M200-M888, M82, M83, M20, G255, G266, M30"

    if config.control_type == "SIEMENS":
        # Siemens specific keywords: Named tools, Cycles, MCALL, M30, M17
        keyword_pattern = r"(?:T=\"[^\"]+\"|CYCLE\\d+|POCKET\\d+|MCALL|M30|M17)"
        keyword_desc = "Keywords: T=\"Name\", CYCLE..., POCKET..., MCALL, M30, M17"

    # Base patterns common to most machines
    base_patterns = {
        "tools": {
            "pattern": tool_pattern,
            "description": f"Tools T{config.tool_range[0]}-T{config.tool_range[1]}" + (", T=\"Name\"" if config.control_type == "SIEMENS" else ""),
            "range": {"min": config.tool_range[0], "max": config.tool_range[1]}
        },
        "variables": {
            "pattern": config.variable_pattern.replace('\\', '\\\\'),
            "description": f"Variables {config.variable_prefix}1 - {config.variable_prefix}999",
            "range": {"min": 1, "max": 999}
        },
        "keywords": {
            "pattern": keyword_pattern,
            "description": keyword_desc,
            "codes": {
                "extended_tools": {"pattern": r"T(100|[1-9][0-9]{2,3})", "range": {"min": 100, "max": 9999}},
                "m_codes_range": {"pattern": r"M(2[0-9]{2}|[3-8][0-8]{2})", "range": {"min": 200, "max": 888}},
                "special_m_codes": ["M82", "M83", "M20"],
                "g_codes": ["G255", "G266"],
                "program_control": ["M0", "M1", "M3", "M5", "M30"]
            }
        }
    }

    return base_patterns

def get_available_machines() -> List[Dict[str, str]]:
    """Return a list of available machines and their control types."""
    return [
        {"machineName": key, "controlType": val.name}
        for key, val in MACHINE_CONFIGS.items()
    ]