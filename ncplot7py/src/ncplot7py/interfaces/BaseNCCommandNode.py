"""Abstract interface for NC command node objects.

Provides a minimal ABC representing the behaviour and shape required by
consumers of `NCCommandNode`. Concrete implementations (for example
`ncplot7py.shared.nc_nodes.NCCommandNode`) should subclass this so code can
depend on the interface instead of a concrete class.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, Optional, Set


class BaseNCCommandNode(ABC):
    """Interface for an NC/G-code command node.

    Attributes are documented as properties so implementations may use either
    plain attributes or @property implementations.
    """

    @property
    @abstractmethod
    def g_code(self) -> Set[str]:
        pass

    @property
    @abstractmethod
    def command_parameter(self) -> Dict[str, str]:
        pass

    @property
    @abstractmethod
    def loop_command(self) -> Optional[str]:
        pass

    @property
    @abstractmethod
    def variable_command(self) -> Optional[str]:
        pass

    @property
    @abstractmethod
    def dddp_command(self) -> Set[str]:
        pass

    @property
    @abstractmethod
    def nc_code_line_nr(self) -> Optional[int]:
        pass

    @abstractmethod
    def copy(self) -> "BaseNCCommandNode":
        """Return a copy of this node. The exact copy semantics are
        implementation-defined but callers expect a shallow copy of node
        pointers and a deep copy of mutable attributes.
        """
        pass

