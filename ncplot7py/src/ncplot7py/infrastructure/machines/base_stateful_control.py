import re
import logging
from typing import Dict, List, Optional, Tuple, Sequence, Type, Any

from ncplot7py.interfaces.BaseNCCanal import NCControl as BaseNCControlInterface
from ncplot7py.interfaces.BaseNCControl import NCCanal as BaseNCCanalInterface
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.domain.exceptions import ExceptionNode, ExceptionTyps, raise_nc_error
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.point import Point


def _plane_from_default_code(default_plane: str) -> str:
    plane_code = str(default_plane or "").upper()
    if plane_code == "G18":
        return "X_Z"
    if plane_code == "G19":
        return "Y_Z"
    return "X_Y"


class BaseStatefulCanal(BaseNCCanalInterface):
    """Base canal implementing standard execution and control flow logic."""

    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        self._name = name
        self._state = init_state or CNCState()
        self._chain = None
        self._control_handler = None
        self._nodes: List[NCCommandNode] = []
        self._tool_path: List[Tuple[List[Point], float]] = []
        self._tool_nodes: List[NCCommandNode] = []
        self._exec_sequence: List[NCCommandNode] = []

    def get_name(self) -> str:
        return self._name

    def get_tool_path(self) -> List[Tuple[List[Point], float]]:
        return self._tool_path

    def get_exec_nodes(self) -> List[NCCommandNode]:
        if hasattr(self, "_tool_nodes") and self._tool_nodes:
            return self._tool_nodes
        return getattr(self, "_exec_sequence", self._nodes)

    def _get_handler(self, handler_type: Type) -> Optional[Any]:
        """Utility to retrieve a specific instance of a handler from the chain."""
        current = self._chain
        while current is not None:
            if isinstance(current, handler_type):
                return current
            current = getattr(current, "next_handler", None)
        return None

    def run_nc_code_list(self, linked_code_list: List[NCCommandNode]) -> None:
        self._nodes = list(linked_code_list)
        self._exec_sequence = []
        self._tool_path = []
        self._tool_nodes = []

        # link nodes in forward/backward direction
        for i in range(len(self._nodes) - 1):
            self._nodes[i]._next_ncCode = self._nodes[i + 1]
            self._nodes[i + 1]._before_ncCode = self._nodes[i]

        # provide nodes to control handler so it can setup its maps for jumping
        if self._control_handler is None and self._chain is not None:
             from ncplot7py.domain.handlers.control_flow import ControlFlowHandler
             self._control_handler = self._get_handler(ControlFlowHandler)

        if self._control_handler is not None and hasattr(self._control_handler, "setup_maps"):
            try:
                self._control_handler.setup_maps(self._nodes)
            except Exception:
                pass

        node = self._nodes[0] if len(self._nodes) > 0 else None
        max_steps = max(10000, len(self._nodes) * 100)
        steps = 0
        logger = logging.getLogger(__name__)

        while node is not None and steps < max_steps:
            try:
                self._exec_sequence.append(node)
            except Exception:
                pass

            pts, dur = None, 0.0
            if self._chain is not None:
                try:
                    pts, dur = self._chain.handle(node, self._state)
                except ExceptionNode:
                    raise
                except Exception as exc:
                    raise_nc_error(
                        ExceptionTyps.NCCodeErrors,
                        1999,
                        message=str(exc),
                        value=str(exc),
                        line=getattr(node, "nc_code_line_nr", 0) or 0,
                    )

            if logger.isEnabledFor(logging.DEBUG):
                try:
                    ln = getattr(node, 'nc_code_line_nr', None)
                    g = getattr(node, 'g_code', None)
                    logger.debug("node idx=%s line=%s g_code=%s -> pts=%s dur=%s", steps, ln, g, 'Y' if pts is not None else 'N', dur)
                except Exception:
                    logger.debug("node idx=%s -> pts=%s dur=%s", steps, 'Y' if pts is not None else 'N', dur)

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


