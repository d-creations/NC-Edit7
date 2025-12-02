"""Linked-list-like wrapper implemented with a Python built-in list.

This provides a small API similar to a doubly-linked list (append, insert_after,
remove, get_node_from_index) but implemented on top of Python's list. Operations
that require finding a node by reference are O(n) because the underlying list
must be searched. Use this when you want linked-list semantics but prefer to
avoid per-node Python objects or explicit linked pointers.

Notes:
- append: O(1) amortized
- insert_after: O(n) to find the target + O(n) to shift elements -> O(n)
- remove: O(n)

This is a pragmatic compromise: for many NC-code workloads the list approach
is simpler and fast enough. If you need many O(1) arbitrary inserts/removes by
node reference, prefer a true linked list implementation.
"""
from __future__ import annotations

from typing import Generic, Iterable, Iterator, List, TypeVar

T = TypeVar("T")

from ..interfaces.BaseLinkedListAsList import BaseLinkedListAsList


class LinkedListAsList(BaseLinkedListAsList[T], Generic[T]):
    """A thin wrapper exposing linked-list-like operations backed by a list.

    Example:
        nodes = LinkedListAsList[NCNode]()
        nodes.append(node_a)
        nodes.append(node_b)
        nodes.insert_after(node_a, node_x)
    """

    def __init__(self, items: Iterable[T] | None = None) -> None:
        self._data: List[T] = list(items) if items is not None else []

    def append(self, item: T) -> None:
        """Append item to the end (amortized O(1))."""
        self._data.append(item)

    def insert_after(self, target: T, item: T) -> None:
        """Insert `item` immediately after `target`.

        Raises ValueError if target is not present.
        Complexity: O(n) to find + O(n) to insert (shifting) => O(n)
        """
        idx = self._data.index(target)  # raises ValueError if not found
        self._data.insert(idx + 1, item)

    def remove(self, target: T) -> T:
        """Remove `target` from the list and return it.

        Raises ValueError if target is not present.
        """
        idx = self._data.index(target)
        return self._data.pop(idx)

    def remove_at_index(self, index: int) -> T:
        return self._data.pop(index)

    def get_node_from_index(self, index: int) -> T:
        return self._data[index]

    def __len__(self) -> int:
        return len(self._data)

    def __iter__(self) -> Iterator[T]:
        return iter(self._data)

    def to_list(self) -> List[T]:
        return list(self._data)

    def __repr__(self) -> str:  # pragma: no cover - convenience
        return f"LinkedListAsList({self._data!r})"
