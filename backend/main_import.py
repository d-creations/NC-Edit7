from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from typing import List, Dict, Any
import re
import traceback
import sys
from pathlib import Path

# Ensure ncplot7py/src is in sys.path for F1/Code deployment where PYTHONPATH env var might not be set easily
# We assume this file is in backend/main_import.py, and ncplot7py is at ../ncplot7py
try:
    current_dir = Path(__file__).resolve().parent
    package_src = current_dir.parent / "ncplot7py" / "src"
    if package_src.exists() and str(package_src) not in sys.path:
        sys.path.insert(0, str(package_src))
except Exception:
    pass

# Import ncplot7py internals
try:
    from ncplot7py.application.nc_execution import NCExecutionEngine
    from ncplot7py.infrastructure.machines.stateful_iso_turn_control import StatefulIsoTurnNCControl
    from ncplot7py.cli.main import bootstrap as cli_bootstrap
except Exception as e:
    # If package isn't importable in some environments, we will raise at runtime
    NCExecutionEngine = None  # type: ignore
    StatefulIsoTurnNCControl = None  # type: ignore
    cli_bootstrap = None  # type: ignore

app = FastAPI(title="ncplot7py-adapter-import")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

# Serve frontend static files (production build) if available.
from pathlib import Path
import os

ROOT_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIRS = [ROOT_DIR / "dist", ROOT_DIR / "public", ROOT_DIR]
STATIC_DIR = None
for d in FRONTEND_DIRS:
    index_path = d / "index.html"
    if index_path.exists():
        STATIC_DIR = d
        break

if STATIC_DIR is not None:
    # Mount only asset directories to avoid shadowing API POST routes.
    # The built Vite app places hashed assets under `assets/`.
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Expose other top-level static files (like favicon) under /static
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    # Note: the index route (`/`) will return index.html explicitly.


def list_machines() -> Dict[str, Any]:
    return {
        "machines": [
            {"machineName": "ISO_MILL", "controlType": "MILL"},
            {"machineName": "FANUC_T", "controlType": "TURN"},
            {"machineName": "SB12RG_F", "controlType": "MILL"},
            {"machineName": "SB12RG_B", "controlType": "MILL"},
            {"machineName": "SR20JII_F", "controlType": "MILL"},
            {"machineName": "SR20JII_B", "controlType": "MILL"},
        ],
        "success": True,
    }


def build_segments_from_engine_output(canal_output: Dict[str, Any]) -> Dict[str, Any]:
    """Convert NCExecutionEngine canal output to the legacy response shape."""
    segments = []
    timing = []
    executed_lines = canal_output.get("programExec", [])

    plot_list = canal_output.get("plot", [])

    for idx, entry in enumerate(plot_list):
        x = entry.get("x", [])
        y = entry.get("y", [])
        z = entry.get("z", [])
        t = entry.get("t", 0)

        # Build start/end points (first and last)
        if len(x) == 0:
            continue
        start = {"x": x[0], "y": y[0] if len(y) > 0 else None, "z": z[0] if len(z) > 0 else None}
        end = {"x": x[-1], "y": y[-1] if len(y) > 0 else None, "z": z[-1] if len(z) > 0 else None}

        seg = {
            "type": "RAPID" if (not t or float(t) == 0) else "LINEAR",
            "lineNumber": executed_lines[idx] if idx < len(executed_lines) else None,
            "toolNumber": 1,
            "points": [start, end],
        }
        segments.append(seg)
        try:
            timing.append(float(t))
        except Exception:
            timing.append(0.0)

    return {"segments": segments, "executedLines": executed_lines, "variables": {}, "timing": timing}


@app.get("/")
async def index():
    """Return the frontend `index.html` when available, otherwise a JSON status.

    If the environment variable `FRONTEND_URL` is set (for dev), redirect there.
    """
    # If static files were mounted, StaticFiles will already serve index.html.
    if STATIC_DIR is not None:
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file), media_type="text/html")

    # Dev fallback: redirect to dev server if configured
    frontend_url = os.environ.get("FRONTEND_URL")
    if frontend_url:
        return RedirectResponse(frontend_url)

    return {"service": "ncplot7py-adapter-import", "status": "ok", "note": "No frontend build found"}


