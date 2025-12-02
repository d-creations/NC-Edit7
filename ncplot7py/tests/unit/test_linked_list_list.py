import unittest
from ncplot7py.shared.linked_list_list import LinkedListAsList
from typing import Dict


class NCNode:
	line: int
	cmd: str
	params: Dict[str, str]

class DummyNode(NCNode):
    def __init__(self, line: int, cmd: str, params: dict | None = None):
        # NCNode is a simple annotated class with no __init__, so set attributes
        # directly instead of calling super().__init__()
        self.line = line
        self.cmd = cmd
        self.params = params or {}


class TestLinkedListAsList(unittest.TestCase):
    def test_append_and_len(self):
        ll = LinkedListAsList[DummyNode]()
        a = DummyNode(1, "G1")
        b = DummyNode(2, "G1")
        ll.append(a)
        ll.append(b)
        self.assertEqual(len(ll), 2)

    def test_insert_after(self):
        ll = LinkedListAsList[DummyNode]()
        a = DummyNode(1, "G1")
        b = DummyNode(2, "G1")
        x = DummyNode(3, "G1")
        ll.append(a)
        ll.append(b)
        ll.insert_after(a, x)
        self.assertEqual(ll.get_node_from_index(1), x)

    def test_remove(self):
        ll = LinkedListAsList[DummyNode]()
        a = DummyNode(1, "G1")
        b = DummyNode(2, "G1")
        ll.append(a)
        ll.append(b)
        removed = ll.remove(a)
        self.assertIs(removed, a)
        self.assertEqual(len(ll), 1)


if __name__ == "__main__":
    unittest.main()
