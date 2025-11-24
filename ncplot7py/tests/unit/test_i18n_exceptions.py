import unittest

from ncplot7py.domain.exceptions import ExceptionNode, ExceptionTyps
from ncplot7py.domain.i18n import MessageCatalog


class TestI18nExceptions(unittest.TestCase):
    def test_localized_message_en(self):
        e = ExceptionNode(ExceptionTyps.NCCodeErrors, code=1001, line=12, value="M30", file="program.nc", column=6, context="N10 M30")
        cat = MessageCatalog()
        s = cat.format_exception(e, lang="en")
        self.assertIn("Invalid NC code 'M30'", s)
        self.assertIn("line 12", s)  # either in message or trace
        self.assertIn("program.nc", s)
        self.assertIn("-> N10 M30", s)

    def test_localized_message_de(self):
        e = ExceptionNode(ExceptionTyps.NCCodeErrors, code=1001, line=3, value="G1")
        s = MessageCatalog().format_exception(e, lang="de", include_trace=False)
        self.assertIn("Ungültiger NC-Code 'G1'", s)
        self.assertIn("Zeile 3", s)

    def test_fallback_when_missing(self):
        # Code not in the catalog -> fallback to message or generic
        e = ExceptionNode(ExceptionTyps.CNCError, code=9999, line=1, message="fallback message")
        s = MessageCatalog().format_exception(e, lang="en", include_trace=False)
        self.assertIn("fallback message", s)


if __name__ == "__main__":
    unittest.main()
