import unittest
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.linked_list_list import LinkedListAsList


class TestNCCommandNode(unittest.TestCase):
    def test_creation_and_str(self):
        node = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "1.0"}, nc_code_line_nr=10)
        s = str(node)
        self.assertIn("G1", s)
        self.assertIn("X=1.0", s)

    def test_copy_independence(self):
        node = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "1.0"}, nc_code_line_nr=5)
        node_copy = node.copy()
        self.assertIsNot(node, node_copy)
        self.assertEqual(node.g_code, node_copy.g_code)
        self.assertEqual(node.command_parameter, node_copy.command_parameter)

    def test_linked_list_usage(self):
        ll = LinkedListAsList[NCCommandNode]()
        a = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "0"}, nc_code_line_nr=1)
        b = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "10"}, nc_code_line_nr=2)
        ll.append(a)
        ll.append(b)
        # insert after a
        x = NCCommandNode(g_code_command={"G1"}, command_parameter={"X": "5"}, nc_code_line_nr=3)
        ll.insert_after(a, x)
        self.assertEqual(ll.get_node_from_index(1), x)


if __name__ == "__main__":
    unittest.main()