class BaseStatefulControl(BaseNCControlInterface):
    """Base class for stateful controls managing multiple canals to reduce duplication."""

    def __init__(
        self,
        canal_class: Type,
        count_of_canals: int = 1,
        canal_names: Optional[Sequence[str]] = None,
        init_nc_states: Optional[Sequence[Optional[CNCState]]] = None
    ) -> None:
        self.count_of_canals = int(count_of_canals)
        
        if canal_names is None:
            names = [f"C{i+1}" for i in range(self.count_of_canals)]
        elif isinstance(canal_names, str):
            names = [canal_names for _ in range(self.count_of_canals)]
        else:
            names = list(canal_names)
        if len(names) < self.count_of_canals:
            names.extend(f"C{i+1}" for i in range(len(names), self.count_of_canals))

        init_states = list(init_nc_states) if init_nc_states is not None else [None] * self.count_of_canals
        if len(init_states) < self.count_of_canals:
            init_states.extend([None] * (self.count_of_canals - len(init_states)))

        self._canals: Dict[int, Any] = {}
        for idx in range(self.count_of_canals):
            self._canals[idx + 1] = canal_class(names[idx], init_states[idx])

    def get_canal_name(self, canal: int) -> str:
        c = self._canals.get(canal)
        if c is not None:
            if hasattr(c, "get_name"):
                return c.get_name()
            if hasattr(c, "_name"):
                return c._name
        return f"C{canal}"

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
        if hasattr(c, "get_exec_nodes"):
            return c.get_exec_nodes()
        return []

    def get_canal_count(self) -> int:
        return self.count_of_canals

    def get_nc_state(self, canal: int) -> Optional[CNCState]:
        c = self._canals.get(canal)
        if c is None:
            return None
        if hasattr(c, "state"):
            return getattr(c, "state")
        if hasattr(c, "_state"):
            return getattr(c, "_state")
        return None

    def synchro_points(self, tool_paths, nodes):
        return None


# --- UNIVERSAL CONFIG-DRIVEN CONTROL ---

HANDLER_REGISTRY = {
    # Core
    "variable": ("ncplot7py.domain.handlers.variable", "VariableHandler"),
    "control_flow": ("ncplot7py.domain.handlers.control_flow", "ControlFlowHandler"),
    
    # Base
    "motion": ("ncplot7py.domain.handlers.motion", "MotionHandler"),
    "modal": ("ncplot7py.domain.handlers.modal", "ModalHandler"),
    "tool_handler": ("ncplot7py.domain.handlers.tool_handler", "ToolHandler"),
    
    # Generic & Fanuc
    "group_0_coordinate_set": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group0_coordinate_set", "GCodeGroup0CoordinateSetExecChainLink"),
    "group_2_speed_mode": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group2_speed_mode", "GCodeGroup2SpeedModeExecChainLink"),
    "group_5_feed_mode": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode", "GCodeGroup5FeedModeExecChainLink"),
    "group_16_plane": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group16_plane", "GCodeGroup16PlaneExecChainLink"),
    "group_21_polar": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group21_polar_co", "GCodeGroup21PolarCoExecChainLink"),
    "precheck": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck", "GcodePreCheckExecChainLink"),
    "fanuc_precheck": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_precheck", "GcodePreCheckExecChainLink"),
    "cornering": ("ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_cornering", "FanucCorneringHandler"),
    
    # Fanuc Mill Specific
    "fanuc_mill_groups": ("ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_groups", "FanucMillGCodeGroupValidator"),
    "fanuc_mill_feed_mode": ("ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_group5_feed_mode", "FanucMillGroup5FeedModeHandler"),
    "fanuc_mill_speed_mode": ("ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_speed_mode", "FanucMillSpeedModeHandler"),
    "fanuc_mill_work_offset": ("ncplot7py.domain.handlers.fanuc_mill_cnc.gcode_work_offset", "FanucMillWorkOffsetHandler"),
    
    # Turn Mill Star
    "star_turn": ("ncplot7py.domain.handlers.star_machine.star_turn_handler", "StarTurnHandler"),
    
    # Siemens Specific
    "siemens_mode": ("ncplot7py.domain.handlers.siemens_mill_cnc.mode_handler", "SiemensModeHandler"),
    "siemens_named_cycles": ("ncplot7py.domain.handlers.siemens_mill_cnc.cycles_handler", "SiemensNamedCyclesHandler"),
    "siemens_iso_cycles": ("ncplot7py.domain.handlers.siemens_mill_cnc.cycles_handler", "SiemensISOCyclesHandler"),
    "siemens_iso_feed": ("ncplot7py.domain.handlers.siemens_mill_cnc.feed_handler", "SiemensISOFeedHandler"),
    "siemens_iso_polar": ("ncplot7py.domain.handlers.siemens_mill_cnc.polar_handler", "SiemensISOPolarHandler"),
    "siemens_iso_tool_length": ("ncplot7py.domain.handlers.siemens_mill_cnc.tool_length_handler", "SiemensISOToolLengthHandler"),
    "siemens_iso_cutter_comp": ("ncplot7py.domain.handlers.siemens_mill_cnc.cutter_comp_handler", "SiemensISOCutterCompHandler"),
    "siemens_iso_coordinate": ("ncplot7py.domain.handlers.siemens_mill_cnc.coordinate_handler", "SiemensISOCoordinateHandler"),
    "siemens_iso_inch_metric": ("ncplot7py.domain.handlers.siemens_mill_cnc.unit_handler", "SiemensISOInchMetricHandler"),
    "siemens_iso_misc": ("ncplot7py.domain.handlers.siemens_mill_cnc.misc_handler", "SiemensISOMiscHandler"),
}

