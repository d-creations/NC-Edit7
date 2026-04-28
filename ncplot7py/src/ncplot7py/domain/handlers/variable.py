"""Variable / macro handler for NC commands.

Provides a small, safe expression evaluator for bracketed expressions like
G[10+#500] or parameters like X[100*#501] and supports simple variable
assignments in `node.variable_command` of the form `#500=[expr]`.

This is intentionally small and conservative compared to a full macro
implementation; it should be extended where needed and unit-tested.
"""
from __future__ import annotations

import ast
import math
import re
from typing import Any, Dict, Optional, Tuple

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


def _sin_deg(x: float) -> float:
    return math.sin(math.radians(x))


def _cos_deg(x: float) -> float:
    return math.cos(math.radians(x))


def _tan_deg(x: float) -> float:
    return math.tan(math.radians(x))


def _asin_deg(x: float) -> float:
    return math.degrees(math.asin(x))


def _acos_deg(x: float) -> float:
    return math.degrees(math.acos(x))


def _atan_deg(x: float) -> float:
    return math.degrees(math.atan(x))


def _abs(x: float) -> float:
    return abs(x)


def _bin(x: float) -> float:
    # BIN conversion is typically a no-op in simulation
    return float(x)


def _bcd(x: float) -> float:
    # BCD conversion is typically a no-op in simulation
    return float(x)


def _round(x: float) -> float:
    # Fanuc ROUND rounds 0.5 up
    if x >= 0:
        return math.floor(x + 0.5)
    return math.ceil(x - 0.5)


def _fix(x: float) -> float:
    # Fanuc FIX discards fractional part (truncate toward 0)
    return float(math.trunc(x))


def _fup(x: float) -> float:
    # Fanuc FUP rounds away from 0
    if x >= 0:
        return math.ceil(x)
    return math.floor(x)


_ALLOWED_FUNCS = {
    "sin": _sin_deg,
    "cos": _cos_deg,
    "tan": _tan_deg,
    "asin": _asin_deg,
    "acos": _acos_deg,
    "atan": _atan_deg,
    "sqrt": math.sqrt,
    "abs": _abs,
    "bin": _bin,
    "bcd": _bcd,
    "round": _round,
    "fix": _fix,
    "fup": _fup,
    "pi": math.pi,
    "SIN": _sin_deg,
    "COS": _cos_deg,
    "TAN": _tan_deg,
    "ASIN": _asin_deg,
    "ACOS": _acos_deg,
    "ATAN": _atan_deg,
    "SQRT": math.sqrt,
    "ABS": _abs,
    "BIN": _bin,
    "BCD": _bcd,
    "ROUND": _round,
    "FIX": _fix,
    "FUP": _fup,
    "PI": math.pi,
}


def _safe_eval(expr: str, variables: Dict[str, float]) -> float:
    """Evaluate a restricted arithmetic expression safely.

    - Supports binary ops +, -, *, /, **, %, // and unary +/-
    - Allows names that are keys in `variables` or in `_ALLOWED_FUNCS`.
    """
    node = ast.parse(expr, mode="eval")

    for n in ast.walk(node):
        # allow safe node types
        if isinstance(n, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Load, ast.Name, ast.Constant, ast.Pow, ast.Sub, ast.Add, ast.Mult, ast.Div, ast.Mod, ast.FloorDiv, ast.UAdd, ast.USub)):
            continue
        # allow operator nodes explicitly
        if isinstance(n, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.FloorDiv, ast.UAdd, ast.USub)):
            continue
        raise ValueError(f"Unsafe expression element: {type(n).__name__}")

    # build evaluation context
    ctx: Dict[str, Any] = {}
    ctx.update(_ALLOWED_FUNCS)
    ctx.update(variables)

    # evaluate with empty builtins
    return float(eval(compile(node, "<expr>", "eval"), {"__builtins__": {}}, ctx))


