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
from ncplot7py.domain.handlers.siemens_mill_cnc.cycles_handler import SiemensISOCyclesHandler, SiemensNamedCyclesHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.tool_length_handler import SiemensISOToolLengthHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.cutter_comp_handler import SiemensISOCutterCompHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.polar_handler import SiemensISOPolarHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.unit_handler import SiemensISOInchMetricHandler
from ncplot7py.domain.handlers.siemens_mill_cnc.misc_handler import SiemensISOMiscHandler
from ncplot7py.domain.machines import get_machine_config
from ncplot7py.infrastructure.handler_chain_builder import HandlerChainBuilder

from ncplot7py.infrastructure.machines.base_stateful_control import BaseStatefulControl, BaseStatefulCanal

class StatefulSiemensMillCanal(BaseStatefulCanal):
    """Per-canal object implementing the `NCCanal` interface for Siemens Mill."""

    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        super().__init__(name, init_state)
        
        # Ensure machine config is set to Siemens for this control type
        # Override even if a default was set (e.g. FANUC_GENERIC from __post_init__)
        if self._state.machine_config is None or self._state.machine_config.name in ("FANUC_GENERIC", "FANUC_STAR"):
            self._state.machine_config = get_machine_config("SIEMENS_840D")

        # Default to G17 (XY Plane) and G94 (Feed/min)
        self._state.extra["g_group_16_plane"] = "X_Y"
        self._state.extra["feed_mode"] = self._state.machine_config.default_feed_mode
        self._state.extra["siemens_mode"] = False  # Default to ISO mode

        builder = HandlerChainBuilder()
        builder.add(VariableHandler)
        builder.add(ControlFlowHandler)
        builder.add(SiemensModeHandler)
        builder.add(SiemensNamedCyclesHandler)
        builder.add(SiemensISOCyclesHandler)
        builder.add(SiemensISOFeedHandler)
        builder.add(GCodeGroup16PlaneExecChainLink)
        builder.add(SiemensISOPolarHandler)
        builder.add(ToolHandler)
        builder.add(SiemensISOToolLengthHandler)
        builder.add(SiemensISOCutterCompHandler)
        builder.add(SiemensISOCoordinateHandler)
        builder.add(SiemensISOInchMetricHandler)
        builder.add(SiemensISOMiscHandler)
        builder.add(MotionHandler)

        self._chain = builder.build()


class StatefulSiemensMillControl(BaseStatefulControl):
    """Control managing Siemens Mill Canals."""

    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[CNCState]] = None) -> None:
        super().__init__(StatefulSiemensMillCanal, count_of_canals, canal_names, init_nc_states)

__all__ = ["StatefulSiemensMillControl"]
