from __future__ import annotations

from typing import Dict, List, Optional, Tuple, Sequence
import logging

from ncplot7py.interfaces.BaseNCCanal import NCControl as BaseNCControlInterface
from ncplot7py.interfaces.BaseNCControl import NCCanal as BaseNCCanalInterface

from ncplot7py.domain.handlers.motion import MotionHandler
from ncplot7py.domain.handlers.modal import ModalHandler
from ncplot7py.domain.handlers.variable import VariableHandler
from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
from ncplot7py.domain.handlers.tool_handler import ToolHandler
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck import GcodePreCheckExecChainLink
from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group0_coordinate_set import GCodeGroup0CoordinateSetExecChainLink

from ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_groups import FanucMillGCodeGroupValidator
from ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_group5_feed_mode import FanucMillGroup5FeedModeHandler
from ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_speed_mode import FanucMillSpeedModeHandler
from ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_work_offset import FanucMillWorkOffsetHandler

from ncplot7py.shared.point import Point
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.machines import FANUC_MILL_CONFIG
from ncplot7py.shared.nc_nodes import NCCommandNode

class StatefulFanucMillCanal(BaseNCCanalInterface):
    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        self._name = name
        self._state = init_state or CNCState()
        
        if self._state.machine_config is None or self._state.machine_config.name == "FANUC_GENERIC":
            self._state.machine_config = FANUC_MILL_CONFIG

        # Chain: variables -> control flow -> precheck -> group_validator -> modal -> work_offset -> feed_mode -> speed_mode -> motion
        
        motion = MotionHandler()
        speed_mode = FanucMillSpeedModeHandler(next_handler=motion)
        feed_mode = FanucMillGroup5FeedModeHandler(next_handler=speed_mode)
        work_offset = FanucMillWorkOffsetHandler(next_handler=feed_mode)
        gcode0 = GCodeGroup0CoordinateSetExecChainLink(next_handler=work_offset)
        modal = ModalHandler(next_handler=gcode0)
        group_validator = FanucMillGCodeGroupValidator(next_handler=modal)
        precheck = GcodePreCheckExecChainLink(next_handler=group_validator)
        tool = ToolHandler(next_handler=precheck)
        ctrl_flow = ControlFlowHandler(next_handler=tool)
        variables = VariableHandler(next_handler=ctrl_flow)

        self._chain = variables

    @property
    def state(self) -> CNCState:
        return self._state

    def reset_state(self) -> None:
        self._state = CNCState()
        self._state.machine_config = FANUC_MILL_CONFIG

    def dispatch_node(self, node: NCCommandNode) -> Tuple[Optional[List], Optional[float]]:
        # Let the handler chain update state (and potentially return motion segments)
        return self._chain.handle(node, self._state)

    def run_nc_code_list(self, linked_code_list: List[NCCommandNode]) -> None:
        self._exec_sequence = []
        for node in linked_code_list:
            self._exec_sequence.append(node)
            self.dispatch_node(node)

    def get_tool_path(self) -> List[Tuple[List[Point], float]]:
        # Map CNCState.toolpath to required output format
        if not self._state.toolpath:
            return [([Point(0, 0, 0)], 0.0)]
        pts = [Point(t[0], t[1], t[2]) for t in self._state.toolpath]
        return [(pts, self._state.total_time)]

class StatefulFanucMillControl(BaseNCControlInterface):
    """Entry point for interpreting Fanuc Mill NC programs."""

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[Optional[CNCState]]] = None) -> None:
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

        self._canals: Dict[int, StatefulFanucMillCanal] = {}
        for idx in range(self.count_of_canals):
            init_state = init_states[idx] if idx < len(init_states) else None
            self._canals[idx + 1] = StatefulFanucMillCanal(names[idx], init_state)

    def get_canal_name(self, canal: int) -> str:
        c = self._canals.get(canal)
        return c._name if c is not None else f"C{canal}"

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

    def get_nc_state(self, canal: int) -> CNCState:
        c = self._canals.get(canal)
        if c is None:
            return CNCState()
        return c.state