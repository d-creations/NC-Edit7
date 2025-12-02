# Coding Guidelines

This project favors clear, small, stdlib-first Python with helpful errors and tests. The key conventions are below.

"""Contributor codeline examples.

This module contains a minimal, stdlib-only example showing a write-only helper
function. It includes documentation and doctest examples so CI can run
`python -m doctest` against it.

Guidelines followed:
- Use only Python standard library.
- Keep examples deterministic and self-cleaning (remove temporary files).
- Provide a small doctest demonstrating usage.

"""
from __future__ import annotations

from pathlib import Path
from typing import Union


def write_text(path: Union[str, Path], text: str, append: bool = False) -> None:
    """Write text to a file using only standard library functions.

    Args:
        path: File path to write to. Can be a string or Path.
        text: Text content to write.
        append: If True, append to the file; otherwise overwrite.

    Returns:
        None

    Doctest example (runs deterministically):

    >>> # create a small file, read it back, then remove it
    >>> write_text('tmp_test.txt', 'hello')
    >>> open('tmp_test.txt', 'r', encoding='utf-8').read()
    'hello'
    >>> # clean up
    >>> import os
    >>> os.remove('tmp_test.txt')

    """
    mode = 'a' if append else 'w'
    p = Path(path)
    # Ensure parent directory exists when a Path with directories is provided
    if p.parent and not p.parent.exists():
        p.parent.mkdir(parents=True, exist_ok=True)

    # Use explicit encoding for reproducible behavior across platforms
    with p.open(mode, encoding='utf-8') as fh:
        fh.write(text)


__all__ = ["write_text"]


## Error handling and i18n

Use the structured exception `ExceptionNode` with localized messages.

- Exception types: `ExceptionTyps` (IntEnum)
  - NCCodeErrors = 1
  - NCCanalStarErrors = 2
  - CNCError = 3
- Raise errors via helper `raise_nc_error` to include trace and infer column:

  ```python
  from ncplot7py.domain.exceptions import ExceptionTyps, raise_nc_error

  raise_nc_error(
      ExceptionTyps.NCCodeErrors,
      1001,                      # maps to XML key "1:1001"
      value="M30",              # offending token (used in message formatting)
      file="program.nc",
      line=12,
      source_line="N12 G1 X10 Y10 M30",  # for caret positioning and context
  )
  ```

- Exception fields available on `ExceptionNode`:
  - `typ`, `code`, `line`, `message`, `value`
  - Trace: `file`, `column`, `context`
  - `localized(lang)` method returns a localized string with trace.

-### Message catalog (XML)
- Messages live under `src/ncplot7py/locales/{lang}.xml`.
- Each entry has id `{typ_value}:{code}`. Example (`en.xml`):

  ```xml
  <messages lang="en">
    <message id="1:1001">Invalid NC code '{value}' at line {line}</message>
  </messages>
  ```

- Avoid over-coupling to English: use placeholders `{value}`, `{line}`, `{code}`, `{typ}`.
- Provide translations in other languages (e.g. `de.xml`).

### Choosing codes
- Codes are domain-specific. Reserve ranges per area if helpful:
  - 1000–1999: NC code syntax/semantics
  - 2000–2999: canal/synchronization
  - 3000–3999: generic CNC runtime

Document new codes by adding entries to XML and referencing them in code.

### Displaying errors
- For UI/CLI, prefer `MessageCatalog().format_exception(e, lang=...)`.
- This appends trace info automatically (file, line, column) and prints context with a caret.

## Tests
- Add unit tests for new error conditions and for new message keys.
- Keep tests deterministic and small; use the standard library `unittest`.

## Style & structure
- Prefer small modules and functions.
- Standard library first; add dependencies only with justification.
- Add type hints and keep public APIs stable.

