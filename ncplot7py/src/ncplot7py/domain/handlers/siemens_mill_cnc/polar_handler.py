"""Handler for Siemens ISO Polar Coordinates (G15/G16)."""
from __future__ import annotations

from typing import Optional, Tuple, List
import math

from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.cnc_state import CNCState


class SiemensISOPolarHandler(Handler):
    """Handle G15 (Cancel) and G16 (Enable) Polar Coordinates.

    When G16 is active:
    - X is Radius
    - Y is Angle (in degrees)
    (Assuming G17 plane)

    This handler converts Polar to Cartesian before passing to MotionHandler.
    """

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List], Optional[float]]:
        for g in node.g_code:
            if not isinstance(g, str):
                continue
            try:
                if g.upper().startswith("G"):
                    gnum = int(g[1:])
                    if gnum == 15:
                        state.extra["polar_mode"] = False
                    elif gnum == 16:
                        state.extra["polar_mode"] = True
            except Exception:
                continue

        if state.extra.get("polar_mode", False):
            # Convert X(Radius), Y(Angle) to X, Y Cartesian
            # Only if X and Y are present
            if "X" in node.command_parameter and "Y" in node.command_parameter:
                try:
                    r = float(node.command_parameter["X"])
                    theta_deg = float(node.command_parameter["Y"])
                    theta_rad = math.radians(theta_deg)

                    # Center of polar coords is usually the current work offset origin (0,0)
                    # unless specified otherwise.

                    x_cart = r * math.cos(theta_rad)
                    y_cart = r * math.sin(theta_rad)

                    node.command_parameter["X"] = str(x_cart)
                    node.command_parameter["Y"] = str(y_cart)
                except Exception:
                    pass

        if self.next_handler is not None:
            return self.next_handler.handle(node, state)
        return None, None