class UniversalConfigDrivenCanal(BaseStatefulCanal):
    """Canal dynamically built from the machine config's `supported_gcode_groups`."""
    
    def __init__(self, name: str, init_state: Optional[CNCState] = None):
        super().__init__(name, init_state)
        
        # Imports here to avoid circular dep
        from ncplot7py.infrastructure.handler_chain_builder import HandlerChainBuilder
        from ncplot7py.domain.machines import get_machine_config

        if self._state.machine_config is None or self._state.machine_config.name == "FANUC_GENERIC":
            self._state.machine_config = get_machine_config("FANUC_MILL")

        default_plane = _plane_from_default_code(self._state.machine_config.default_plane)
        if self._state.machine_config.control_type == "SIEMENS":
            self._state.extra["g_group_16_plane"] = default_plane
            self._state.extra["siemens_mode"] = False
        else:
            self._state.extra["g_group_16_plane"] = default_plane

        builder = HandlerChainBuilder()

        # Map groups to handler modules via dynamic imports
        config_groups = self._state.machine_config.supported_gcode_groups
        
        # Helper logic to inject Turn-Mill Star handler
        if self._state.machine_config.machine_type == "TURN_MILL":
            req = list(config_groups)
            if "star_turn" not in req:
                req.insert(len(req) - 1 if "motion" in req else len(req), "star_turn")
            config_groups = tuple(req)

        for group in config_groups:
            if group in HANDLER_REGISTRY:
                mod_path, cls_name = HANDLER_REGISTRY[group]
                builder.add_if_importable(mod_path, cls_name)
            else:
                logging.getLogger(__name__).warning(f"Handler for group '{group}' not found in HANDLER_REGISTRY.")

        self._chain = builder.build()

class UniversalConfigDrivenControl(BaseStatefulControl):
    """Generic CNC Control driven entirely by `machines.json` via `UniversalConfigDrivenCanal`."""
    
    def __init__(self, count_of_canals: int = 1, canal_names: Optional[Sequence[str]] = None, init_nc_states: Optional[Sequence[CNCState]] = None) -> None:
        if count_of_canals == 1 and init_nc_states and init_nc_states[0] and init_nc_states[0].machine_config:
            if init_nc_states[0].machine_config.channels > 1:
                count_of_canals = init_nc_states[0].machine_config.channels
                
        self._synchro_strategy = "NONE"
        if init_nc_states and init_nc_states[0] and init_nc_states[0].machine_config:
            self._synchro_strategy = init_nc_states[0].machine_config.synchronization_strategy

        super().__init__(UniversalConfigDrivenCanal, count_of_canals, canal_names, init_nc_states)

    def synchro_points(self, tool_paths, nodes):
        if self._synchro_strategy == "STAR_WAIT":
            from ncplot7py.infrastructure.machines.star_canal_syncro import CanalSynchro
            syn = CanalSynchro(tool_paths, nodes)
            syn.synchro_points()
        return None
