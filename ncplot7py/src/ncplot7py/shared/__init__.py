"""Shared utilities exports for ncplot7py.shared.

This package exposes a small logging facade. The previous `OutputManager`
implementation has been replaced by `logging_facade` which integrates with
Python's `logging` module and provides an in-memory handler for web UIs.
"""
from .logging_facade import (
	configure_logging,
	get_logger,
	print_message,
	print_error,
	print_translated_message,
	print_translated_error,
	configure_i18n,
	translate_message,
	get_message_stack,
	clear_message_stack,
	InMemoryLogHandler,
)

__all__ = [
	"configure_logging",
	"get_logger",
	"print_message",
	"print_error",
	"print_translated_message",
	"print_translated_error",
	"configure_i18n",
	"translate_message",
	"get_message_stack",
	"clear_message_stack",
	"InMemoryLogHandler",
]
