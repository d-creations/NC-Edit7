import unittest

from ncplot7py.domain.exceptions import ExceptionNode, ExceptionTyps


class TestExceptionNode(unittest.TestCase):
    def test_basic_fields_and_str(self):
        e = ExceptionNode(ExceptionTyps.NCCodeErrors, code=42, line=10, message="bad token", value="G1 X")
        s = str(e)
        self.assertIn("NCCodeErrors", s)
        self.assertIn("code=42", s)
        self.assertIn("line=10", s)
        self.assertIn("message=bad token", s)
        self.assertIn("value=G1 X", s)

    def test_to_dict(self):
        e = ExceptionNode(ExceptionTyps.CNCError, code=7, line=0, message="oops")
        d = e.to_dict()
        self.assertEqual(d["code"], 7)
        self.assertEqual(d["line"], 0)
        self.assertEqual(d["message"], "oops")
        self.assertEqual(d["typ"]["name"], "CNCError")
        self.assertEqual(d["typ"]["value"], int(ExceptionTyps.CNCError))

    def test_raises_like_exception(self):
        e = ExceptionNode(ExceptionTyps.NCCanalStarErrors, code=1, message="boom")
        with self.assertRaises(ExceptionNode):
            raise e


if __name__ == "__main__":
    unittest.main()
