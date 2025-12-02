"""Stateful Siemens Mill Control Implementation."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple, Sequence
import re
import logging

from ncplot7py.interfaces.BaseNCCanal import NCControl as BaseNCControlInterface
from ncplot7py.interfaces.BaseNCControl import NCCanal as BaseNCCanalInterface
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.point import Point

# Handlers
from ncplot7py.domain.handlers.variable import VariableHandler
from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.domain.handlers.tool_handler import ToolHandler
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group16_plane import GCodeGroup16PlaneExecChainLink

# Siemens Specific Handlers
from ncplot7py.domain.handlers.siemens_mill_cnc.mode_handler import SiemensModeHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.coordinate_handler import SiemensISOCoordinateHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.feed_handler import SiemensISOFeedHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.cycles_handler import SiemensISOCyclesHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.tool_length_handler import SiemensISOToolLengthHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.cutter_comp_handler import SiemensISOCutterCompHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.polar_handler import SiemensISOPolarHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.unit_handler import SiemensISOInchMetricHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.misc_handler import SiemensISOMiscHandler
from ncplot7py.domain.machines import SIEMENS_840D_CONFIG


class StatefulSiemensMillCanal(BaseNCCanalInterface):
    """Per-canal object implementing the `NCCanal` interface for Siemens Mill."""

    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        self._name = name
        self._state = init_state or CNCState()
        
        # Ensure machine config is set
        if self._state.machine_config is None:
            self._state.machine_config = SIEMENS_840D_CONFIG

        # Default to G17 (XY Plane) and G94 (Feed/min)
        self._state.extra["g_group_16_plane"] = "X_Y"
        self._state.extra["feed_mode"] = "FEED_PER_MIN"
        self._state.extra["siemens_mode"] = False  # Default to ISO mode

        # Build Chain
        # 13. Motion
        motion = MotionHandler()
        # 12. Misc
        misc = SiemensISOMiscHandler(next_handler=motion)
        # 11. Units
        units = SiemensISOInchMetricHandler(next_handler=misc)
        # 10. Coordinates
        coords = SiemensISOCoordinateHandler(next_handler=units)
        # 9. Cutter Comp
        cutter = SiemensISOCutterCompHandler(next_handler=coords)
        # 8. Tool Length
        tool_len = SiemensISOToolLengthHandler(next_handler=cutter)
        # 7.5 Tool Change
        tool_change = ToolHandler(next_handler=tool_len)
        # 7. Polar
        polar = SiemensISOPolarHandler(next_handler=tool_change)
        # 6. Plane
        plane = GCodeGroup16PlaneExecChainLink(next_handler=polar)
        # 5. Feed
        feed = SiemensISOFeedHandler(next_handler=plane)
        # 4. Cycles
        cycles = SiemensISOCyclesHandler(next_handler=feed)
        # 3. Mode
        mode = SiemensModeHandler(next_handler=cycles)
        # 2. Control Flow
        control = ControlFlowHandler(next_handler=mode)
        # 1. Variables
        variable = VariableHandler(next_handler=control)

        self._chain = variable
        self._control_handler = control
        self._nodes: List[NCCommandNode] = []
        self._tool_path: List[Tuple[List[Point], float]] = []
        self._tool_nodes: List[NCCommandNode] = []

    def get_name(self) -> str:
        return self._name

    def run_nc_code_list(self, linked_code_list: List[NCCommandNode]) -> None:
        self._nodes = list(linked_code_list)
        self._exec_sequence: List[NCCommandNode] = []
        self._tool_path = []

        # Link nodes
        for i in range(len(self._nodes) - 1):
            self._nodes[i]._next_ncCode = self._nodes[i + 1]
            self._nodes[i + 1]._before_ncCode = self._nodes[i]

        # Build maps for ControlFlow
        n_map = {}
        do_map = {}
        end_map = {}
        for nd in self._nodes:
            try:
                nval = nd.command_parameter.get("N")
                if nval:
                    n_map[float(nval)] = nd
            except Exception:
                pass

            lc = nd.loop_command
            if lc:
                for m in re.findall(r"DO(\d+)", lc):
                    do_map.setdefault(m, []).append(nd)
                for m in re.findall(r"END(\d+)", lc):
                    end_map.setdefault(m, []).append(nd)

        try:
            self._control_handler._n_map = n_map
            self._control_handler._do_map = do_map
            self._control_handler._end_map = end_map
            self._control_handler._nodes = self._nodes
            self._control_handler._loop_counters = {}
        except Exception:
            pass

        # Execute
        node = self._nodes[0] if len(self._nodes) > 0 else None
        max_steps = max(10000, len(self._nodes) * 100)
        steps = 0

        while node is not None and steps < max_steps:
            try:
                self._exec_sequence.append(node)
            except Exception:
                pass

            pts, dur = self._chain.handle(node, self._state)

            if pts is not None:
                self._tool_path.append((pts, dur or 0.0))
                try:
                    self._tool_nodes.append(node)
                except Exception:
                    pass

            next_node = getattr(node, "_next_ncCode", None)
            if next_node is node:
                break
            node = next_node
            steps += 1

    def get_tool_path(self) -> List[Tuple[List[Point], float]]:
        return self._tool_path

    def get_exec_nodes(self) -> List[NCCommandNode]:
        if hasattr(self, "_tool_nodes") and self._tool_nodes:
            return self._tool_nodes
        return getattr(self, "_exec_sequence", self._nodes)


class StatefulSiemensMillControl(BaseNCControlInterface):
    """Control managing Siemens Mill Canals."""

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[CNCState]] = None) -> None:
        self.count_of_canals = int(count_of_canals)
        names = []
        if canal_names is None:
            names = [f"C{i+1}" for i in range(self.count_of_canals)]
        else:
            if isinstance(canal_names, str):
                names = [canal_names for _ in range(self.count_of_canals)]
            else:
                names = list(canal_names)

        init_states = list(init_nc_states) if init_nc_states is not None else [None] * self.count_of_canals

        self._canals: Dict[int, StatefulSiemensMillCanal] = {}
        for idx in range(self.count_of_canals):
            init_state = init_states[idx] if idx < len(init_states) else None
            self._canals[idx + 1] = StatefulSiemensMillCanal(names[idx], init_state)

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
        return None


__all__ = ["StatefulSiemensMillControl"]
