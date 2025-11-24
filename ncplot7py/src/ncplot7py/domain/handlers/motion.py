"""Motion handler for G1/G2/G3 moves located in domain.handlers.

This is the domain-located copy of the motion handler implementation.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ncplot7py.domain.cnc_state import CNCState
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.domain.exec_chain import Handler
from ncplot7py.shared.point import Point


def _to_float(v: Optional[str], default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


class MotionHandler(Handler):
    """Handle G0/G1/G2/G3 interpolation.

    Produces (list[Point], duration_seconds) when motion occurs, otherwise
    delegates to next handler.
    """

    def __init__(self, next_handler: Optional[Handler] = None, max_segment: float = 0.5):
        super().__init__(next_handler=next_handler)
        self.max_segment = float(max_segment)

    def handle(self, node: NCCommandNode, state: CNCState) -> Tuple[Optional[List[Point]], Optional[float]]:
        # detect motion codes
        interp_mode = None  # 'G00','G01','G02','G03'
        for g in node.g_code:
            if g.upper() in ("G00", "G0", "G0 "):
                interp_mode = "G00"
            if g.upper() in ("G01", "G1"):
                interp_mode = "G01"
            if g.upper() in ("G02", "G2"):
                interp_mode = "G02"
            if g.upper() in ("G03", "G3"):
                interp_mode = "G03"

        if interp_mode is None:
            return super().handle(node, state)

        # Resolve start and end positions using state.resolve_target
        start = state.axes.copy()
        # build target spec from parameters: X,Y,Z or U,V,W for relative
        target_spec: Dict[str, float] = {}
        absolute_mode = True
        # check distance mode modal (G90/G91)
        dm = state.get_modal("distance")
        if dm and dm.upper() == "G91":
            absolute_mode = False

        for k, v in node.command_parameter.items():
            key = k.upper()
            if key in ("X", "Y", "Z", "A", "B", "C"):
                target_spec[key] = _to_float(v)
            elif key in ("U", "V", "W"):
                # relative axis spec; treat as delta
                # map UVW to XYZ
                mapped = {"U": "X", "V": "Y", "W": "Z"}[key]
                target_spec[mapped] = _to_float(v)
            # I,J,K,R,F handled later
            # I,J,K,R,F handled later

        # Normalize incoming axis values according to cnc_state axis_units
        # (e.g. when X is interpreted as diameter the provided value should be
        # divided by 2 to obtain internal radius coordinates).
        normalized_target_spec = state.normalize_target_spec(target_spec)

        # get resolved absolute targets
        resolved = state.resolve_target(normalized_target_spec, absolute=absolute_mode)

        # interpolation parameters
        params = {k.upper(): _to_float(v) for k, v in node.command_parameter.items()}
        # Normalize arc parameters (I/J/K offsets and R radius) to internal units
        params = state.normalize_arc_params(params)

        if interp_mode == "G01" or interp_mode == "G00":
            points, duration = self._linear_interpolate(start, resolved, state)
        elif interp_mode in ("G02", "G03"):
            cw = interp_mode == "G02"
            points, duration = self._circular_interpolate(start, resolved, params, state, cw)
        else:
            return super().handle(node, state)

        # update state axes to endpoint
        state.update_axes(resolved)

        # Modal parameter handling has been moved to a dedicated handler
        # (`ModalHandler`) earlier in the chain. MotionHandler should not
        # mutate modal state; it only consumes values from `state` to
        # compute durations.
        return points, duration

    def _linear_interpolate(self, start: Dict[str, float], end: Dict[str, float], state: CNCState) -> Tuple[List[Point], float]:
        # compute distance in XYZ space
        axes = ("X", "Y", "Z")
        dist = state.compute_distance(start, end, axes=list(axes))
        if dist <= 0.0:
            # no motion
            p = Point(x=end.get("X", 0.0), y=end.get("Y", 0.0), z=end.get("Z", 0.0),
                      a=end.get("A", 0.0), b=end.get("B", 0.0), c=end.get("C", 0.0))
            return [p], 0.0

        # determine number of segments. Allow an optional per-state override
        # so callers/tests can request higher resolution by setting
        # `state.extra['max_segment']` to a smaller value (e.g. 0.05).
        try:
            eff_max_segment = float(getattr(state, "extra", {}).get("max_segment", self.max_segment) or self.max_segment)
        except Exception:
            eff_max_segment = float(self.max_segment)
        # ensure sane lower bound
        if eff_max_segment <= 0.0:
            eff_max_segment = float(self.max_segment)
        n = max(1, int(math.ceil(dist / eff_max_segment)))
        # compute duration using feed rate. The state's `feed_rate` stores
        # the raw F value which may be either "per minute" or "per
        # revolution" depending on the feed mode. Convert to mm/s here.
        feed = state.feed_rate or 1.0
        # detect feed-per-revolution mode; FeedMode enum may be stored
        # under state.extra['feed_mode'] either as Enum or its string value.
        feed_mode = None
        try:
            feed_mode = getattr(state, "extra", {}).get("feed_mode", None)
        except Exception:
            feed_mode = None
        # default: feed interpreted as mm/min
        effective_feed_mm_per_min = float(feed)
        try:
            # try to import enum for a robust comparison; fall back to
            # string compare if import fails.
            from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode import FeedMode

            if feed_mode == FeedMode.FEED_PER_REV or feed_mode == FeedMode.FEED_PER_REV.value:
                # convert mm/rev -> mm/min using spindle speed (rpm)
                rpm = float(state.spindle_speed or 1.0)
                effective_feed_mm_per_min = float(feed) * rpm
        except Exception:
            try:
                if feed_mode == "FEED_PER_REV":
                    rpm = float(state.spindle_speed or 1.0)
                    effective_feed_mm_per_min = float(feed) * rpm
            except Exception:
                effective_feed_mm_per_min = float(feed)

        # convert mm/min -> mm/s
        feed_mm_s = effective_feed_mm_per_min / 60.0
        duration = dist / feed_mm_s if feed_mm_s > 0 else 0.0

        points: List[Point] = []
        # include explicit start point so joins between segments preserve
        # exact continuity when plotting consecutive motions
        points.append(Point(x=start.get("X", 0.0), y=start.get("Y", 0.0), z=start.get("Z", 0.0),
                             a=start.get("A", 0.0), b=start.get("B", 0.0), c=start.get("C", 0.0)))
        for i in range(1, n + 1):
            t = i / n
            x = start.get("X", 0.0) + (end.get("X", start.get("X", 0.0)) - start.get("X", 0.0)) * t
            y = start.get("Y", 0.0) + (end.get("Y", start.get("Y", 0.0)) - start.get("Y", 0.0)) * t
            z = start.get("Z", 0.0) + (end.get("Z", start.get("Z", 0.0)) - start.get("Z", 0.0)) * t
            a = end.get("A", start.get("A", 0.0))
            b = end.get("B", start.get("B", 0.0))
            c = end.get("C", start.get("C", 0.0))
            points.append(Point(x=x, y=y, z=z, a=a, b=b, c=c))
        return points, duration

    def _circular_interpolate(self, start: Dict[str, float], end: Dict[str, float], params: Dict[str, float], state: CNCState, cw: bool) -> Tuple[List[Point], float]:
        # Only implement XY-plane arcs for now (common case). Use I,J center offsets or R radius.
        sx = start.get("X", 0.0)
        sy = start.get("Y", 0.0)
        ex = end.get("X", sx)
        ey = end.get("Y", sy)

        # center
        if "I" in params or "J" in params:
            ix = params.get("I", 0.0)
            jy = params.get("J", 0.0)
            cx = sx + ix
            cy = sy + jy
        elif "R" in params and params.get("R", 0.0) != 0.0:
            # derive center from radius — choose the smaller arc by default
            r = params.get("R", 0.0)
            # compute midpoint
            mx = (sx + ex) / 2.0
            my = (sy + ey) / 2.0
            dx = ex - sx
            dy = ey - sy
            d2 = dx * dx + dy * dy
            if d2 == 0.0:
                raise ValueError("Invalid arc with zero chord length")
            h = math.sqrt(max(0.0, r * r - d2 / 4.0)) / math.sqrt(d2)
            # two possible centers
            cx1 = mx - h * dy
            cy1 = my + h * dx
            cx2 = mx + h * dy
            cy2 = my - h * dx
            # Determine which center yields the requested sweep direction
            # and prefer the smaller absolute sweep (minor arc) when both
            # satisfy the direction. Compute sweep angles for both centers
            # and pick the best candidate.
            def sweep_for_center(cx_c, cy_c):
                a0_c = math.atan2(sy - cy_c, sx - cx_c)
                a1_c = math.atan2(ey - cy_c, ex - cx_c)
                da_c = a1_c - a0_c
                # normalize to [-pi, pi]
                if da_c > math.pi:
                    da_c -= 2 * math.pi
                if da_c < -math.pi:
                    da_c += 2 * math.pi
                return da_c

            da1 = sweep_for_center(cx1, cy1)
            da2 = sweep_for_center(cx2, cy2)

            # For cw=True we want a negative sweep (clockwise), for cw=False
            # we want a positive sweep (counter-clockwise). Prefer the center
            # that matches the desired sign; if both match or neither match,
            # pick the one with smaller absolute sweep (minor arc).
            def matches_cw(da_val, cw_flag):
                return (da_val < 0) if cw_flag else (da_val > 0)

            if matches_cw(da1, cw) and not matches_cw(da2, cw):
                cx, cy = cx1, cy1
            elif matches_cw(da2, cw) and not matches_cw(da1, cw):
                cx, cy = cx2, cy2
            else:
                # both match or both don't — choose the smaller absolute sweep
                if abs(da1) <= abs(da2):
                    cx, cy = cx1, cy1
                else:
                    cx, cy = cx2, cy2
        else:
            # cannot compute arc center
            raise ValueError("Arc requires I/J or R parameter")

        # compute start and end angles
        a0 = math.atan2(sy - cy, sx - cx)
        a1 = math.atan2(ey - cy, ex - cx)

        # Robust sweep normalization:
        # - normalize difference into (-pi, pi]
        # - consider candidates da, da +/- 2pi and pick the candidate that
        #   matches the requested direction (CW -> negative, CCW -> positive)
        #   and has the smallest absolute magnitude. If no candidate matches
        #   the requested sign (rare), pick the candidate with the smallest
        #   absolute value (minor arc).
        def _normalize_sweep(a_start: float, a_end: float, cw_flag: bool) -> float:
            raw = a_end - a_start
            # map to (-pi, pi]
            da = (raw + math.pi) % (2 * math.pi) - math.pi
            # consider equivalent representations
            two_pi = 2 * math.pi
            candidates = [da, da - two_pi, da + two_pi]

            # desired sign: negative for cw (G02), positive for ccw (G03)
            if cw_flag:
                matching = [d for d in candidates if d < 0]
            else:
                matching = [d for d in candidates if d > 0]

            if matching:
                # pick the matching candidate with minimal absolute sweep
                return min(matching, key=abs)
            # fallback: choose the minor arc (smallest absolute value)
            return min(candidates, key=abs)

        da = _normalize_sweep(a0, a1, cw)

        arc_length = abs(da) * math.hypot(sx - cx, sy - cy)
        # n segments — allow per-state override like in linear interpolation
        try:
            eff_max_segment = float(getattr(state, "extra", {}).get("max_segment", self.max_segment) or self.max_segment)
        except Exception:
            eff_max_segment = float(self.max_segment)
        if eff_max_segment <= 0.0:
            eff_max_segment = float(self.max_segment)
        n = max(2, int(math.ceil(arc_length / eff_max_segment)))
        # Ensure a minimum angular resolution so small-radius arcs don't
        # look like corners. Allow callers to override desired degrees per
        # segment via state.extra['angle_per_segment_deg'] (smaller -> more
        # segments). Default to 10 degrees per segment.
        try:
            desired_deg = float(getattr(state, "extra", {}).get("angle_per_segment_deg", 10.0) or 10.0)
        except Exception:
            desired_deg = 2.0
        if desired_deg <= 0.0:
            desired_deg = 2.0
        min_n_by_angle = max(2, int(math.ceil(abs(da) / math.radians(desired_deg))))
        if min_n_by_angle > n:
            n = min_n_by_angle

        # duration using feed rate (see linear routine for comments)
        feed = state.feed_rate or 1.0
        feed_mode = None
        try:
            feed_mode = getattr(state, "extra", {}).get("feed_mode", None)
        except Exception:
            feed_mode = None

        effective_feed_mm_per_min = float(feed)
        try:
            from ncplot7py.domain.handlers.fanuc_turn_cnc.gcode_group5_feed_mode import FeedMode
            if feed_mode == FeedMode.FEED_PER_REV or feed_mode == FeedMode.FEED_PER_REV.value:
                rpm = float(state.spindle_speed or 1.0)
                effective_feed_mm_per_min = float(feed) * rpm
        except Exception:
            try:
                if feed_mode == "FEED_PER_REV":
                    rpm = float(state.spindle_speed or 1.0)
                    effective_feed_mm_per_min = float(feed) * rpm
            except Exception:
                effective_feed_mm_per_min = float(feed)

        feed_mm_s = effective_feed_mm_per_min / 60.0
        duration = arc_length / feed_mm_s if feed_mm_s > 0 else 0.0

        points: List[Point] = []
        # include explicit start point (theta = a0)
        start_x = cx + math.cos(a0) * math.hypot(sx - cx, sy - cy)
        start_y = cy + math.sin(a0) * math.hypot(sx - cx, sy - cy)
        points.append(Point(x=start_x, y=start_y, z=start.get("Z", 0.0),
                             a=start.get("A", 0.0), b=start.get("B", 0.0), c=start.get("C", 0.0)))
        for i in range(1, n + 1):
            t = i / n
            theta = a0 + da * t
            x = cx + math.cos(theta) * math.hypot(sx - cx, sy - cy)
            y = cy + math.sin(theta) * math.hypot(sx - cx, sy - cy)
            z = start.get("Z", 0.0) + (end.get("Z", start.get("Z", 0.0)) - start.get("Z", 0.0)) * t
            a = end.get("A", start.get("A", 0.0))
            b = end.get("B", start.get("B", 0.0))
            c = end.get("C", start.get("C", 0.0))
            points.append(Point(x=x, y=y, z=z, a=a, b=b, c=c))

        return points, duration


__all__ = ["MotionHandler", "Point"]
