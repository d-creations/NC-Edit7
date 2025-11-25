"""CLI bootstrap helpers.

Provide a small `bootstrap()` function that registers builtin adapters
into the shared `registry`. This keeps import-time side-effects out of
module import and makes tests deterministic.
"""
from __future__ import annotations

from typing import Optional

from ncplot7py.shared.registry import registry


def bootstrap(reg: Optional[object] = None) -> None:
	"""Register built-in adapters (idempotent).

	Parameters:
		reg: Optional registry object; if omitted the shared `registry` is used.
	"""
	reg = reg or registry

	# Avoid repeated registration
	if reg.get("parser", "nc_command") is None:
		try:
			from ncplot7py.infrastructure.parsers.nc_command_parser import register as _reg_p

			_reg_p(reg)
		except Exception:
			# Keep bootstrap safe even if optional adapters fail
			pass


def main() -> None:  # pragma: no cover - CLI entrypoint
	bootstrap()


if __name__ == "__main__":
	main()

