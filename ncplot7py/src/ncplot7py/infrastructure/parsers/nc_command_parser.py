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

        # remove spaces for initial trimming but keep some tokenization later
        nc_line = re.sub(" ", "", nc_command_string)
        if nc_line.startswith('/'):
            nc_line = nc_line[1:]

        # simple detection of control/loop statements
        if 'GOTO' in nc_line or "IF" in nc_line or 'WHILE' in nc_line or "END" in nc_line or "DO" in nc_line:
            loop_code = nc_line
            nc_line = ""

        # Insert spaces before tokens so we can split
        nc_line = re.sub(r"(SQRT|ASIN|SIN|(?<![=\+\-\*\/\[])[A-Z,])", r" \1", nc_line)
        # quickfix for the behaviour in the original snippet
        nc_line = nc_line.replace(" SQRT", "SQRT")
        nc_line = nc_line.replace(" ASIN", "ASIN")
        nc_line = nc_line.replace(" SIN", "SIN")

        codes = re.split(r"\s+", nc_line.strip()) if nc_line.strip() else []

        for code in codes:
            if not code:
                continue
            if is_dddp:
                dddp_ccr_set.add(code)
                is_dddp = False
            elif code.startswith('G'):
                g_code_set.add(code)
            elif code.startswith('#'):
                var_calculation_str = nc_line
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

