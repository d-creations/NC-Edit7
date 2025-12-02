from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class StarTurnHandler(Handler):
    """Handler for Star Turn specific G-codes.

    Implements a small subset of Star Turn macros:
    - G125: removes Z parameter from the node
    - G300: reserved (no-op)
    - G266: macro that maps letter params to internal variable slots

    The G266 implementation pops parameters from the node and stores
    numeric values in `state.parameters` using the numeric variable
    indices as string keys (e.g. '531'). This mirrors how other
    handlers interact with `CNCState` variable storage.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # iterate defensive copy
        for g_code in set(node.g_code):
            try:
                if g_code.upper().startswith("G"):
                    g_num = int(g_code[1:])
                else:
                    continue
            except Exception:
                continue

            if g_num == 125:
                # remove Z parameter if present
                for key in list(node.command_parameter.keys()):
                    if key.upper() == "Z":
                        node.command_parameter.pop(key, None)

            elif g_num == 300:
                # reserved / no-op for now
                pass

            elif g_num == 266:
                # run star macro G266: map letters to variable slots
                self._run_star_macro_g266(node, state)

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None

    def _run_star_macro_g266(self, node: NCCommandNode, state: CNCState) -> None:
        # mapping from letter param to internal variable index (as string)
        mapping = {
            "A": "531",
            "W": "530",
            "S": "529",
            "F": "522",
            "B": "528",
            "X": "524",
            "Z": "525",
            "T": "523",
        }

        params = node.command_parameter
        for letter, var_index in mapping.items():
            if letter in params:
                raw = params.pop(letter, None)
                try:
                    val = float(raw)
                except Exception:
                    # best-effort fallback to 0.0 on parse error
                    try:
                        val = float(str(raw))
                    except Exception:
                        val = 0.0
                # store as string key to match VariableHandler conventions
                try:
                    state.parameters[var_index] = float(val)
                except Exception:
                    # ensure we always set a float
                    state.parameters[var_index] = float(0.0)


__all__ = ["StarTurnHandler"]
