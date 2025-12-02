import os
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl
from ncplot7py.shared import configure_logging, configure_i18n


class TestStarCanalSynchroIntegration(unittest.TestCase):
    def test_two_canal_program_sync(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Simple two-canal programs embedded here.
        # Put the M wait code on the same motion line so the motion node
        # includes the M parameter and produces a tool-path entry that
        # aligns with the node list used by the synchroniser.
        # add a startup code and an extra motion line to exercise parser and timing
        prog1 = "G98; G1 X0; G1 X10 F60 M300; G1 X12;"
        prog2 = "G98; G1 X0; G1 X5 F60 M300; G1 X6;"

        ctrl = StatefulIsoTurnNCControl(count_of_canals=2)
        engine = NCExecutionEngine(ctrl)

        result = engine.get_Syncro_plot([prog1, prog2], synch=True)

        # Should return a list with two canal dicts when successful
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 2)
        for canal in result:
            # each canal should include a 'plot' key with at least one line
            self.assertIn('plot', canal)
            self.assertIsInstance(canal['plot'], list)
            self.assertGreaterEqual(len(canal['plot']), 1)
            # each plot entry should include a non-negative numeric time
            for entry in canal['plot']:
                self.assertIn('t', entry)
                self.assertIsInstance(entry['t'], float)
                self.assertGreaterEqual(entry['t'], 0.0)

    def test_three_canal_program_sync(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # Three-canal programs with M on the motion lines (same rationale)
        # ensure each NC statement is terminated by ';' so the parser sees
        # separate command lines (avoid duplicate parameter tokens in one line)
        # make programs slightly longer and add a P parameter on canal2's M
        prog1 = "G98;M250P12; G1 X0; G1 X10; G1 X8 F120 M500; M310;"
        prog2 = "G98;M250P12;M260 P23; G1 X0; G1 X4 F120 M500 P12; G1 X2; G1 X4; M310;"
        prog3 = "G98;M260P23; G1 X0; G1 X10; G1 X10; G1 X12 F120 M500; M80; M310;"

        ctrl = StatefulIsoTurnNCControl(count_of_canals=3)
        engine = NCExecutionEngine(ctrl)

        result = engine.get_Syncro_plot([prog1, prog2, prog3], synch=True)

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)
        for canal in result:
            self.assertIn('plot', canal)
            self.assertIsInstance(canal['plot'], list)
            self.assertGreaterEqual(len(canal['plot']), 1)
            for entry in canal['plot']:
                self.assertIn('t', entry)
                self.assertIsInstance(entry['t'], float)
                self.assertGreaterEqual(entry['t'], 0.0)

    def test_two_canal_mismatch_returns_error(self):
        configure_logging(console=False, web_buffer=True)
        configure_i18n()

        # same motions but different M wait codes -> should trigger mismatch
        prog1 = "G1 X10; G1 X10 F60 M300; G1 X12;"
        prog2 = "G1 X10; G1 X5 F60 M301; G1 X6;"

        ctrl = StatefulIsoTurnNCControl(count_of_canals=2)
        engine = NCExecutionEngine(ctrl)

        result = engine.get_Syncro_plot([prog1, prog2], synch=True)

        # The engine now returns partial results even when synchronization fails
        # The errors are collected in engine.errors for the frontend to display
        self.assertTrue(len(engine.errors) > 0, "Expected sync error to be collected")
        # Result should still have the partial plot data that was generated before the error
        self.assertIsInstance(result, list)


if __name__ == '__main__':
    unittest.main()
