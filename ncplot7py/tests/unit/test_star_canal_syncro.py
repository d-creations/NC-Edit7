import unittest

from ncplot7py.infrastructure.machines.star_canal_syncro import CanalSynchro
from ncplot7py.shared.nc_nodes import NCCommandNode


class TestStarCanalSynchro(unittest.TestCase):
    def test_two_canals_basic(self):
        # canal 0: durations [0.5, 1.0, 0.2]
        # canal 1: durations [0.6, 0.8, 0.3]
        tool_paths = [
            [([], 0.5), ([], 1.0), ([], 0.2)],
            [([], 0.6), ([], 0.8), ([], 0.3)],
        ]

        # nodes: wait at index 1 for both canals (M=300)
        nodes0 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "300"}), NCCommandNode(None, {})]
        nodes1 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "300"}), NCCommandNode(None, {})]

        syn = CanalSynchro(tool_paths, [nodes0, nodes1])
        syn.synchro_points()

        # expected: canal1 index1 duration becomes time_delta_1 - time_delta_2 = 1.5 - 1.4 = 0.1
        self.assertAlmostEqual(tool_paths[1][1][1], 0.1, places=6)

    def test_three_canals_three_way(self):
        # durations chosen so canal2 is the slowest up to the wait point
        tool_paths = [
            [([], 0.2), ([], 0.7), ([], 0.3)],
            [([], 0.3), ([], 0.4), ([], 0.2)],
            [([], 0.1), ([], 1.5), ([], 0.1)],
        ]

        # nodes: wait at index 1 for all canals with same M (500)
        nodes0 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "500"}), NCCommandNode(None, {})]
        nodes1 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "500"}), NCCommandNode(None, {})]
        nodes2 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "500"}), NCCommandNode(None, {})]

        syn = CanalSynchro(tool_paths, [nodes0, nodes1, nodes2])
        syn.synchro_points()

        # After sync, canal2 is the slowest (time_delta_3 = 1.6), so
        # canal0[1] should be 1.6 - 0.9 = 0.7
        # canal1[1] should be 1.6 - 0.7 = 0.9
        self.assertAlmostEqual(tool_paths[0][1][1], 0.7, places=6)
        self.assertAlmostEqual(tool_paths[1][1][1], 0.9, places=6)

    def test_three_canals_with_P_pairwise_sync(self):
        # Test that M codes with a 'P' parameter (grouping index) lead to
        # pairwise synchronization when the code and P indicate a pair.
        tool_paths = [
            [([], 0.2), ([], 0.7), ([], 0.3)],
            [([], 0.3), ([], 1.0), ([], 0.2)],
            [([], 0.1), ([], 0.4), ([], 0.1)],
        ]

        # canal0: wait without P
        nodes0 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "500"}), NCCommandNode(None, {})]
        # canal1: same M but with P=12 -> should pairwise-sync with canal0 when
        # pairwise condition is met (wait_c_2[1] == 12)
        nodes1 = [NCCommandNode(None, {}), NCCommandNode(None, {"M": "500", "P": "12"}), NCCommandNode(None, {})]
        # canal2: no wait
        nodes2 = [NCCommandNode(None, {}), NCCommandNode(None, {}), NCCommandNode(None, {})]

        # keep a copy of original durations to assert that an adjustment occurred
        orig = [[t[1] for t in tp] for tp in tool_paths]

        syn = CanalSynchro(tool_paths, [nodes0, nodes1, nodes2])
        syn.synchro_points()

        # At least one of the wait durations in canal0/canal1 should have changed
        after = [[t[1] for t in tp] for tp in tool_paths]
        changed = False
        for i in range(len(orig)):
            for j in range(len(orig[i])):
                if abs(orig[i][j] - after[i][j]) > 1e-9:
                    changed = True
                    break
            if changed:
                break

        self.assertTrue(changed, "Expected at least one duration to be adjusted for P-based pairwise sync")


if __name__ == "__main__":
    unittest.main()

