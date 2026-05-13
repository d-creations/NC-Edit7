import ast
import math
import re
from typing import Any, Dict

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
    return float(x)

def _bcd(x: float) -> float:
    return float(x)

def _round(x: float) -> float:
    if x >= 0:
        return math.floor(x + 0.5)
    return math.ceil(x - 0.5)

def _fix(x: float) -> float:
    return float(math.trunc(x))

def _fup(x: float) -> float:
    if x >= 0:
        return math.ceil(x)
    return math.floor(x)

_ALLOWED_FUNCS = {
    "sin": _sin_deg,    "cos": _cos_deg,    "tan": _tan_deg,
    "asin": _asin_deg,  "acos": _acos_deg,  "atan": _atan_deg,
    "sqrt": math.sqrt,  "abs": _abs,        "bin": _bin,
    "bcd": _bcd,        "round": _round,    "fix": _fix,
    "fup": _fup,        "pi": math.pi,
    "SIN": _sin_deg,    "COS": _cos_deg,    "TAN": _tan_deg,
    "ASIN": _asin_deg,  "ACOS": _acos_deg,  "ATAN": _atan_deg,
    "SQRT": math.sqrt,  "ABS": _abs,        "BIN": _bin,
    "BCD": _bcd,        "ROUND": _round,    "FIX": _fix,
    "FUP": _fup,        "PI": math.pi,
}

def _safe_eval(expr: str, variables: Dict[str, float]) -> float:
    """Evaluate a restricted arithmetic expression safely."""
    node = ast.parse(expr, mode="eval")
    for n in ast.walk(node):
        if isinstance(n, (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Call, ast.Load, ast.Name, ast.Constant, ast.Pow, ast.Sub, ast.Add, ast.Mult, ast.Div, ast.Mod, ast.FloorDiv, ast.UAdd, ast.USub)):
            continue
        if isinstance(n, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow, ast.FloorDiv, ast.UAdd, ast.USub)):
            continue
        raise ValueError(f"Unsafe expression element: {type(n).__name__}")

    class SafeEvalCtx(dict):
        def __missing__(self, key: str) -> Any:
            return 0.0

    ctx = SafeEvalCtx()
    ctx.update(_ALLOWED_FUNCS)
    ctx.update(variables)
    return float(eval(compile(node, "<expr>", "eval"), {"__builtins__": {}}, ctx))


class ExpressionEvaluator:
    """Evaluates mathematical expressions with variables based on CNC state."""
    
    # Match innermost bracket expressions (no nested '[' or ']' inside)
    BRACKET_RE = re.compile(r"\[([^\[\]]+)\]")

    def __init__(self):
        pass

    def get_var_regex(self, state: CNCState) -> re.Pattern:
        if state.machine_config and state.machine_config.variable_pattern:
            return re.compile(state.machine_config.variable_pattern)
        return re.compile(r"#(\d+)")

    def _build_variable_map(self, state: CNCState) -> Dict[str, float]:
        class SafeVarMap(dict):
            def __missing__(self, key: str) -> float:
                return 0.0

        vm = SafeVarMap()
        for k, v in (state.parameters or {}).items():
            vm_key = f"v{k}"
            try:
                vm[vm_key] = float(v)
            except Exception:
                vm[vm_key] = 0.0
        return vm

    def _replace_vars_in_expr(self, expr: str, state: CNCState) -> str:
        var_re = self.get_var_regex(state)
        return var_re.sub(lambda m: f"v{m.group(1)}", expr)

    def evaluate(self, expr: str, state: CNCState) -> float:
        expr = expr.strip()
        expr_py = expr.replace('[', '(').replace(']', ')')
        expr_py = self._replace_vars_in_expr(expr_py, state)
        var_map = self._build_variable_map(state)
        return _safe_eval(expr_py, var_map)

    def eval_and_replace_in_string(self, s: str, state: CNCState) -> str:
        def repl(m: re.Match) -> str:
            inner = m.group(1)
            val = self.evaluate(inner, state)
            if float(val).is_integer():
                return str(int(val))
            return str(val)

        out = s
        max_iters = 50
        it = 0
        while True:
            if not self.BRACKET_RE.search(out):
                break
            new_out = self.BRACKET_RE.sub(repl, out)
            if new_out == out:
                break
            out = new_out
            it += 1
            if it >= max_iters:
                break
        return out