def sanitize_program(program: str) -> str:
    """Conservative sanitizer exposed at module level for reuse and testing.

    - Removes parenthetical comments ("(comment)").
    - Splits lines by semicolon `;` into sub-commands and processes each
      sub-command separately.
    - In each sub-command removes duplicate axis tokens (X/Y/Z/I/J/K),
      keeping the last occurrence so explicit later overrides win.
    - Preserves other tokens and reassembles semicolon-separated commands.
    """
    if not isinstance(program, str):
        return program

    # Remove parenthetical comments (single-line)
    program = re.sub(r"\(.*?\)", "", program)

    def sanitize_subcmd(sub: str) -> str:
        parts = [p for p in sub.strip().split() if p != ""]
        axis_re = re.compile(r'^([XYZIJKxyzijk])')
        last_axis = {}
        others = []
        # record last index for axis tokens and keep others with position
        for i, p in enumerate(parts):
            m = axis_re.match(p)
            if m:
                last_axis[m.group(1).upper()] = i
            else:
                others.append((i, p))

        if not last_axis and not others:
            return sub.strip()

        axis_by_index = {idx: parts[idx] for idx in last_axis.values()}

        merged = []
        for i in range(len(parts)):
            if i in axis_by_index:
                merged.append(axis_by_index[i])
            else:
                # append any other token at this position
                for pos, val in others:
                    if pos == i:
                        merged.append(val)
                        break

        return " ".join(merged)

    sanitized_lines = []
    for line in program.splitlines():
        # split by semicolon but keep semantic separators
        subs = [s for s in line.split(";")]
        san_subs = [sanitize_subcmd(s) for s in subs]
        sanitized_lines.append(";".join([s for s in san_subs if s is not None]))

    return "\n".join(sanitized_lines)


def mock_parse_nc_program(program: str, machine_name: str) -> Dict[str, Any]:
    """
    Parse NC program and generate mock plot data (legacy behavior).
    Copied from ncplot7py/scripts/cgiserver.cgi to ensure compatibility.
    """
    lines = [line.strip() for line in program.split('\n') if line.strip()]
    
    # Generate mock plot segments
    segments = []
    current_pos = {"x": 0, "y": 0, "z": 0}
    
    for i, line in enumerate(lines):
        # Simple G-code parsing for demo
        if line.startswith('G0') or line.startswith('G1'):
            # Extract coordinates
            new_pos = current_pos.copy()
            
            parts = line.split()
            for part in parts:
                if part.startswith('X'):
                    try:
                        new_pos['x'] = float(part[1:])
                    except ValueError:
                        pass
                elif part.startswith('Y'):
                    try:
                        new_pos['y'] = float(part[1:])
                    except ValueError:
                        pass
                elif part.startswith('Z'):
                    try:
                        new_pos['z'] = float(part[1:])
                    except ValueError:
                        pass
            
            # Create segment
            segment = {
                "type": "RAPID" if line.startswith('G0') else "LINEAR",
                "lineNumber": i + 1,
                "toolNumber": 1,
                "points": [
                    current_pos.copy(),
                    new_pos.copy()
                ]
            }
            segments.append(segment)
            current_pos = new_pos
    
    return {
        "segments": segments,
        "executedLines": list(range(1, len(lines) + 1)),
        "variables": {},
        "timing": [0.1] * len(lines)
    }


