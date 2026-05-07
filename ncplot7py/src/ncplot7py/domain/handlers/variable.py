"""Variable / macro handler for NC commands.

Provides a small, safe expression evaluator for bracketed expressions like
G[10+#500] or parameters like X[100*#501] and supports simple variable
assignments in `node.variable_command` of the form `#500=[expr]`.

This is intentionally small and conservative compared to a full macro
implementation; it should be extended where needed and unit-tested.
"""
from __future__ import annotations

import re
from typing import Dict, Optional, Tuple

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.expression_evaluator import ExpressionEvaluator

class VariableHandler(Handler):
    """Handler that decodes variable assignments and bracketed expressions.

    Behavior:
    - If `node.variable_command` is like `#500=expression` the expression is
      evaluated and stored in `state.parameters['500']`.
    - Any bracketed expressions `[ ... ]` in g-code tokens or parameter
      strings are evaluated and replaced (supports embedded `#NNN` variables).
    - Delegates to the next handler afterwards.
    """

    def __init__(self, next_handler: Optional[Handler] = None):
        super().__init__(next_handler=next_handler)
        self._evaluator = ExpressionEvaluator()

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[list], Optional[float]]:
        # 1) variable assignment via node.variable_command (e.g. "#500=[10+5]" or "R500=...")
        vc = node.variable_command
        if vc:
            # We want to support space-separated multiple assignments (e.g., "R1=10 R2=20")
            # as well as spaces within expressions (e.g., "#8 = #10 + 20").
            # Therefore, we find all variables followed by an '=' to split assignments.
            var_re = self._evaluator.get_var_regex(state)
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
                    var_re = self._evaluator.get_var_regex(state)
                    match = var_re.fullmatch(left)
                    
                    if match:
                        var_index = match.group(1)
                        try:
                            # allow right side to be an expression (possibly bracketed)
                            expr = right.strip()
                            # if expression is wrapped in [] remove them
                            if expr.startswith("[") and expr.endswith("]"):
                                expr = expr[1:-1]
                            val = self._evaluator.evaluate(expr, state)
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
                        val = self._evaluator.evaluate(expr, state)
                        new_v = str(val)
                    except Exception:
                        new_v = val_str
                else:
                    try:
                        # Before checking brackets, see if the val_str is a variable or negative variable
                        var_re = self._evaluator.get_var_regex(state)
                        if var_re.fullmatch(val_str) or (val_str.startswith("-") and var_re.fullmatch(val_str[1:])):
                            expr_val = self._evaluator.evaluate(val_str, state)
                            if float(expr_val).is_integer():
                                new_v = str(int(expr_val))
                            else:
                                new_v = str(expr_val)
                        else:
                            new_v = self._evaluator.eval_and_replace_in_string(val_str, state)
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
                    new_g = self._evaluator.eval_and_replace_in_string(g, state)
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
