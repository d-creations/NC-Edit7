from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass, field

@dataclass
class MachineConfig:
    """Configuration for a specific machine/control type."""
    name: str
    control_type: str  # "FANUC", "SIEMENS"
    variable_pattern: str  # Regex for variables, e.g. r"#(\d+)" or r"R(\d+)"
    variable_prefix: str   # Prefix for variables, e.g. "#" or "R"
    tool_range: Tuple[int, int]
    default_plane: str = "G17"
    default_feed_mode: str = "G94"

# --- Machine Definitions ---

FANUC_STAR_CONFIG = MachineConfig(
    name="FANUC_STAR",
    control_type="FANUC",
    variable_pattern=r"#(\d+)",
    variable_prefix="#",
    tool_range=(1, 99),
    default_plane="G18", # Lathe default
    default_feed_mode="G95" # Feed/rev default
)

FANUC_GENERIC_CONFIG = MachineConfig(
    name="FANUC_GENERIC",
    control_type="FANUC",
    variable_pattern=r"#(\d+)",
    variable_prefix="#",
    tool_range=(100, 9999),
    default_plane="G17",
    default_feed_mode="G94"
)

SIEMENS_840D_CONFIG = MachineConfig(
    name="SIEMENS_840D",
    control_type="SIEMENS",
    variable_pattern=r"R(\d+)",
    variable_prefix="R",
    tool_range=(100, 9999),
    default_plane="G17",
    default_feed_mode="G94"
)

# Registry of configs
MACHINE_CONFIGS = {
    "FANUC_STAR": FANUC_STAR_CONFIG,
    "FANUC_GENERIC": FANUC_GENERIC_CONFIG,
    "SIEMENS_840D": SIEMENS_840D_CONFIG,
    # Aliases
    "ISO_MILL": SIEMENS_840D_CONFIG, # Assuming ISO Mill in this context is Siemens-like or Generic
    "FANUC_T": FANUC_STAR_CONFIG,
}

def get_machine_config(machine_name: str) -> MachineConfig:
    """Retrieve configuration for a given machine name."""
    return MACHINE_CONFIGS.get(machine_name, FANUC_GENERIC_CONFIG)

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
    
    config = FANUC_GENERIC_CONFIG
    if "STAR" in control_type.upper() or "TURN" in control_type.upper():
        config = FANUC_STAR_CONFIG
    elif "SIEMENS" in control_type.upper() or "MILL" in control_type.upper():
        config = SIEMENS_840D_CONFIG

    # Base patterns common to most machines
    base_patterns = {
        "tools": {
            "pattern": fr"T([{config.tool_range[0]}-{config.tool_range[1]}])(?!\d)" if config.tool_range[1] < 100 else r"T([1-9][0-9]*)(?!\d)",
            "description": f"Tools T{config.tool_range[0]}-T{config.tool_range[1]}",
            "range": {"min": config.tool_range[0], "max": config.tool_range[1]}
        },
        "variables": {
            "pattern": config.variable_pattern,
            "description": f"Variables {config.variable_prefix}1 - {config.variable_prefix}999",
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

    return base_patterns

def get_available_machines() -> List[Dict[str, str]]:
    """Return a list of available machines and their control types."""
    return [
        {"machineName": "ISO_MILL", "controlType": "SIEMENS_840D"},
        {"machineName": "FANUC_T", "controlType": "FANUC_STAR"},
        {"machineName": "SB12RG_F", "controlType": "FANUC_STAR"},
        {"machineName": "SB12RG_B", "controlType": "FANUC_STAR"},
        {"machineName": "SR20JII_F", "controlType": "FANUC_STAR"},
        {"machineName": "SR20JII_B", "controlType": "FANUC_STAR"},
    ]
