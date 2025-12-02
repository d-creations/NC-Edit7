"""
TEST Function example how to use the NC Analyzer

Copyright (C) <2024>  <Damian Roth Switzerland

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>. 
"""

from pathlib import Path
import sys
import os

# Configuration: set to True to save the produced plot to a PNG file instead
# of (or in addition to) showing it interactively. Adjust the path as needed.
SAVE_PLOT_TO_PNG = False
# Example: 'plots/O6POINT.png' (relative to repo root). Parent directories
# will be created automatically when saving.
PLOT_OUTPUT_PATH = Path("plots") / "O6POINT.png"
from typing import List, Tuple, Any

# Use package imports from the project
from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.shared import configure_logging, get_message_stack, configure_i18n
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.file_adapter import get_program
from ncplot7py.infrastructure.machines.stateful_star_turn_control import StatefulIsoTurnNCControl


class _Point:
    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z


class FileBasedFakeControl:
    """A minimal fake control that converts parsed NC nodes into simple toolpath points.

    It doesn't perform kinematics — it simply reads X/Y/Z parameters (if present)
    and creates 1-point lines with a fixed time per command so the engine can
    produce a plot structure for demonstration and testing.
    """

    def __init__(self):
        self._canal_nodes = {}

    def get_canal_count(self) -> int:
        return 1

    def run_nc_code_list(self, node_list: List[NCCommandNode], canal: int) -> None:
        # store the nodes for later retrieval
        self._canal_nodes[canal] = list(node_list)

    def get_tool_path(self, canal: int):
        nodes = self._canal_nodes.get(canal, [])
        path = []
        for n in nodes:
            params = getattr(n, "command_parameter", {})
            try:
                x = float(params.get("X", 0.0))
            except Exception:
                x = 0.0
            try:
                y = float(params.get("Y", 0.0))
            except Exception:
                y = 0.0
            try:
                z = float(params.get("Z", 0.0))
            except Exception:
                z = 0.0
            # one-point line segment, time 0.1s
            path.append(([_Point(x, y, z)], 0.1))
        return path

    def get_exected_nodes(self, canal: int):
        return self._canal_nodes.get(canal, [])

    def get_canal_name(self, idx: int) -> str:
        return f"C{idx}"

    def synchro_points(self, tool_paths, nodes):
        # no-op for fake control
        return None


def read_program_from_file(path: Path) -> list:
    """Read a file and return one or more program strings using the file adapter.

    Returns a list of program strings (each string contains commands separated
    by ';') suitable for passing directly to NCExecutionEngine.get_Syncro_plot.
    """
    # Delegate to the shared file_adapter which handles parentheses removal and
    # splitting into multiple programs if blank lines are used as separators.
    return get_program(path, split_on_blank_line=False)


