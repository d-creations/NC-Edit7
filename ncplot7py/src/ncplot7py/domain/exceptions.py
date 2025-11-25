"""Domain-specific exceptions.

This module provides a small, typed exception class suitable for tracing
errors originating from CNC/NC code parsing and handling. The class is
lightweight, serializable and has a pleasant string representation for
consumers (CLI/IDE/web) so we can present clean error messages to users.
"""

from __future__ import annotations

from enum import IntEnum
from dataclasses import dataclass, asdict
from typing import Any


class ExceptionTyps(IntEnum):
	"""Types of domain exceptions.

	Values are small ints to make serialization compact where necessary.
	"""

	NCCodeErrors = 1
	NCCanalStarErrors = 2
	CNCError = 3


@dataclass
class ExceptionNode(Exception):
	"""A structured exception carrying CNC error information.

	Fields:
	  typ: Which category of error (ExceptionTyps).
	  code: Numeric error code (domain-specific).
	  line: Source line number where the error occurred (1-based), 0 if unknown.
	  message: Human readable message describing the error.
	  value: Optional value/context (e.g. offending token or text).

	The class inherits from Exception so it can be raised. It also provides
	`to_dict()` and a friendly `__str__()` for user-facing output.
	"""

	typ: ExceptionTyps
	code: int = 0
	line: int = 0
	message: str = ""
	value: Any = ""
	# Traceback-ish metadata for better diagnostics
	file: str = ""
	column: int = 0
	context: str = ""

	def __post_init__(self) -> None:
		# Ensure base Exception gets the message so built-in tooling sees it.
		Exception.__init__(self, self.message)

	def to_dict(self) -> dict:
		"""Return a plain-serializable representation of the exception."""
		data = asdict(self)
		# Represent enum as its name (and maybe value) for consumers.
		data["typ"] = {"name": self.typ.name, "value": int(self.typ)}
		return data

	def __str__(self) -> str:  # pragma: no cover - simple formatting
		parts = [f"{self.typ.name} (code={self.code})"]
		if self.line:
			parts.append(f"line={self.line}")
		if self.message:
			parts.append(f"message={self.message}")
		if self.value not in ("", None):
			parts.append(f"value={self.value}")
		if self.file:
			parts.append(f"file={self.file}")
		if self.column:
			parts.append(f"col={self.column}")
		return "; ".join(parts)

	def localized(self, lang: str = "en") -> str:
		"""Return a localized message if a catalog is available.

		This avoids importing i18n at module import time to keep domain slim.
		"""
		try:
			from .i18n import MessageCatalog

			catalog = MessageCatalog()
			return catalog.format_exception(self, lang=lang, include_trace=True)
		except Exception:
			return str(self)


def raise_nc_error(
	typ: ExceptionTyps,
	code: int,
	*,
	message: str = "",
	value: Any = "",
	file: str = "",
	line: int = 0,
	column: int = 0,
	source_line: str = "",
) -> None:
	"""Raise an ExceptionNode with best-effort column/context extraction.

	Parameters:
		typ: Exception type (ExceptionTyps)
		code: Numeric error code
		message: Human readable fallback message if i18n template not found
		value: Offending value/token
		file: Source file name/path
		line: 1-based line number
		column: 1-based column number; if 0 and source_line+value are provided,
				column will be inferred from the first match of value within
				source_line.
		source_line: The full line text to include as context (optional)
	"""

	inferred_col = column
	ctx = source_line
	if (not inferred_col) and value and source_line:
		try:
			idx = source_line.find(str(value))
			if idx >= 0:
				inferred_col = idx + 1  # 1-based
		except Exception:
			inferred_col = column or 0

	exc = ExceptionNode(
		typ=typ,
		code=code,
		line=line,
		message=message,
		value=value,
		file=file,
		column=inferred_col or column,
		context=ctx,
	)
	raise exc


