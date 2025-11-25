from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Point:
    """Simple point / toolpath vertex used across the codebase.

    Placing this in `shared` ensures the small data shape is available to
    infrastructure and application layers without importing domain handlers.
    """
    x: float
    y: float
    z: float
    a: float = 0.0
    b: float = 0.0
    c: float = 0.0


__all__ = ["Point"]
