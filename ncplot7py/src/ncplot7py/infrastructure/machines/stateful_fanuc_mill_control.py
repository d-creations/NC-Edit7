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
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.infrastructure.handler_chain_builder import HandlerChainBuilder
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.infrastructure.machines.base_stateful_control import BaseStatefulControl, BaseStatefulCanal

class StatefulFanucMillCanal(BaseStatefulCanal):
    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        super().__init__(name, init_state)
        
        if self._state.machine_config is None or self._state.machine_config.name == "FANUC_GENERIC":
            self._state.machine_config = get_machine_config("FANUC_MILL")

        builder = HandlerChainBuilder()
        builder.add(VariableHandler)
        builder.add(ControlFlowHandler)
        builder.add(ToolHandler)
        builder.add(GcodePreCheckExecChainLink)
        builder.add(FanucMillGCodeGroupValidator)
        builder.add(ModalHandler)
        builder.add(GCodeGroup0CoordinateSetExecChainLink)
        builder.add(FanucMillWorkOffsetHandler)
        builder.add(FanucMillGroup5FeedModeHandler)
        builder.add(FanucMillSpeedModeHandler)
        builder.add(MotionHandler)

        self._chain = builder.build()

    @property
    def state(self) -> CNCState:
        return self._state

    def reset_state(self) -> None:
        self._state = CNCState()
        self._state.machine_config = get_machine_config("FANUC_MILL")


class StatefulFanucMillControl(BaseStatefulControl):
    """Entry point for interpreting Fanuc Mill NC programs."""

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[Optional[CNCState]]] = None) -> None:
        super().__init__(StatefulFanucMillCanal, count_of_canals, canal_names, init_nc_states)