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
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.exceptions import raise_nc_error, ExceptionTyps
from ncplot7py.infrastructure.handler_chain_builder import HandlerChainBuilder
from ncplot7py.infrastructure.machines.star_canal_syncro import CanalSynchro
from ncplot7py.infrastructure.machines.base_stateful_control import BaseStatefulControl, BaseStatefulCanal


class StatefulStarTurnCanal(BaseStatefulCanal):
    """Per-canal object implementing the `NCCanal` interface.

    The canal owns its own CNCState and a short chain (G50/G28 -> Motion)
    instance used to interpret NC nodes for that canal.
    """

    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        super().__init__(name, init_state)
        
        if self._state.machine_config is None or self._state.machine_config.name == "FANUC_GENERIC":
            self._state.machine_config = get_machine_config("FANUC_STAR_x-D_y-R_z_R")

        builder = HandlerChainBuilder()
        builder.add(VariableHandler)
        builder.add(ControlFlowHandler)
        builder.add_if_importable("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck", "GcodePreCheckExecChainLink")
        builder.add_if_importable("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode", "GCodeGroup5FeedModeExecChainLink")
        builder.add(GCodeGroup21PolarCoExecChainLink)
        builder.add(GCodeGroup16PlaneExecChainLink)
        builder.add(GCodeGroup2SpeedModeExecChainLink)
        builder.add(StarTurnHandler)
        builder.add(GCodeGroup0CoordinateSetExecChainLink)
        builder.add_if_importable("ncplot7py.domain.handlers.modal", "ModalHandler")
        builder.add_if_importable("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_cornering", "FanucCorneringHandler")
        builder.add(MotionHandler)

        self._chain = builder.build()


class StatefulStarTurnNCControl(BaseStatefulControl):
    """Control managing multiple `StatefulStarTurnCanal` instances.

    Implements the `NCControl` abstract interface while delegating per-canal
    execution to `StatefulStarTurnCanal` objects.
    """

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[CNCState]] = None) -> None:
        super().__init__(StatefulStarTurnCanal, count_of_canals, canal_names, init_nc_states)

    def synchro_points(self, tool_paths, nodes):
        # perform synchronization of tool path timing across canals
        # tool_paths: list of list of tuples (points_list, duration)
        # nodes: list of list of NCCommandNode executed for each canal
        # run synchronization handler
        try:
            syn = CanalSynchro(tool_paths, nodes)  # delegate to the star-machine specific synchronisation helper
            syn.synchro_points()
        except Exception:
            # let domain exceptions propagate; unknown exceptions bubble up too
            raise
        return None

__all__ = ["StatefulStarTurnNCControl"]
