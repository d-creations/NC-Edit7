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
from typing import List, Tuple, Any

# Use package imports from the project
from ncplot7py.application.nc_execution import NCExecutionEngine
from ncplot7py.shared import configure_logging, get_message_stack, configure_i18n
from ncplot7py.shared.nc_nodes import NCCommandNode
from ncplot7py.shared.file_adapter import get_program


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
    return get_program(path, split_on_blank_line=True)


def main(plot: bool = False) -> int:
    # Configure logging to capture messages in the in-memory web buffer so
    # we can print them after the run.
    configure_logging(console=True, web_buffer=True)
    configure_i18n()

    # Resolve path to data file (repo root / data / nc-examples / O0004)
    repo_root = Path(__file__).resolve().parent.parent
    data_file = repo_root / "data" / "nc-examples" / "O0004"

    if not data_file.exists():
        print(f"Data file not found: {data_file}")
        return 2

    programs = read_program_from_file(data_file)

    control = FileBasedFakeControl()
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
                for line in canal.get("plot", []):
                    all_x.extend(line.get("x", []))
                    all_y.extend(line.get("y", []))
                    all_z.extend(line.get("z", []))

            if all_x and all_y and all_z:
                fig = plt.figure(1)
                ax = fig.add_subplot(111, projection='3d')
                ax.plot(all_z, all_x, all_y, label='parametric curve')
                ax.set_xlabel('z')
                ax.set_ylabel('x')
                ax.set_zlabel('y')
                plt.title('NC example O0004')
                plt.show()
        except Exception as e:
            print(f"Matplotlib plot failed: {e}")

    return 0


if __name__ == '__main__':
    sys.exit(main(plot=True))
