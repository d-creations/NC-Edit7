import os
import sys
import unittest

# Ensure the package is importable when tests are run from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


class LoggingFacadeTests(unittest.TestCase):
    def setUp(self) -> None:
        from ncplot7py.shared.logging_facade import configure_logging, clear_message_stack

        # Small buffer for deterministic tests
        configure_logging(console=False, web_buffer=True, buffer_maxlen=3)
        clear_message_stack()

    def test_inmemory_buffer_and_truncation(self):
        from ncplot7py.shared.logging_facade import (
            print_message,
            print_error,
            get_message_stack,
        )

        print_message('alpha')
        print_error('beta')
        print_message('gamma')

        stack = get_message_stack()
        lines = [l for l in stack.split('\n') if l.strip()]
        self.assertEqual(len(lines), 3)
        self.assertTrue(any('INFO' in l and 'alpha' in l for l in lines))
        self.assertTrue(any('ERROR' in l and 'beta' in l for l in lines))

        # add another message to force truncation (maxlen=3)
        print_message('delta')
        lines2 = [l for l in get_message_stack().split('\n') if l.strip()]
        self.assertEqual(len(lines2), 3)
        self.assertTrue(any('delta' in l for l in lines2))

    def test_clear_message_stack(self):
        from ncplot7py.shared.logging_facade import (
            print_message,
            get_message_stack,
            clear_message_stack,
        )

        print_message('one')
        self.assertTrue(get_message_stack().strip() != '')
        clear_message_stack()
        self.assertEqual(get_message_stack().strip(), '')


class I18nIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        from ncplot7py.shared.logging_facade import configure_logging, clear_message_stack, configure_i18n

        # enable web buffer
        configure_logging(console=False, web_buffer=True, buffer_maxlen=10)
        clear_message_stack()
        # configure i18n to use bundled locales
        configure_i18n()

    def test_translate_and_log_messagekey(self):
        from ncplot7py.domain.i18n import MessageKey
        from ncplot7py.shared.logging_facade import print_translated_message, get_message_stack

        # Use a key present in locales/en.xml
        key = MessageKey.from_parts(1, 1001)
        print_translated_message(key, lang='en', value='X', line=42)
        stack = get_message_stack()
        self.assertIn('Invalid NC code', stack)
        self.assertIn('X', stack)


if __name__ == '__main__':
    unittest.main()
