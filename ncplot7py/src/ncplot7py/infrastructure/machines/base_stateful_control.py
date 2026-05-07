import re
import logging
from typing import Dict, List, Optional, Tuple, Sequence, Type, Any

from ncplot7py.interfaces.BaseNCCanal import NCControl as BaseNCControlInterface
from ncplot7py.interfaces.BaseNCControl import NCCanal as BaseNCCanalInterface
from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.point import Point


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

        init_states = list(init_nc_states) if init_nc_states is not None else [None] * self.count_of_canals

        self._canals: Dict[int, Any] = {}
        for idx in range(self.count_of_canals):
            init_state = init_states[idx] if idx < len(init_states) else None
            self._canals[idx + 1] = canal_class(names[idx], init_state)

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
