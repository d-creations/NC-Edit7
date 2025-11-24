"""
File adapter utilities.

Provides simple helpers to read file lines and build program strings while
removing parenthesized content. This is a small, robust replacement for the
snippet in the prompt.

Functions
- get_a_file(path, encoding='utf-8') -> list[str]
- get_program(file_name_or_lines, split_on_blank_line=True) -> list[str]
"""
from __future__ import annotations

import pathlib
import re
from typing import Iterable, List, Union


def get_a_file(name: Union[str, pathlib.Path], encoding: str = "utf-8") -> List[str]:
    """Read a text file and return its lines without trailing newlines.

    Parameters
    - name: path to the file (str or Path)
    - encoding: file encoding

    Returns
    - list of lines (each line is a str, no trailing '\n')
    """
    path = pathlib.Path(name)
    with path.open("r", encoding=encoding) as f:
        # rstrip only the trailing newline characters, keep other whitespace
        return [line.rstrip("\n\r") for line in f]


def _remove_parentheses(text: str) -> str:
    """Remove all parenthesized content, including nested parentheses.

    Repeatedly removes occurrences of parenthesized chunks until none remain.
    This handles nested parentheses by removing the innermost pairs first.
    """
    # quick bailout
    if "(" not in text:
        return text
    # remove parentheses iteratively
    pattern = re.compile(r"\([^()]*\)")
    while True:
        new = pattern.sub("", text)
        if new == text:
            break
        text = new
    return text


def get_program(
    file_name_or_lines: Union[str, pathlib.Path, Iterable[str]],
    split_on_blank_line: bool = True,
) -> List[str]:
    """Build one or more program strings from a file or lines.

    Behavior:
    - If ``file_name_or_lines`` is a path (str/Path), the file is read as lines.
    - Parenthesized content is removed from each line (handles nested).
    - Lines that are empty after stripping are treated as blank separators when
      ``split_on_blank_line`` is True; programs are split on these blank lines.
    - Otherwise all non-empty processed lines are joined with ';' and returned
      as a single-element list.

    Returns a list of program strings (each program is a single string where
    original lines are joined by ';'). Each program will not have a trailing
    semicolon.
    """
    # accept either an iterable of lines or a filename
    if isinstance(file_name_or_lines, (str, pathlib.Path)):
        lines = get_a_file(file_name_or_lines)
    else:
        lines = list(file_name_or_lines)

    processed_lines: List[str] = []
    for raw in lines:
        # remove newline already stripped by get_a_file; keep other whitespace
        line = raw
        # remove parenthesized segments
        line = _remove_parentheses(line)
        # collapse internal whitespace to single spaces (optional but helpful)
        # preserve leading/trailing spaces for emptiness check
        line = re.sub(r"\s+", " ", line)
        processed_lines.append(line.strip())

    if split_on_blank_line:
        programs: List[str] = []
        current: List[str] = []
        for pline in processed_lines:
            if pline == "":
                if current:
                    programs.append(";".join(current))
                    current = []
            else:
                current.append(pline)
        if current:
            programs.append(";".join(current))
        return programs
    else:
        # join all non-empty lines into a single program
        all_lines = [l for l in processed_lines if l != ""]
        return [";".join(all_lines)]


__all__ = ["get_a_file", "get_program"]
