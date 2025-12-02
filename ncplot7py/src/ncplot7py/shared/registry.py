"""Simple registry for parsers, machines and plotters.

This keeps the example small; for production consider entry_points or a plugin
system via importlib.metadata.
"""
from __future__ import annotations

from typing import Dict, Type


class Registry:
    def __init__(self):
        self._data: Dict[str, Dict[str, Type]] = {}

    def register(self, kind: str, name: str, cls: Type) -> None:
        self._data.setdefault(kind, {})[name] = cls

    def get(self, kind: str, name: str):
        return self._data.get(kind, {}).get(name)


registry = Registry()


