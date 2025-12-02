"""Parser interface for mapping NC/G-code text to `BaseNCCommandNode`.

This small interface defines a parser contract so different parser
implementations can be swapped in tests or at runtime.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from .BaseNCCommandNode import BaseNCCommandNode


class BaseNCCommandParser(ABC):
    """Abstract parser that converts an NC command string into a node.

    Implementations must return an object implementing
    :class:`BaseNCCommandNode`.
    """

    @abstractmethod
    def parse(self, nc_command_string: str, line_nr: Optional[int] = None) -> BaseNCCommandNode:
        """Parse a single line of NC/G-code and return a node representation.

        Parameters:
            nc_command_string: The raw NC text line to parse.
            line_nr: Optional 1-based source line number to attach to the node.

        Returns:
            An instance implementing :class:`BaseNCCommandNode`.
        """
        raise NotImplementedError()
