from typing import Dict, Any, List

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

def get_available_machines() -> List[Dict[str, str]]:
    """Return a list of available machines and their control types."""
    return [
        {"machineName": "ISO_MILL", "controlType": "MILL"},
        {"machineName": "FANUC_T", "controlType": "TURN"},
        {"machineName": "SB12RG_F", "controlType": "MILL"},
        {"machineName": "SB12RG_B", "controlType": "MILL"},
        {"machineName": "SR20JII_F", "controlType": "MILL"},
        {"machineName": "SR20JII_B", "controlType": "MILL"},
    ]
