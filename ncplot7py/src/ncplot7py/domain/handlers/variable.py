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


_ALLOWED_FUNCS = {
    "sin": _sin_deg,
    "cos": _cos_deg,
    "tan": _tan_deg,
    "asin": _asin_deg,
    "acos": _acos_deg,
    "atan": _atan_deg,
    "sqrt": math.sqrt,
    "pi": math.pi,
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

    def _eval_expression(self, expr: str, state: CNCState) -> float:
        expr = expr.strip()
        # allow expressions like 10 or #500+5 or SIN(30)
        # If the expression contains nested brackets evaluate them first so
        # expressions like '2*[-1.73]' are reduced to '2*-1.73' before
        # replacing variables and passing to the safe evaluator.
        if "[" in expr and "]" in expr:
            try:
                expr = self._eval_and_replace_in_string(expr, state)
            except Exception:
                # fallback to original expr if replacement fails
                pass
        expr_py = self._replace_vars_in_expr(expr, state)
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
            # Split by space to handle multiple assignments like "R1=10 R2=20"
            # The parser ensures assignments are space-separated and expressions have no spaces.
            assignments = vc.strip().split()
            
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

        # 2) replace bracketed expressions in command parameters
        if node.command_parameter:
            new_params: Dict[str, str] = {}
            for k, v in node.command_parameter.items():
                try:
                    new_v = self._eval_and_replace_in_string(str(v), state)
                except Exception:
                    new_v = str(v)
                new_params[k] = new_v
            # mutate node parameters so downstream handlers see decoded values
            try:
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
                node._g_code = new_g_codes
            except Exception:
                pass

        # Delegate
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["VariableHandler"]
