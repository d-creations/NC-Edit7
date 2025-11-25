from __future__ import annotations

from typing import Optional, Tuple, List

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class GcodePreCheckExecChainLink(Handler):
    """Pre-check handler for Fanuc-style NC commands.

    Performs lightweight validation before other G-code handlers run.
    Current checks:
    - Parameter letter keys must be upper-case (raises NCCodeErrors if not)
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        # Inspect parameter keys and raise a domain error when keys are lower-case
        for key in list(node.command_parameter.keys()):
            try:
                if isinstance(key, str) and key.islower():
                    raise_nc_error(ExceptionTyps.NCCodeErrors, 130, message="Parameter letter must be upper-case", value=str(key))
            except Exception:
                # propagate structured ExceptionNode raised by raise_nc_error
                raise

        # Delegate to next handler
        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None


__all__ = ["GcodePreCheckExecChainLink"]