def main(plot: bool = False) -> int:
    # Configure logging to capture messages in the in-memory web buffer so
    # we can print them after the run.
    configure_logging(console=True, web_buffer=True)
    configure_i18n()

    # Resolve path to data file (repo root / data / nc-examples / O0004)
    repo_root = Path(__file__).resolve().parent.parent
    data_file = repo_root / "data" / "nc-examples" / "O6POINT"

    if not data_file.exists():
        print(f"Data file not found: {data_file}")
        return 2

    programs = read_program_from_file(data_file)

    # Use the stateful ISO-turn control implementation for execution.
    # If the input file contains multiple programs (split on blank lines),
    # create a control with the matching number of canals to avoid
    # "Canal X not configured" errors when each program is intended for a
    # separate canal.
    control = StatefulIsoTurnNCControl(count_of_canals=max(1, len(programs)))
    engine = NCExecutionEngine(control)

    # get_Syncro_plot expects a list of program strings; our adapter returns
    # that directly, so pass it through.
    plot_result = engine.get_Syncro_plot(programs, synch=False)

    print("Returned structure type:", type(plot_result))
    print("Number of canals:", len(plot_result) if isinstance(plot_result, list) else "n/a")
    print("Calculated runtime (engine):", engine.get_cacluated_runtime())

    print("Captured messages:")
    print(get_message_stack())

    # Optionally plot if matplotlib is available and a result was produced
    if plot and isinstance(plot_result, list) and len(plot_result) > 0:
        try:
            import matplotlib.pyplot as plt
            from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

            all_x, all_y, all_z = [], [], []
            for canal in plot_result:
                # canal may be a dict with a 'plot' key (new API) or a plain list
                # (legacy/alternate implementations). Handle both safely.
                if isinstance(canal, dict):
                    plot_lines = canal.get("plot", [])
                elif isinstance(canal, (list, tuple)):
                    plot_lines = canal
                else:
                    # unknown format, skip
                    continue

                for line in plot_lines:
                    if isinstance(line, dict):
                        # expected shape from NCExecutionEngine
                        all_x.extend(line.get("x", []))
                        all_y.extend(line.get("y", []))
                        all_z.extend(line.get("z", []))
                    else:
                        # fallback: line may be a (points_list, time) tuple
                        try:
                            pts = line[0]
                            for p in pts:
                                all_x.append(getattr(p, "x", None))
                                all_y.append(getattr(p, "y", None))
                                all_z.append(getattr(p, "z", None))
                        except Exception:
                            # give up on this line
                            continue

            if all_x and all_y:
                # decide whether to show 3D or 2D: if Z is essentially flat
                # (all zeros or None) prefer a 2D X vs Y plot similar to the
                # provided reference image.
                z_vals = [v for v in all_z if v is not None] if all_z else []
                z_range = (max(z_vals) - min(z_vals)) if z_vals else 0.0

                if z_range > 1e-6:
                    # 3D plot
                    fig = plt.figure(1)
                    ax = fig.add_subplot(111, projection='3d')
                    ax.plot(all_x, all_y, all_z, label='parametric curve')
                    ax.set_xlabel('x')
                    ax.set_ylabel('y')
                    ax.set_zlabel('z')
                    plt.title('NC example O6POINT (3D)')
                    # save if requested, otherwise show
                    if SAVE_PLOT_TO_PNG:
                        PLOT_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
                        fig.savefig(str(PLOT_OUTPUT_PATH), bbox_inches='tight')
                        print(f"Saved plot to {PLOT_OUTPUT_PATH}")
                    else:
                        plt.show()
                else:
                    # 2D plot (X horizontal, Y vertical) with red axis lines
                    fig, ax = plt.subplots(figsize=(5, 6))

                    # Prepare XY lists, filter out None values
                    xs = [v for v in all_x if v is not None]
                    ys = [v for v in all_y if v is not None]
                    if not xs or not ys:
                        # nothing to plot
                        if SAVE_PLOT_TO_PNG:
                            PLOT_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
                            fig.savefig(str(PLOT_OUTPUT_PATH), bbox_inches='tight')
                            print(f"Saved plot to {PLOT_OUTPUT_PATH}")
                        else:
                            plt.show()
                    else:
                        # Close the polygon path if not already closed
                        if xs[0] != xs[-1] or ys[0] != ys[-1]:
                            xs = xs + [xs[0]]
                            ys = ys + [ys[0]]

                        # Draw polygon with rounded joins to resemble the reference
                        ax.plot(xs, ys, color='black', linewidth=2, solid_capstyle='round', solid_joinstyle='round')

                        ax.set_xlabel('X')
                        ax.set_ylabel('Y')
                        ax.set_title('NC example O6POINT')
                        ax.set_aspect('equal', adjustable='datalim')

                        # Compute centroid and draw red axes through it (like reference)
                        try:
                            cx = sum(xs[:-1]) / (len(xs) - 1)
                            cy = sum(ys[:-1]) / (len(ys) - 1)
                        except Exception:
                            cx, cy = 0.0, 0.0

                        # draw red axes lines through centroid
                        ax.axhline(cy, color='red', linewidth=1)
                        ax.axvline(cx, color='red', linewidth=1)

                        # annotate axis labels similar to reference image
                        xlim = ax.get_xlim()
                        ylim = ax.get_ylim()
                        # place X label to the right, Y label on top
                        ax.text(xlim[1], cy, 'X', color='red', verticalalignment='bottom', horizontalalignment='right')
                        ax.text(cx, ylim[1], 'Y', color='red', verticalalignment='top', horizontalalignment='left')

                        # tighten limits with small padding
                        pad_x = (max(xs) - min(xs)) * 0.12 if (max(xs) - min(xs)) > 0 else 1.0
                        pad_y = (max(ys) - min(ys)) * 0.12 if (max(ys) - min(ys)) > 0 else 1.0
                        ax.set_xlim(min(xs) - pad_x, max(xs) + pad_x)
                        ax.set_ylim(min(ys) - pad_y, max(ys) + pad_y)

                        # save if requested, otherwise show
                        if SAVE_PLOT_TO_PNG:
                            PLOT_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
                            fig.savefig(str(PLOT_OUTPUT_PATH), bbox_inches='tight')
                            print(f"Saved plot to {PLOT_OUTPUT_PATH}")
                        else:
                            plt.show()
        except Exception as e:
            print(f"Matplotlib plot failed: {e}")

    return 0


if __name__ == '__main__':
    sys.exit(main(plot=True))
