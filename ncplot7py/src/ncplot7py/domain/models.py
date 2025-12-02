
"""Domain models for ncplot7py.

Keep a lightweight `NCNode` dataclass for simple use-cases and tests,
and also expose a stronger-typed alias `NCNodeType` that points to the
full `NCCommandNode` implementation in ``nc_nodes.py``. This preserves
backwards compatibility while providing a path to the richer node
implementation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from ..shared.nc_nodes import NCCommandNode





