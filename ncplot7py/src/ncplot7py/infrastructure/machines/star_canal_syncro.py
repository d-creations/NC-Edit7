"""Star-machine specific canal synchronization logic.

This module contains the CanalSynchro class which aligns wait-codes (M
commands) across multiple canals by adjusting the durations in the
tool-paths so waiting canals are synchronized. It mirrors the logic used
by the original implementation but is extracted for clarity and testing.
"""
from __future__ import annotations

from typing import List

from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps


class CanalSynchro:
    def __init__(self, tool_paths: list[list[tuple]], nodes: list[list[NCCommandNode]]):
        self.tool_paths = tool_paths
        self.nodes = nodes
        self.max_iterator = 9999
        if len(tool_paths) == len(nodes):
            self.count_of_canals = len(tool_paths)
        else:
            raise_nc_error(ExceptionTyps.NCCanalStarErrors, 201, message="SELECTED_CANAL_DOES_NOT_EXIST")

    def synchro_points(self):
        # only implement 2- and 3-canal synchronization cases used by star machines
        if self.count_of_canals == 2:
            nodes1: list[NCCommandNode] = self.nodes[0].copy()
            nodes2: list[NCCommandNode] = self.nodes[1].copy()
            iterator = -1
            iterator_wait1 = 0
            iterator_wait2 = 0
            time_delta_1 = 0.0
            time_delta_2 = 0.0
            while ((iterator_wait1 < len(nodes1) or iterator_wait2 < len(nodes2)) and iterator <= self.max_iterator):
                iterator += 1
                wait_c_1 = 0
                wait_c_2 = 0
                if iterator_wait1 < len(nodes1):
                    nc_command_node1: NCCommandNode = nodes1[iterator_wait1]
                    if 'M' in getattr(nc_command_node1, 'command_parameter', {}):
                        try:
                            code = int(nc_command_node1.command_parameter.get('M'))
                        except Exception:
                            code = 0
                        if code < 999 and (code > 199 or code == 40 or code == 82 or code == 41 or code == 83):
                            wait_c_1 = code
                if iterator_wait2 < len(nodes2):
                    nc_command_node2: NCCommandNode = nodes2[iterator_wait2]
                    if 'M' in getattr(nc_command_node2, 'command_parameter', {}):
                        try:
                            code = int(nc_command_node2.command_parameter.get('M'))
                        except Exception:
                            code = 0
                        if code < 999 and (code > 199 or code == 40 or code == 82 or code == 41 or code == 83):
                            wait_c_2 = code
                if iterator_wait1 < len(nodes1):
                    time_delta_1 += float(self.tool_paths[0][iterator_wait1][1])
                if iterator_wait2 < len(nodes2):
                    time_delta_2 += float(self.tool_paths[1][iterator_wait2][1])

                if wait_c_1 == 0:
                    iterator_wait1 += 1
                if wait_c_2 == 0:
                    iterator_wait2 += 1

                elif wait_c_1 == wait_c_2 and wait_c_1 != 0:
                    # equal wait code -> adjust the shorter timing to match
                    if time_delta_2 > time_delta_1:
                        self.tool_paths[0][iterator_wait1] = (self.tool_paths[0][iterator_wait1][0], time_delta_2 - time_delta_1)
                    else:
                        self.tool_paths[1][iterator_wait2] = (self.tool_paths[1][iterator_wait2][0], time_delta_1 - time_delta_2)
                    time_delta_2 = 0.0
                    time_delta_1 = 0.0
                    iterator_wait1 += 1
                    iterator_wait2 += 1
                if wait_c_1 != 0 and wait_c_2 != 0 and wait_c_2 != wait_c_1:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 202, message="WAIT_CODE_NOT_MATCH")
                if iterator >= self.max_iterator - 5:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 203, message="WAIT_CODE_NOT_MATCH")

        elif self.count_of_canals == 3:
            nodes1: list[NCCommandNode] = self.nodes[0].copy()
            nodes2: list[NCCommandNode] = self.nodes[1].copy()
            nodes3: list[NCCommandNode] = self.nodes[2].copy()
            iterator = -1
            iterator_wait1 = 0
            iterator_wait2 = 0
            iterator_wait3 = 0
            time_delta_1 = 0.0
            time_delta_2 = 0.0
            time_delta_3 = 0.0

            while ((iterator_wait1 < len(nodes1) or iterator_wait2 < len(nodes2) or iterator_wait3 < len(nodes3)) and iterator <= self.max_iterator + 1):
                iterator += 1
                wait_c_1 = [0, 0]
                wait_c_2 = [0, 0]
                wait_c_3 = [0, 0]

                if iterator_wait1 < len(nodes1):
                    nc_command_node1: NCCommandNode = nodes1[iterator_wait1]
                    if 'M' in getattr(nc_command_node1, 'command_parameter', {}):
                        try:
                            code = int(nc_command_node1.command_parameter.get('M'))
                        except Exception:
                            code = 0
                        if code in (83, 82, 40, 41):
                            wait_c_1 = [code, 12]
                        if code in (131, 133):
                            wait_c_1 = [code, 13]
                        if code < 999 and code > 199:
                            # P parameter may indicate grouping index
                            if 'P' in getattr(nc_command_node1, 'command_parameter', {}):
                                try:
                                    wait_c_1 = [code, int(nc_command_node1.command_parameter.get('P'))]
                                except Exception:
                                    wait_c_1 = [code, 123]
                            else:
                                wait_c_1 = [code, 123]

                if iterator_wait2 < len(nodes2):
                    nc_command_node2: NCCommandNode = nodes2[iterator_wait2]
                    if 'M' in getattr(nc_command_node2, 'command_parameter', {}):
                        try:
                            code = int(nc_command_node2.command_parameter.get('M'))
                        except Exception:
                            code = 0
                        if code in (83, 82, 40, 41):
                            wait_c_2 = [code, 12]
                        if code in (131, 133):
                            wait_c_2 = [code, 13]
                        if code < 999 and code > 199:
                            if 'P' in getattr(nc_command_node2, 'command_parameter', {}):
                                try:
                                    wait_c_2 = [code, int(nc_command_node2.command_parameter.get('P'))]
                                except Exception:
                                    wait_c_2 = [code, 123]
                            else:
                                wait_c_2 = [code, 123]

                if iterator_wait3 < len(nodes3):
                    nc_command_node3: NCCommandNode = nodes3[iterator_wait3]
                    if 'M' in getattr(nc_command_node3, 'command_parameter', {}):
                        try:
                            code = int(nc_command_node3.command_parameter.get('M'))
                        except Exception:
                            code = 0
                        if code in (131, 133):
                            wait_c_3 = [code, 13]
                        if code < 999 and code > 199:
                            if 'P' in getattr(nc_command_node3, 'command_parameter', {}):
                                try:
                                    wait_c_3 = [code, int(nc_command_node3.command_parameter.get('P'))]
                                except Exception:
                                    wait_c_3 = [code, 123]
                            else:
                                wait_c_3 = [code, 123]

                if iterator_wait1 < len(nodes1):
                    time_delta_1 += float(self.tool_paths[0][iterator_wait1][1])
                if iterator_wait2 < len(nodes2):
                    time_delta_2 += float(self.tool_paths[1][iterator_wait2][1])
                if iterator_wait3 < len(nodes3):
                    time_delta_3 += float(self.tool_paths[2][iterator_wait3][1])

                # pairwise syncs
                if wait_c_2[1] == 12 and wait_c_2[0] == wait_c_1[0] and wait_c_2[0] != 0:
                    if time_delta_2 > time_delta_1:
                        self.tool_paths[0][iterator_wait1] = (self.tool_paths[0][iterator_wait1][0], time_delta_2 - time_delta_1)
                    else:
                        self.tool_paths[1][iterator_wait2] = (self.tool_paths[1][iterator_wait2][0], time_delta_1 - time_delta_2)
                    time_delta_2 = 0.0
                    time_delta_1 = 0.0
                    iterator_wait1 += 1
                    iterator_wait2 += 1
                if wait_c_1[1] == 13 and wait_c_3[0] == wait_c_1[0] and wait_c_1[0] != 0:
                    if time_delta_3 > time_delta_1:
                        self.tool_paths[0][iterator_wait1] = (self.tool_paths[0][iterator_wait1][0], time_delta_3 - time_delta_1)
                    else:
                        self.tool_paths[2][iterator_wait3] = (self.tool_paths[2][iterator_wait3][0], time_delta_1 - time_delta_3)
                    time_delta_3 = 0.0
                    time_delta_1 = 0.0
                    iterator_wait1 += 1
                    iterator_wait3 += 1

                if wait_c_2[1] == 23 and wait_c_3[0] == wait_c_2[0] and wait_c_2[0] != 0:
                    if time_delta_3 > time_delta_2:
                        self.tool_paths[1][iterator_wait2] = (self.tool_paths[1][iterator_wait2][0], time_delta_3 - time_delta_2)
                    else:
                        self.tool_paths[2][iterator_wait3] = (self.tool_paths[2][iterator_wait3][0], time_delta_2 - time_delta_3)
                    time_delta_3 = 0.0
                    time_delta_2 = 0.0
                    iterator_wait2 += 1
                    iterator_wait3 += 1

                # three-way sync
                if wait_c_1[1] == 123 and (wait_c_1[0] == wait_c_2[0] == wait_c_3[0]) and wait_c_1[0] != 0:
                    if time_delta_3 > time_delta_1 and time_delta_3 > time_delta_2:
                        self.tool_paths[0][iterator_wait1] = (self.tool_paths[0][iterator_wait1][0], time_delta_3 - time_delta_1)
                        self.tool_paths[1][iterator_wait2] = (self.tool_paths[1][iterator_wait2][0], time_delta_3 - time_delta_2)
                    elif time_delta_2 > time_delta_1 and time_delta_2 > time_delta_3:
                        self.tool_paths[0][iterator_wait1] = (self.tool_paths[0][iterator_wait1][0], time_delta_2 - time_delta_1)
                        self.tool_paths[2][iterator_wait3] = (self.tool_paths[2][iterator_wait3][0], time_delta_2 - time_delta_3)
                    else:
                        self.tool_paths[1][iterator_wait2] = (self.tool_paths[1][iterator_wait2][0], time_delta_1 - time_delta_2)
                        self.tool_paths[2][iterator_wait3] = (self.tool_paths[2][iterator_wait3][0], time_delta_1 - time_delta_3)
                    time_delta_3 = 0.0
                    time_delta_2 = 0.0
                    time_delta_1 = 0.0
                    iterator_wait1 += 1
                    iterator_wait2 += 1
                    iterator_wait3 += 1

                if wait_c_1[1] == 0:
                    iterator_wait1 += 1
                if wait_c_2[1] == 0:
                    iterator_wait2 += 1
                if wait_c_3[1] == 0:
                    iterator_wait3 += 1

                # mismatch checks
                if wait_c_2[1] == 12 and wait_c_1[1] == 12 and wait_c_2[0] != wait_c_1[0]:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 204, message="WAIT_CODE_NOT_MATCH")
                if wait_c_3[1] == 13 and wait_c_1[1] == 13 and wait_c_3[0] != wait_c_1[0]:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 205, message="WAIT_CODE_NOT_MATCH")
                if wait_c_3[1] == 23 and wait_c_2[1] == 23 and wait_c_3[0] != wait_c_2[0]:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 206, message="WAIT_CODE_NOT_MATCH")
                if wait_c_3[1] == 123 and wait_c_1[1] == 123 and wait_c_2[1] == 123 and (wait_c_3[0] != wait_c_1[0] or wait_c_3[0] != wait_c_2[0]):
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 207, message="WAIT_CODE_NOT_MATCH")

                if iterator >= self.max_iterator - 3:
                    raise_nc_error(ExceptionTyps.NCCanalStarErrors, 208, message="WAIT_CODE_NOT_MATCH")


__all__ = ["CanalSynchro"]