def run_mock_parser(machinedata: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Run the mock parser for all programs in machinedata."""
    canal_results = {}
    messages = []
    
    for program_entry in machinedata:
        program = program_entry.get("program", "")
        machine_name = program_entry.get("machineName", "ISO_MILL")
        canal_nr = str(program_entry.get("canalNr", "1"))
        
        # Parse program
        try:
            result = mock_parse_nc_program(program, machine_name)
            canal_results[canal_nr] = result
            messages.append(f"Successfully processed {machine_name} canal {canal_nr} (mock)")
        except Exception as e:
            messages.append(f"Error processing {machine_name} canal {canal_nr}: {str(e)}")
    
    return {
        "canal": canal_results,
        "message": messages,
        "success": True
    }


@app.post("/cgiserver_import")
async def cgiserver_import(request: Request):
    if NCExecutionEngine is None or StatefulIsoTurnNCControl is None:
        logging.warning("ncplot7py package not importable in this environment; some actions will be limited")

    # Log incoming request path and headers for debugging proxy issues
    try:
        raw_body = await request.body()
        logging.info("Incoming request: %s %s", request.method, request.url.path)
        # Log a trimmed version of headers and body to avoid huge logs
        headers_preview = {k: v for k, v in list(request.headers.items())[:10]}
        logging.info("Headers (preview): %s", headers_preview)
        logging.info("Body (raw preview): %s", raw_body[:1000])
        # Parse JSON from raw body
        try:
            req = json.loads(raw_body.decode("utf-8") if raw_body else "{}")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON request body")
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read request body")

    # Ensure parser registration
    try:
        if cli_bootstrap:
            cli_bootstrap()
    except Exception:
        logging.exception("Bootstrap failed")

    # Handle actions
    if isinstance(req, dict) and "action" in req:
        action = req.get("action")
        if action in ["list_machines", "get_machines"]:
            return list_machines()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    # Handle machinedata
    machinedata = None
    if isinstance(req, dict) and "machinedata" in req:
        machinedata = req.get("machinedata")
    elif isinstance(req, list):
        machinedata = req
    else:
        raise HTTPException(status_code=400, detail="Invalid request format")

    # Build programs list and canal names
    programs: List[str] = []
    canal_names: List[str] = []
    # use module-level `sanitize_program` defined above

    for entry in machinedata:
        prog = entry.get("program", "")
        prog_sanitized = sanitize_program(prog)
        programs.append(prog_sanitized)
        canal_names.append(str(entry.get("canalNr", "1")))

    # Create a control that can handle multiple canals and run the engine.
    engine_output = None
    try:
        # The library currently supports Turning (Lathe) controls primarily.
        # If the input is for a Mill (ISO_MILL) or uses Y-axis heavily without
        # proper configuration, the real engine might produce empty plots.
        # We attempt to run the real engine first.
        control = StatefulIsoTurnNCControl(count_of_canals=len(programs), canal_names=canal_names)
        engine = NCExecutionEngine(control)
        engine_output = engine.get_Syncro_plot(programs, False)
    except Exception as e:
        logging.warning("Real engine failed: %s. Falling back to mock parser.", e)
        # Fallback will handle this

    # Check if engine output is valid/non-empty. If empty or failed, use mock.
    use_mock = False
    if engine_output is None:
        use_mock = True
    else:
        # Check if we got any plot points. If all canals are empty, assume failure/mismatch
        # and fallback to mock (legacy behavior) to ensure the user sees something.
        total_points = 0
        for canal in engine_output:
            if isinstance(canal, dict):
                total_points += len(canal.get("plot", []))
            elif isinstance(canal, list):
                total_points += len(canal)
        
        if total_points == 0 and any(len(p.strip()) > 0 for p in programs):
            logging.info("Real engine returned 0 points for non-empty program. Falling back to mock.")
            use_mock = True

    if use_mock:
        return run_mock_parser(machinedata)

    # engine_output is a list per canal
    canal_results = {}
    messages = []
    for idx, canal in enumerate(engine_output):
        canal_nr = canal_names[idx] if idx < len(canal_names) else str(idx + 1)
        try:
            # The engine is expected to return a dict per canal. In some
            # situations it may return a raw list (plot points) — normalize
            # that to the expected dict shape to avoid attribute errors.
            if isinstance(canal, list):
                logging.info("Normalizing canal output: list -> dict (plot)")
                canal = {"plot": canal, "programExec": []}

            converted = build_segments_from_engine_output(canal)
            canal_results[canal_nr] = converted
            messages.append(f"Successfully processed canal {canal_nr}")
        except Exception as e:
            logging.exception("Failed converting canal output for canal %s", canal_nr)
            # Return a structured response instead of letting FastAPI raise 500
            return {
                "canal": canal_results,
                "message": [f"Conversion error for canal {canal_nr}: {str(e)}", f"raw_output: {repr(canal)[:1000]}"],
                "success": False,
            }

    return {"canal": canal_results, "message": messages, "success": True}


# Backwards-compatible legacy CGI path used by the frontend
@app.api_route("/ncplot7py/scripts/cgiserver.cgi", methods=["POST", "OPTIONS", "GET"])
async def legacy_cgiserver(request: Request):
    """Legacy endpoint to keep compatibility with frontends that post to
    `/ncplot7py/scripts/cgiserver.cgi`. POST requests are forwarded to the
    import adapter handler. GET returns the frontend index or a small JSON
    status so browsers don't receive Method Not Allowed or 404 errors.
    """
    # Handle preflight
    if request.method == "OPTIONS":
        return {"status": "ok"}

    if request.method == "GET":
        # Return index.html when available (same behavior as root)
        if STATIC_DIR is not None:
            index_file = STATIC_DIR / "index.html"
            if index_file.exists():
                return FileResponse(str(index_file), media_type="text/html")
        frontend_url = os.environ.get("FRONTEND_URL")
        if frontend_url:
            return RedirectResponse(frontend_url)
        return {"service": "ncplot7py-adapter-import", "status": "ok"}

    # For POST, reuse the cgiserver_import handler to process the body.
    try:
        return await cgiserver_import(request)
    except HTTPException:
        # Re-raise HTTPExceptions so status codes are preserved
        raise
    except Exception:
        logging.exception("Unhandled error in legacy_cgiserver")
        raise HTTPException(status_code=500, detail="Internal server error")
