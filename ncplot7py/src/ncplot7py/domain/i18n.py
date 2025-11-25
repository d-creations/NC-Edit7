from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Mapping, Optional
import importlib.resources as resources


@dataclass(frozen=True)
class MessageKey:
    typ_value: int
    code: int

    @classmethod
    def from_parts(cls, typ_value: int, code: int) -> "MessageKey":
        return cls(typ_value=typ_value, code=code)

    def to_id(self) -> str:
        # Stable id format used in XML files
        return f"{self.typ_value}:{self.code}"


class MessageCatalog:
    """Loads localized exception messages from XML files.

    XML format (example):
      <messages lang="en">
        <message id="1:1001">Invalid NC code '{value}' at line {line}</message>
      </messages>
    Where id is "{typ_value}:{code}".
    """

    def __init__(self, package: str = "ncplot7py.locales") -> None:
        self.package = package
        self._cache: Dict[str, Dict[str, str]] = {}

    def _load_lang(self, lang: str) -> Dict[str, str]:
        if lang in self._cache:
            return self._cache[lang]
        data: Dict[str, str] = {}
        try:
            file = resources.files(self.package) / f"{lang}.xml"
            with resources.as_file(file) as p:
                tree = ET.parse(p)
        except FileNotFoundError:
            self._cache[lang] = data
            return data
        root = tree.getroot()
        for msg in root.findall("message"):
            mid = msg.get("id")
            if not mid:
                continue
            text = (msg.text or "").strip()
            data[mid] = text
        self._cache[lang] = data
        return data

    def get_template(self, lang: str, key: MessageKey) -> Optional[str]:
        table = self._load_lang(lang)
        return table.get(key.to_id())

    def format_exception(self, exc: "ExceptionNodeProtocol", lang: str = "en", *, include_trace: bool = True) -> str:
        """Format an exception using a localized template when available.

        Fallback order: localized template -> exc.message -> generic fallback.
        """
        key = MessageKey.from_parts(int(exc.typ), int(exc.code))
        template = self.get_template(lang, key)
        base = template or exc.message or f"{exc.typ.name} (code={exc.code})"
        try:
            text = base.format(
                typ=exc.typ.name,
                code=int(exc.code),
                line=int(exc.line),
                value=getattr(exc, "value", ""),
            )
        except Exception:
            # If formatting failed, just use raw base
            text = base

        if not include_trace:
            return text

        # Trace details (file, line, column, context line)
        parts = [text]
        loc_bits = []
        if getattr(exc, "file", ""):
            loc_bits.append(f"file={exc.file}")
        if getattr(exc, "line", 0):
            loc_bits.append(f"line={exc.line}")
        if getattr(exc, "column", 0):
            loc_bits.append(f"col={exc.column}")
        if loc_bits:
            parts.append(" (" + ", ".join(loc_bits) + ")")
        ctx = getattr(exc, "context", "")
        if ctx:
            parts.append(f"\n  -> {ctx}")
            col = getattr(exc, "column", 0)
            if col and col > 0:
                caret = " " * (col - 1) + "^"
                parts.append("\n     " + caret)
        return "".join(parts)


# Protocol-like typing to avoid circular imports at runtime
class ExceptionNodeProtocol:
    typ: any
    code: int
    line: int
    message: str
    value: str
    file: str
    column: int
    context: str
