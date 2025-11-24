import os
import tempfile
import unittest

from ncplot7py.shared.file_adapter import get_a_file, get_program


class TestFileAdapter(unittest.TestCase):
    def test_get_a_file_reads_lines(self):
        content = "line1\nline2\n"
        with tempfile.NamedTemporaryFile(mode="w", delete=False, encoding="utf-8") as t:
            t.write(content)
            fname = t.name
        try:
            lines = get_a_file(fname)
            self.assertEqual(lines, ["line1", "line2"])
        finally:
            os.remove(fname)

    def test_remove_parentheses_and_join_single_program(self):
        lines = [
            "G01 X10 (this is a comment)",
            "Y20 (nested (inner) comment)",
            "Z30",
        ]
        progs = get_program(lines, split_on_blank_line=False)
        # parentheses content removed, lines joined with ';'
        self.assertEqual(len(progs), 1)
        self.assertEqual(progs[0], "G01 X10;Y20;Z30")

    def test_split_on_blank_lines(self):
        lines = [
            "M01 (skip)",
            "",
            "G00 X0 Y0",
            "G01 X1",
            "",
            "(full comment)",
            "G02 X2 Y2",
        ]
        progs = get_program(lines, split_on_blank_line=True)
        # expected 3 programs (first, second, third) but the middle blank-only
        # group should be skipped if empty after stripping
        self.assertEqual(progs, ["M01", "G00 X0 Y0;G01 X1", "G02 X2 Y2"]) 


if __name__ == "__main__":
    unittest.main()
