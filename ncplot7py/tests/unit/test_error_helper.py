import unittest

from ncplot7py.domain.exceptions import ExceptionTyps, raise_nc_error, ExceptionNode
from ncplot7py.domain.i18n import MessageCatalog


class TestRaiseNCError(unittest.TestCase):
    def test_raise_with_inferred_column_and_context(self):
        try:
            raise_nc_error(
                ExceptionTyps.NCCodeErrors,
                1001,
                value="M30",
                file="program.nc",
                line=7,
                source_line="N7 G1 X10 Y10 M30",
            )
        except ExceptionNode as e:
            # Ensure fields populated
            self.assertEqual(e.line, 7)
            self.assertEqual(e.file, "program.nc")
            self.assertGreater(e.column, 0)
            self.assertIn("M30", e.context)
            # Localized formatting contains caret/trace
            s = MessageCatalog().format_exception(e, lang="en")
            self.assertIn("Invalid NC code", s)
            self.assertIn("->", s)
        else:
            self.fail("ExceptionNode was not raised")


if __name__ == "__main__":
    unittest.main()
