"""NC command node definitions used to represent parsed NC/G-code commands.

This module provides an `NCCommandNode` class following the shape of the
user-provided example but adapted to the project's style and typing. The
node keeps optional `_next_ncCode` and `_before_ncCode` attributes for
interop with linked-list implementations that expect those fields.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Dict, Optional, Set

from ..interfaces.BaseNCCommandNode import BaseNCCommandNode


class NCCommandNode(BaseNCCommandNode):
    """A node representing a single NC command.

    Attributes are kept intentionally simple and use standard Python types.
    _next_ncCode and _before_ncCode are provided for compatibility with
    linked-list implementations that expect those attributes.
    """

    def __init__(
        self,
        g_code_command: Optional[Set[str]] = None,
        command_parameter: Optional[Dict[str, str]] = None,
        loop_command: Optional[str] = None,
        variable_command: Optional[str] = None,
        dddp_command: Optional[Set[str]] = None,
        nc_code_line_nr: Optional[int] = None,
    ) -> None:
        # store data in private attributes to avoid colliding with the
        # abstract-property names exposed by the interface
        self._g_code: Set[str] = set(g_code_command or [])
        self._command_parameter: Dict[str, str] = dict(command_parameter or {})
        self._loop_command = loop_command
        self._variable_command = variable_command
        self._dddp_command: Set[str] = set(dddp_command or [])
        self._nc_code_line_nr: Optional[int] = nc_code_line_nr

        # Optional pointers for linked-list style containers
        self._next_ncCode: Optional["NCCommandNode"] = None
        self._before_ncCode: Optional["NCCommandNode"] = None

    # Implement abstract properties from BaseNCCommandNode
    @property
    def g_code(self) -> Set[str]:
        return self._g_code

    @property
    def command_parameter(self) -> Dict[str, str]:
        return self._command_parameter

    @property
    def loop_command(self) -> Optional[str]:
        return self._loop_command

    @property
    def variable_command(self) -> Optional[str]:
        return self._variable_command

    @property
    def dddp_command(self) -> Set[str]:
        return self._dddp_command

    @property
    def nc_code_line_nr(self) -> Optional[int]:
        return self._nc_code_line_nr

    def __str__(self) -> str:
        parts = ["NC COMMAND: "]
        if self.g_code:
            parts.append("G,codes=")
            parts.append(",".join(sorted(self.g_code)))
        if self.command_parameter:
            parts.append(" params=")
            parts.append(",".join(f"{k}={v}" for k, v in self.command_parameter.items()))
        if self.nc_code_line_nr is not None:
            parts.append(f" line={self.nc_code_line_nr}")
        return "".join(parts)

    def copy(self) -> "NCCommandNode":
        """Return a deep copy of the node (pointers are not deeply copied).

        The original example copied next pointers shallowly; here we copy
        node attributes deeply but keep `_next_ncCode` as a shallow reference
        to avoid copying an entire list structure.
        """
        node = NCCommandNode(
            g_code_command=set(self.g_code),
            command_parameter=deepcopy(self.command_parameter),
            loop_command=self.loop_command,
            variable_command=self.variable_command,
            dddp_command=set(self.dddp_command),
            nc_code_line_nr=self.nc_code_line_nr,
        )
        node._next_ncCode = self._next_ncCode
        node._before_ncCode = self._before_ncCode
        return node

    def __del__(self) -> None:
        # Break pointers to help garbage collection in long-lived lists.
        self._next_ncCode = None
        self._before_ncCode = None

    def __iter__(self):
        # Return an iterator for convenience; by default just yield this node.
        yield self

