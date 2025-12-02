"""Interface for LinkedListAsList implementations.

Defines the minimal API used in tests and other modules so code can depend on
an abstract behaviour rather than a specific implementation.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, Iterable, Iterator, List, TypeVar

T = TypeVar("T")


class BaseLinkedListAsList(ABC, Generic[T]):
    @abstractmethod
    def append(self, item: T) -> None:
        pass

    @abstractmethod
    def insert_after(self, target: T, item: T) -> None:
        pass

    @abstractmethod
    def remove(self, target: T) -> T:
        pass

    @abstractmethod
    def remove_at_index(self, index: int) -> T:
        pass

    @abstractmethod
    def get_node_from_index(self, index: int) -> T:
        pass

    @abstractmethod
    def to_list(self) -> List[T]:
        pass

    @abstractmethod
    def __len__(self) -> int:
        pass

    @abstractmethod
    def __iter__(self) -> Iterator[T]:
        pass

