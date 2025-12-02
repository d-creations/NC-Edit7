"""Logging facade for ncplot7py.

Provides a small wrapper around Python's `logging` module that keeps the
callers' API small (print_message, print_error) and also supplies an
in-memory handler suitable for web UIs to collect recent log messages.

Usage:
    from ncplot7py.shared.logging_facade import configure_logging, print_message
    configure_logging(console=True, web_buffer=True)
    print_message("hello")

The facade exposes `get_message_stack()` which returns the collected web
messages when `web_buffer=True` was used during configuration.
"""
from __future__ import annotations

import logging
from collections import deque
from typing import Deque, List, Optional
from typing import Any


# i18n support (lazy import to avoid import cycles when package is imported)
_catalog: Optional[Any] = None
_default_lang: str = "en"


def configure_i18n(catalog: Optional[Any] = None, default_lang: str = "en") -> None:
    """Configure a MessageCatalog instance for translations.

    If `catalog` is None the function will create a default
    `ncplot7py.domain.i18n.MessageCatalog` instance.
    """
    global _catalog, _default_lang
    _default_lang = default_lang
    if catalog is None:
        try:
            from ncplot7py.domain.i18n import MessageCatalog  # type: ignore

            _catalog = MessageCatalog()
        except Exception:
            _catalog = None
    else:
        _catalog = catalog


def translate_message(key: Any, lang: Optional[str] = None, **params: Any) -> str:
    """Translate a message `key` via the configured MessageCatalog.

    `key` is expected to be a `MessageKey` instance from
    `ncplot7py.domain.i18n`. If translation fails or no catalog is
    configured, falls back to formatting `str(key)` with params.
    """
    if lang is None:
        lang = _default_lang
    if _catalog is None:
        # No catalog configured, fall back
        try:
            return str(key).format(**params)
        except Exception:
            return str(key)
    try:
        # MessageCatalog.get_template expects a MessageKey-like object
        template = _catalog.get_template(lang, key)
        if template:
            try:
                return template.format(**params)
            except Exception:
                return template
        # fallback: format the key or use provided params
        try:
            return str(key).format(**params)
        except Exception:
            return str(key)
    except Exception:
        try:
            return str(key).format(**params)
        except Exception:
            return str(key)


class InMemoryLogHandler(logging.Handler):
    """A simple bounded in-memory log handler.

    Stores formatted log records in a deque with a configurable maximum
    length. Call `get_messages()` to retrieve the stored messages (most
    recent last).
    """

    def __init__(self, maxlen: int = 1000):
        super().__init__()
        self._buffer: Deque[str] = deque(maxlen=maxlen)

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
        except Exception:
            msg = record.getMessage()
        self._buffer.append(msg)

    def get_messages(self) -> List[str]:
        return list(self._buffer)

    def clear(self) -> None:
        self._buffer.clear()


# Module-level state
_logger_name = "ncplot7py"
_logger: logging.Logger = logging.getLogger(_logger_name)
_in_memory_handler: Optional[InMemoryLogHandler] = None


def configure_logging(*, console: bool = True, web_buffer: bool = False,
                      level: int = logging.INFO, buffer_maxlen: int = 1000) -> None:
    """Configure the `ncplot7py` logger.

    - console: attach a StreamHandler to stdout/stderr
    - web_buffer: attach an in-memory handler for later retrieval
    - level: logging level for the logger and handlers
    - buffer_maxlen: max messages kept by the in-memory handler
    """

    global _logger, _in_memory_handler

    # Remove existing handlers to allow reconfiguration
    _logger = logging.getLogger(_logger_name)
    _logger.setLevel(level)
    for h in list(_logger.handlers):
        _logger.removeHandler(h)

    formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")

    if console:
        ch = logging.StreamHandler()
        ch.setLevel(level)
        ch.setFormatter(formatter)
        _logger.addHandler(ch)

    if web_buffer:
        _in_memory_handler = InMemoryLogHandler(maxlen=buffer_maxlen)
        _in_memory_handler.setLevel(level)
        _in_memory_handler.setFormatter(formatter)
        _logger.addHandler(_in_memory_handler)
    else:
        _in_memory_handler = None


def get_logger() -> logging.Logger:
    return _logger


def print_message(msg: str) -> None:
    _logger.info(msg)


def print_error(msg: str) -> None:
    _logger.error(msg)


def print_translated_message(key: Any, lang: Optional[str] = None, **params: Any) -> None:
    text = translate_message(key, lang=lang, **params)
    _logger.info(text)


def print_translated_error(key: Any, lang: Optional[str] = None, **params: Any) -> None:
    text = translate_message(key, lang=lang, **params)
    _logger.error(text)


def get_message_stack() -> str:
    """Return the collected web messages joined with newlines.

    If the in-memory handler is not configured, returns an empty string.
    """
    if _in_memory_handler is None:
        return ""
    return "\n".join(_in_memory_handler.get_messages())


def clear_message_stack() -> None:
    if _in_memory_handler is not None:
        _in_memory_handler.clear()


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
