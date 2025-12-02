"""NC execution engine (renamed from `nc_analyzer`).

Provides `NCExecutionEngine` which is the new name for the orchestrator that
parses NC programs, delegates execution to an NC control implementation and
produces toolpath plot data. This keeps the public return values compatible
with the previous implementation.
"""
from __future__ import annotations

import time
from typing import List, Dict, Optional, Any

from ncplot7py.shared import (
    configure_logging,
    print_error,
    print_message,
    print_translated_error,
    get_message_stack,
    configure_i18n,
)
from ncplot7py.shared.registry import registry
from ncplot7py.domain.exceptions import ExceptionNode, ExceptionTyps


class NCExecutionEngine:
    """NC Execution Engine.

    This class preserves the original `get_Syncro_plot` return structure
    (a list of canal dictionaries, or `[[],[]]` on error) to avoid changing
    the public API while improving internal structure and naming.
    
    Errors encountered during execution are collected in the `errors` attribute
    and can be retrieved by the caller for display to the user.
    """

    def __init__(
        self,
        cnc_control: Any,
    ) -> None:
        """Initialize the engine.

        Parameters
        ----------
        cnc_control:
            An object implementing the NC control interface (run_nc_code_list,
            get_tool_path, get_exected_nodes, get_canal_name, get_canal_count,
            synchro_points).
        """
        self.cnc_control = cnc_control
        self.caclulatet_runtime: float = -1.0
        self.errors: List[Dict[str, Any]] = []  # Collect errors for frontend reporting
        # If control offers canal count, use it, otherwise default to 1
        try:
            self.count_of_canals = int(self.cnc_control.get_canal_count())
        except Exception:
            self.count_of_canals = 1

        # Ensure logging and i18n are configured (caller can reconfigure)
        configure_logging(console=True, web_buffer=False)
        configure_i18n()
        
        # Default language for error messages
        self._error_lang = "en"
    
    def set_error_language(self, lang: str) -> None:
        """Set the language for error messages (e.g., 'en', 'de')."""
        self._error_lang = lang
    
    def _add_error(self, exc: Exception, line: int = 0, canal: int = 0) -> None:
        """Add an error to the errors list for reporting to frontend.
        
        Parameters
        ----------
        exc: Exception
            The exception that occurred
        line: int
            The NC line number where the error occurred (1-based)
        canal: int
            The canal number where the error occurred
        """
        if isinstance(exc, ExceptionNode):
            error_info = {
                "type": exc.typ.name if hasattr(exc.typ, 'name') else str(exc.typ),
                "code": exc.code,
                "line": exc.line if exc.line else line,
                "message": exc.localized(self._error_lang),
                "value": str(exc.value) if exc.value else "",
                "canal": canal,
            }
        else:
            error_info = {
                "type": "CNCError",
                "code": -1,
                "line": line,
                "message": str(exc),
                "value": "",
                "canal": canal,
            }
        self.errors.append(error_info)
        print_error(f"NC Error at line {line}, canal {canal}: {error_info['message']}")

    def get_cacluated_runtime(self) -> float:
        return self.caclulatet_runtime

    def _ensure_parser(self):
        # Ensure a parser is registered (same strategy as cli.bootstrap)
        if registry.get("parser", "nc_command") is None:
            try:
                from ncplot7py.infrastructure.parsers.nc_command_parser import register as _reg_p

                _reg_p(registry)
            except Exception:
                # If parser registration fails, let parse attempts raise
                pass

    def _get_parser(self):
        self._ensure_parser()
        parser_cls = registry.get("parser", "nc_command")
        if parser_cls is None:
            # try by interface name
            parser_cls = registry.get("parser", "BaseNCCommandParser")
        if parser_cls is None:
            raise RuntimeError("No NC command parser registered")
        return parser_cls()

    def get_Syncro_plot(self, programs: List[str], synch: bool) -> List[Dict]:
        """Create the plot for the given NC `programs`.

        Parameters
        ----------
        programs: list[str]
            Each program is a string containing NC commands separated by ';'.
        synch: bool
            Whether to attempt synchronization across canals.

        Returns
        -------
        list[dict]
            A list of canal dictionaries in the same shape as the original
            implementation. On error returns `[[],[]]` to match previous API.
            Errors are also collected in the `errors` attribute for frontend reporting.
        """
        self.errors = []  # Reset errors for this run
        parser = None
        try:
            parser = self._get_parser()
        except Exception as e:
            self._add_error(e, line=0, canal=0)
            print_error(f"Parser setup failed: {e}")
            return [[], []]

        canal_number = 0
        tool_paths: List[Any] = []
        nodes: List[Any] = []
        error = False

        for program in programs:
            # Parse program into a list of command nodes
            node_list = []
            i = 0
            try:
                for raw_line in [p for p in program.split(";") if p.strip()]:
                    try:
                        node = parser.parse(raw_line, i)
                        node_list.append(node)
                    except Exception as parse_exc:
                        # Catch parsing errors for individual lines but continue
                        self._add_error(parse_exc, line=i+1, canal=canal_number+1)
                        # Don't break - try to continue with other lines
                    i += 1

                # Delegate execution to control; many controls accept an iterable
                # of nodes. Keep canal numbering consistent with callers (+1).
                self.cnc_control.run_nc_code_list(node_list, canal_number + 1)
            except ExceptionNode as exc:
                # Handle structured NC errors with localization
                self._add_error(exc, line=exc.line if exc.line else i+1, canal=canal_number+1)
                error = True
                break
            except Exception as exc:
                # Try to handle known control exception style (has log_route)
                log_route = getattr(exc, "log_route", None)
                if log_route:
                    # Try to format exception nodes using MessageCatalog when available
                    try:
                        from ncplot7py.domain.i18n import MessageCatalog

                        catalog = MessageCatalog()
                        for node in log_route:
                            if isinstance(node, ExceptionNode):
                                self._add_error(node, line=node.line, canal=canal_number+1)
                            else:
                                msg = catalog.format_exception(node)
                                print_error(msg)
                    except Exception:
                        self._add_error(exc, line=i+1, canal=canal_number+1)
                else:
                    # generic parser/control error
                    self._add_error(exc, line=i+1, canal=canal_number+1)
                error = True
                break

            # Try to collect results for this canal
            try:
                tool_paths.append(self.cnc_control.get_tool_path(canal_number + 1))
                nodes.append(self.cnc_control.get_exected_nodes(canal_number + 1))
            except ExceptionNode as exc:
                self._add_error(exc, line=exc.line if exc.line else 0, canal=canal_number+1)
                error = True
                break
            except Exception as exc:
                self._add_error(exc, line=0, canal=canal_number+1)
                error = True
                break

            canal_number += 1

        # Synchronize across canals if requested
        try:
            if not error and self.count_of_canals > 1 and synch:
                self.cnc_control.synchro_points(tool_paths, nodes)
        except ExceptionNode as e:
            self._add_error(e, line=e.line if e.line else 0, canal=0)
            error = True
        except Exception as e:
            log_route = getattr(e, "log_route", None)
            if log_route:
                try:
                    from ncplot7py.domain.i18n import MessageCatalog

                    catalog = MessageCatalog()
                    for node in log_route:
                        if isinstance(node, ExceptionNode):
                            self._add_error(node, line=node.line, canal=0)
                        else:
                            msg = catalog.format_exception(node)
                            print_error(msg)
                except Exception:
                    self._add_error(e, line=0, canal=0)
            else:
                self._add_error(e, line=0, canal=0)
            error = True

        # Build plots even if there were errors (partial results)
        # This allows the frontend to show what was successfully processed
        lines_list: List[Dict] = []
        runtime = 0.0
        canal_index = 0
        for tool_path in tool_paths:
            lines: List[Dict] = []
            linesExec: List[int] = []
            for line in tool_path:
                # each line expected to be (points_list, t)
                try:
                    l, t = line
                except Exception:
                    # unknown format, skip
                    continue
                x = []
                y = []
                z = []
                for point in l:
                    if point is not None:
                        x.append(getattr(point, "x", None))
                        y.append(getattr(point, "y", None))
                        z.append(getattr(point, "z", None))
                lines.append({"x": x, "y": y, "z": z, "t": t})
                try:
                    runtime += float(t)
                except Exception:
                    pass

            self.caclulatet_runtime = runtime

            if len(tool_paths) == len(nodes):
                for node in nodes[canal_index]:
                    linesExec.append(getattr(node, "nc_code_line_nr", None))

            canal = {
                "plot": lines,
                "canalNr": self.cnc_control.get_canal_name(canal_index),
                "programExec": linesExec,
            }
            canal_index += 1
            lines_list.append(canal)

        if lines_list:
            return lines_list

        # On error with no results, preserve prior API return value
        if error:
            print_message("Error in NC Code")
            print_message(get_message_stack())
        return [[], []]
