"""Concrete parser: map NC/G-code string to an `NCCommandNode`.

The implementation is a direct, slightly cleaned-up adaptation of the
user-provided mapping logic. It returns the project's
`ncplot7py.shared.nc_nodes.NCCommandNode` and raises
`domain.exceptions.ExceptionNode` for detected error conditions.
"""
from __future__ import annotations

import re
import string
from typing import Optional, Set, Dict

from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.interfaces.BaseNCCommandParser import BaseNCCommandParser
from ncplot7py.domain import exceptions as domain_exceptions


class NCCommandParserError(domain_exceptions.ExceptionNode):
    """Thin wrapper for parser errors (keeps ExceptionNode semantics)."""


class NCCommandStringParser(BaseNCCommandParser):
    """Parse a single NC/G-code string into an `NCCommandNode` instance.

    The parser is intentionally permissive: it follows the original
    heuristics (G-codes, single-letter parameters, macro/variable markers
    starting with '#', DDDP tokens after commas, etc.). Where the original
    raised a custom IntEnum-based exception, this implementation raises
    `domain.exceptions.ExceptionNode` with a compact numeric code so calling
    code can handle it.
    """

    def parse(self, nc_command_string: str, line_nr: Optional[int] = None) -> NCCommandNode:
        g_code_set: Set[str] = set()
        axis_coordinate_dict: Dict[str, str] = {}
        dddp_ccr_set: Set[str] = set()
        var_calculation_str = ""
        loop_code = ""
        is_dddp = False

        if nc_command_string is None:
            nc_command_string = ""

        # --- START SIEMENS/STRING MASKING ---
        masked_map = {}
        mask_counter = 0
        
        def mask_match(match):
            nonlocal mask_counter
            # Use lowercase to avoid splitting by [A-Z] regex later
            token = f"__masked_{mask_counter}__"
            masked_map[token] = match.group(0)
            mask_counter += 1
            return token

        # 1. Mask Strings (e.g. T="TOOL")
        nc_line = re.sub(r'"[^"]*"', mask_match, nc_command_string)
        
        # 2. Mask Siemens Calls/Keywords
        # Keywords: CYCLE..., POCKET..., WORKPIECE, MCALL, REPEAT, MSG
        # We match the keyword and optional following (...) block
        # Allow matching if preceded by word boundary OR a digit (e.g. N100CYCLE800)
        siemens_pattern = r"(?:\b|(?<=\d))(CYCLE\d+|POCKET\d+|WORKPIECE|MCALL|REPEAT|MSG)\b(?:\s*\([^)]*\))?"
        nc_line = re.sub(siemens_pattern, mask_match, nc_line)
        # --- END SIEMENS/STRING MASKING ---

        # remove comments (parentheses)
        # We must remove the content inside parentheses too, otherwise it gets parsed as commands.
        # e.g. T2100(BACK MILLING) -> T2100
        nc_line = re.sub(r"\(.*?\)", "", nc_line)

        # remove spaces for initial trimming but keep some tokenization later
        nc_line = re.sub(" ", "", nc_line)
        if nc_line.startswith('/'):
            nc_line = nc_line[1:]

        # simple detection of control/loop statements
        if 'GOTO' in nc_line or "IF" in nc_line or 'WHILE' in nc_line or "END" in nc_line or "DO" in nc_line:
            loop_code = nc_line
            nc_line = ""

        # Insert spaces before tokens so we can split
        nc_line = re.sub(r"(SQRT|ASIN|SIN|(?<![=\+\-\*\/\[])(?:__masked_|[A-Z,]))", r" \1", nc_line)
        # quickfix for the behaviour in the original snippet
        nc_line = nc_line.replace(" SQRT", "SQRT")
        nc_line = nc_line.replace(" ASIN", "ASIN")
        nc_line = nc_line.replace(" SIN", "SIN")

        codes = re.split(r"\s+", nc_line.strip()) if nc_line.strip() else []

        for code in codes:
            if not code:
                continue

            # --- UNMASK CHECK ---
            # If it is a standalone mask (Siemens call), we treat it as variable_command or special
            if code.startswith("__masked_"):
                original = masked_map.get(code, code)
                # Unmask any nested masks in original
                for k, v in masked_map.items():
                    if k in original:
                        original = original.replace(k, v)
                
                # Append to variable_command (used for macros/special calls)
                if var_calculation_str:
                    var_calculation_str += " " + original
                else:
                    var_calculation_str = original
                continue
            
            # If it is T=__masked_... or similar, unmask the value part
            if "__masked_" in code:
                for k, v in masked_map.items():
                    if k in code:
                        code = code.replace(k, v)
            # --- END UNMASK CHECK ---

            if is_dddp:
                dddp_ccr_set.add(code)
                is_dddp = False
            elif code.startswith('G'):
                g_code_set.add(code)
            elif code.startswith('#'):
                var_calculation_str = nc_line
                # Unmask whole line if needed
                for k, v in masked_map.items():
                    var_calculation_str = var_calculation_str.replace(k, v)

                if len(g_code_set) > 0 or len(axis_coordinate_dict) > 0:
                    domain_exceptions.raise_nc_error(
                        domain_exceptions.ExceptionTyps.NCCodeErrors,
                        -3,
                        message="Duplication of macro and NC command",
                        value=nc_command_string,
                        line=line_nr or 0,
                        source_line=nc_command_string,
                    )
            elif re.match(r"^[A-Z][0-9]+=", code):
                # Heuristic for variable assignment like R1=10 or X1=10
                # We treat this as part of the variable command string.
                # This allows multiple assignments like "R1=10 R2=20" without parameter duplication error.
                if var_calculation_str:
                    var_calculation_str += " " + code
                else:
                    var_calculation_str = code
            elif code.startswith(','):
                is_dddp = True
            elif is_dddp is True and (code.startswith(',R') or code.startswith(',C') or code.startswith(',A')):
                dddp_ccr_set.add(code)
            elif code.startswith('M'):
                # M codes treated as parameter-like (original code used code[:1])
                axis_coordinate_dict.update({code[:1]: code[1:]})
            elif code.startswith(('A', 'B', 'C', 'N', 'T', 'S', 'F', 'D', 'X', 'Y', 'Z', 'R', 'H', 'U', 'V', 'W', 'K', 'L', 'I',
                                 'Q', 'x', 'y', 'z', 'u', 'v', 'w', 'r', 'g')):
                key = code[:1]
                if key in axis_coordinate_dict:
                    domain_exceptions.raise_nc_error(
                        domain_exceptions.ExceptionTyps.NCCodeErrors,
                        -2,
                        message="Duplication of parameter",
                        value=code,
                        line=line_nr or 0,
                        source_line=nc_command_string,
                    )
                axis_coordinate_dict.update({key: code[1:]})

        node = NCCommandNode(
            g_code_command=g_code_set,
            command_parameter=axis_coordinate_dict,
            loop_command=loop_code or None,
            variable_command=var_calculation_str or None,
            dddp_command=dddp_ccr_set,
            nc_code_line_nr=line_nr,
        )

        return node


def register(registry) -> None:
    """Register this parser implementation in the project's registry.

    The registry uses string kinds (e.g. 'parser') and a textual name. We
    use 'nc_command' as the name for this implementation.
    """
    # Friendly name registration
    registry.register("parser", "nc_command", NCCommandStringParser)
    # Also register under the interface name so callers that look up by
    # interface can find this implementation.
    try:
        from ncplot7py.interfaces.BaseNCCommandParser import BaseNCCommandParser

        registry.register("parser", BaseNCCommandParser.__name__, NCCommandStringParser)
    except Exception:
        # Keep registration best-effort and avoid hard failures on import
        pass

