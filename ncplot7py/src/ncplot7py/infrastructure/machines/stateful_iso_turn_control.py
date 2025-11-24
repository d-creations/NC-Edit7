"""A Stateful NC control implementation that wires the execution chain.

This control composes the small Chain-of-Responsibility handlers (G50/G28
handler and MotionHandler) and implements the control interface expected by
`NCExecutionEngine` (`run_nc_code_list`, `get_tool_path`, etc.).
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple, Sequence
import re
import os
import logging

from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group16_plane import GCodeGroup16PlaneExecChainLink
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group21_polar_co import GCodeGroup21PolarCoExecChainLink
from ncplot7py.interfaces.BaseNCCanal import NCControl as BaseNCControlInterface
from ncplot7py.interfaces.BaseNCControl import NCCanal as BaseNCCanalInterface

from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group0_coordinate_set import GCodeGroup0CoordinateSetExecChainLink
from ncplot7py.domain.handlers.star_machine.star_turn_handler import StarTurnHandler
from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.domain.handlers.variable import VariableHandler
from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group2_speed_mode import GCodeGroup2SpeedModeExecChainLink
from ncplot7py.shared.point import Point
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode


class StatefulIsoTurnCanal(BaseNCCanalInterface):
    """Per-canal object implementing the `NCCanal` interface.

    The canal owns its own CNCState and a short chain (G50/G28 -> Motion)
    instance used to interpret NC nodes for that canal.
    """

    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        self._name = name
        self._state = init_state or CNCState()
        # Chain: variables -> control flow -> group2 (speed mode) -> group0 -> motion
        motion = MotionHandler()
        gcode0 = GCodeGroup0CoordinateSetExecChainLink(next_handler=motion)
        # insert StarTurnHandler between group2 and group0 so machine-specific
        # Star Turn macros (e.g. G266) are handled before group0 coordinate
        # adjustments and motion handling.
        gcode2 = GCodeGroup2SpeedModeExecChainLink(next_handler=None)
        gcode16 = GCodeGroup16PlaneExecChainLink(next_handler=gcode2)

        gcode21 = GCodeGroup21PolarCoExecChainLink(next_handler=gcode16)
        # wire star handler so gcode2 -> star -> gcode0
        star = StarTurnHandler(next_handler=gcode0)
        # now set gcode2 next to star
        try:
            gcode2.next_handler = star
        except Exception:
            # fallback: if assignment fails, attempt to create gcode2 with star directly
            gcode2 = GCodeGroup2SpeedModeExecChainLink(next_handler=star)
        # Group5 handles feed mode (G98/G99) and sits between group2 and group0
        # The handler implementation is located in the fanuc_turn_cnc subpackage.
        try:
            from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode import GCodeGroup5FeedModeExecChainLink
            from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck import GcodePreCheckExecChainLink
            gcode5 = GCodeGroup5FeedModeExecChainLink(next_handler=gcode21)
            # insert precheck before group5 so we validate parameters early
            precheck = GcodePreCheckExecChainLink(next_handler=gcode5)
            control = ControlFlowHandler(next_handler=precheck)
        except Exception:
            # Fallback: if import fails, wire control directly to group2
            control = ControlFlowHandler(next_handler=gcode2)
        variable = VariableHandler(next_handler=control)
        self._chain = variable
        # keep reference to control handler so we can provide node maps per-run
        self._control_handler = control
        self._nodes: List[NCCommandNode] = []
        self._tool_path: List[Tuple[List[Point], float]] = []
        # nodes corresponding to each entry in _tool_path (parallel list)
        self._tool_nodes: List[NCCommandNode] = []
        # Default this canal to lathe-style behavior where X is interpreted as
        # diameter when we created the canal without an explicit initial
        # state. If the caller provided an `init_state` we must not override
        # their axis unit choices (tests and callers may rely on a specific
        # axis unit configuration).
        try:
            if init_state is None:
                self._state.set_axis_unit('X', 'diameter')
        except Exception:
            # if state doesn't support the helper for any reason, ignore
            pass

    def get_name(self) -> str:
        return self._name

    def run_nc_code_list(self, linked_code_list: List[NCCommandNode]) -> None:
        # convert to list and set up linked pointers so control flow handlers
        # can jump between nodes by manipulating `_next_ncCode`.
        self._nodes = list(linked_code_list)
        # record actual execution order (may differ from _nodes when
        # control flow handlers jump or loop). This list will contain the
        # nodes in the order they were processed (including repeated
        # visits) so callers can map executed program lines to tool path
        # segments.
        self._exec_sequence: List[NCCommandNode] = []
        self._tool_path = []

        # link nodes in forward/backward direction
        for i in range(len(self._nodes) - 1):
            self._nodes[i]._next_ncCode = self._nodes[i + 1]
            self._nodes[i + 1]._before_ncCode = self._nodes[i]

        # build lookup maps for labels and DO/END tokens to help control flow
        n_map = {}
        do_map = {}
        end_map = {}
        for nd in self._nodes:
            try:
                nval = nd.command_parameter.get("N")
            except Exception:
                nval = None
            if nval is not None:
                try:
                    key = float(nval)
                    n_map[key] = nd
                except Exception:
                    pass
            # detect DO/END labels inside loop_command
            lc = nd.loop_command
            if lc:
                # DO labels
                for m in re.findall(r"DO(\d+)", lc):
                    do_map.setdefault(m, []).append(nd)
                for m in re.findall(r"END(\d+)", lc):
                    end_map.setdefault(m, []).append(nd)

        # provide maps to control handler (if present)
        try:
            self._control_handler._n_map = n_map
            self._control_handler._do_map = do_map
            self._control_handler._end_map = end_map
            self._control_handler._nodes = self._nodes
            # reset any existing loop counters for this run
            self._control_handler._loop_counters = {}
        except Exception:
            pass

        # execute following `_next_ncCode` pointers; bound iterations to
        # avoid infinite loops. Handlers may update `_next_ncCode` to jump.
        node = self._nodes[0] if len(self._nodes) > 0 else None
        max_steps = max(10000, len(self._nodes) * 100)
        steps = 0
        logger = logging.getLogger(__name__)
        while node is not None and steps < max_steps:
            # record node as executed (captures loops/jumps)
            try:
                self._exec_sequence.append(node)
            except Exception:
                # defensive: if exec_sequence not writable, ignore
                pass
            pts, dur = self._chain.handle(node, self._state)
            if logger.isEnabledFor(logging.DEBUG):
                try:
                    ln = getattr(node, 'nc_code_line_nr', None)
                    g = getattr(node, 'g_code', None)
                    logger.debug("node idx=%s line=%s g_code=%s -> pts=%s dur=%s", steps, ln, g, 'Y' if pts is not None else 'N', dur)
                except Exception:
                    logger.debug("node idx=%s -> pts=%s dur=%s", steps, 'Y' if pts is not None else 'N', dur)
            if pts is not None:
                self._tool_path.append((pts, dur or 0.0))
                # record the node that produced this tool_path segment so
                # callers (e.g. NCExecutionEngine) can align programExec
                # entries with plotted segments.
                try:
                    self._tool_nodes.append(node)
                except Exception:
                    pass
            # follow pointer (handlers may have updated it)
            next_node = getattr(node, "_next_ncCode", None)
            # if next_node is same as current, break to avoid tight loop
            if next_node is node:
                break
            node = next_node
            steps += 1

    def get_tool_path(self) -> List[Tuple[List[Point], float]]:
        return self._tool_path

    def get_exec_nodes(self) -> List[NCCommandNode]:
        # Prefer the recorded nodes that produced tool_path entries when
        # available (ensures node/tool_path index alignment). Fall back to
        # the execution sequence then to the original node list for
        # compatibility.
        if hasattr(self, "_tool_nodes") and self._tool_nodes:
            return self._tool_nodes
        return getattr(self, "_exec_sequence", self._nodes)


class StatefulIsoTurnNCControl(BaseNCControlInterface):
    """Control managing multiple `StatefulIsoTurnCanal` instances.

    Implements the `NCControl` abstract interface while delegating per-canal
    execution to `StatefulIsoTurnCanal` objects.
    """

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[CNCState]] = None) -> None:
        # create canal objects
        self.count_of_canals = int(count_of_canals)
        names = []
        if canal_names is None:
            names = [f"C{i+1}" for i in range(self.count_of_canals)]
        else:
            if isinstance(canal_names, str):
                # single name given -> expand
                names = [canal_names for _ in range(self.count_of_canals)]
            else:
                names = list(canal_names)

        init_states = list(init_nc_states) if init_nc_states is not None else [None] * self.count_of_canals

        self._canals: Dict[int, StatefulIsoTurnCanal] = {}
        for idx in range(self.count_of_canals):
            init_state = init_states[idx] if idx < len(init_states) else None
            self._canals[idx + 1] = StatefulIsoTurnCanal(names[idx], init_state)

    def get_canal_name(self, canal: int) -> str:
        c = self._canals.get(canal)
        return c.get_name() if c is not None else f"C{canal}"

    def run_nc_code_list(self, linked_code_list: List[NCCommandNode], canal: int) -> None:
        c = self._canals.get(canal)
        if c is None:
            raise IndexError(f"Canal {canal} not configured")
        c.run_nc_code_list(linked_code_list)

    def get_tool_path(self, canal: int) -> List[Tuple[List[Point], float]]:
        c = self._canals.get(canal)
        if c is None:
            return []
        return c.get_tool_path()

    def get_exected_nodes(self, canal: int) -> List[NCCommandNode]:
        c = self._canals.get(canal)
        if c is None:
            return []
        return c.get_exec_nodes()

    def get_canal_count(self) -> int:
        return self.count_of_canals

    def synchro_points(self, tool_paths, nodes):
        # placeholder: no synchronization in this simple control
        return None


__all__ = ["StatefulIsoTurnNCControl"]