class VariableHandler(Handler):
    """Handler that decodes variable assignments and bracketed expressions.

    Behavior:
    - If `node.variable_command` is like `#500=expression` the expression is
      evaluated and stored in `state.parameters['500']`.
    - Any bracketed expressions `[ ... ]` in g-code tokens or parameter
      strings are evaluated and replaced (supports embedded `#NNN` variables).
    - Delegates to the next handler afterwards.
    """

    # Match innermost bracket expressions (no nested '[' or ']' inside)
    BRACKET_RE = re.compile(r"\[([^\[\]]+)\]")
    # VAR_RE is now dynamic based on state.machine_config

    def __init__(self, next_handler: Optional[Handler] = None):
        super().__init__(next_handler=next_handler)

    def _get_var_regex(self, state: CNCState) -> re.Pattern:
        if state.machine_config and state.machine_config.variable_pattern:
            return re.compile(state.machine_config.variable_pattern)
        return re.compile(r"#(\d+)")

    def _build_variable_map(self, state: CNCState) -> Dict[str, float]:
        # map '#123' or 'R123' -> v123 identifier usable in Python expressions
        vm: Dict[str, float] = {}
        for k, v in (state.parameters or {}).items():
            # k is the number part usually (e.g. "100")
            vm_key = f"v{k}"
            try:
                vm[vm_key] = float(v)
            except Exception:
                vm[vm_key] = 0.0
        return vm

    def _replace_vars_in_expr(self, expr: str, state: CNCState) -> str:
        # replace occurrences like #500 -> v500 so Python name lookup works
        # or R500 -> v500
        var_re = self._get_var_regex(state)
        return var_re.sub(lambda m: f"v{m.group(1)}", expr)

    def _normalize_function_brackets(self, expr: str) -> str:
        """Convert Fanuc-style function calls FUNC[...] to FUNC(...)."""
        out = expr
        func_re = re.compile(r"\b(sin|cos|tan|asin|acos|atan|sqrt|abs|bin|bcd|round|fix|fup|SIN|COS|TAN|ASIN|ACOS|ATAN|SQRT|ABS|BIN|BCD|ROUND|FIX|FUP)\[([^\[\]]+)\]")
        max_iters = 50
        for _ in range(max_iters):
            new_out = func_re.sub(lambda m: f"{m.group(1)}({m.group(2)})", out)
            if new_out == out:
                break
            out = new_out
        return out

    def _eval_expression(self, expr: str, state: CNCState) -> float:
        expr = expr.strip()
        # Fanuc uses [ ] for math grouping because ( ) are for comments.
        # Just convert them directly so Python eval handles nested operations seamlessly.
        expr_py = expr.replace('[', '(').replace(']', ')')
        expr_py = self._replace_vars_in_expr(expr_py, state)
        var_map = self._build_variable_map(state)
        return _safe_eval(expr_py, var_map)

    def _eval_and_replace_in_string(self, s: str, state: CNCState) -> str:
        """Evaluate bracketed expressions, handling nested brackets.

        The original implementation performed a single regex substitution which
        failed for nested bracket expressions like '2*[-1.73]' inside an outer
        '[ ... ]'. We fix this by repeatedly substituting the innermost
        bracketed expressions until no brackets remain (or a safety limit is
        reached).
        """

        def repl(m: re.Match) -> str:
            inner = m.group(1)
            val = self._eval_expression(inner, state)
            # return string form, preserving ints when possible
            if float(val).is_integer():
                return str(int(val))
            return str(val)

        # Iteratively replace bracketed expressions from the inside out.
        # This handles nested brackets by evaluating inner brackets first.
        out = s
        max_iters = 50
        it = 0
        while True:
            if not self.BRACKET_RE.search(out):
                break
            new_out = self.BRACKET_RE.sub(repl, out)
            # if nothing changed, stop to avoid infinite loops
            if new_out == out:
                break
            out = new_out
            it += 1
            if it >= max_iters:
                # stop after a sane limit; return current string
                break
        return out

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[list], Optional[float]]:
        # 1) variable assignment via node.variable_command (e.g. "#500=[10+5]" or "R500=...")
        vc = node.variable_command
        if vc:
            # We want to support space-separated multiple assignments (e.g., "R1=10 R2=20")
            # as well as spaces within expressions (e.g., "#8 = #10 + 20").
            # Therefore, we find all variables followed by an '=' to split assignments.
            var_re = self._get_var_regex(state)
            pattern = var_re.pattern
            # Find all occurrences of the variable pattern immediately followed by '=' (with optional spaces).
            # We use re.finditer to find boundaries of assignments.
            assign_regex = re.compile(rf"({pattern})\s*=")
            assignments = []
            matches = list(assign_regex.finditer(vc))
            for i, match in enumerate(matches):
                start = match.start()
                end = matches[i+1].start() if i + 1 < len(matches) else len(vc)
                assignments.append(vc[start:end].strip())

            for assign in assignments:
                if "=" in assign:
                    left, right = assign.split("=", 1)
                    left = left.strip()
                    
                    # Check if left side matches variable pattern
                    var_re = self._get_var_regex(state)
                    match = var_re.fullmatch(left)
                    
                    if match:
                        var_index = match.group(1)
                        try:
                            # allow right side to be an expression (possibly bracketed)
                            expr = right.strip()
                            # if expression is wrapped in [] remove them
                            if expr.startswith("[") and expr.endswith("]"):
                                expr = expr[1:-1]
                            val = self._eval_expression(expr, state)
                            state.parameters[var_index] = float(val)
                        except Exception as e:
                            # silent fallback to 0.0 to preserve current behaviour; in future
                            # we could raise a domain-specific exception with a log_route.
                            state.parameters[var_index] = 0.0

        # Keep track of original values to restore them after downstream handlers
        orig_command_parameter = None
        orig_g_code = None

        # 2) replace bracketed expressions in command parameters
        if node.command_parameter:
            new_params: Dict[str, str] = {}
            for k, v in node.command_parameter.items():
                val_str = str(v)
                # Handle Siemens style assignment X=R1 -> value is "=R1"
                if val_str.startswith("="):
                    try:
                        expr = val_str[1:]
                        val = self._eval_expression(expr, state)
                        new_v = str(val)
                    except Exception:
                        new_v = val_str
                else:
                    try:
                        # Before checking brackets, see if the val_str is a variable or negative variable
                        var_re = self._get_var_regex(state)
                        if var_re.fullmatch(val_str) or (val_str.startswith("-") and var_re.fullmatch(val_str[1:])):
                            expr_val = self._eval_expression(val_str, state)
                            if float(expr_val).is_integer():
                                new_v = str(int(expr_val))
                            else:
                                new_v = str(expr_val)
                        else:
                            new_v = self._eval_and_replace_in_string(val_str, state)
                    except Exception:
                        new_v = val_str
                new_params[k] = new_v
            # mutate node parameters so downstream handlers see decoded values
            try:
                orig_command_parameter = node._command_parameter
                node._command_parameter = new_params
            except Exception:
                # best-effort: if private attr is not present, ignore
                pass

        # 3) replace bracketed expressions in g-code tokens
        if node.g_code:
            new_g_codes = set()
            for g in set(node.g_code):
                try:
                    new_g = self._eval_and_replace_in_string(g, state)
                except Exception:
                    new_g = g
                new_g_codes.add(new_g)
            try:
                orig_g_code = node._g_code
                node._g_code = new_g_codes
            except Exception:
                pass

        # Delegate
        result = None
        if self.next_handler is not None:
            result = self.next_handler.handle(node, state)
            
        # Restore original node attributes so repeated execution (loops) will re-evaluate them properly
        if orig_command_parameter is not None:
            try:
                node._command_parameter = orig_command_parameter
            except Exception:
                pass
                
        if orig_g_code is not None:
            try:
                node._g_code = orig_g_code
            except Exception:
                pass

        return result if result is not None else (None, None)


__all__ = ["VariableHandler"]
