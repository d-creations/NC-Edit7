from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from typing import List, Dict, Any

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
    return {"service": "ncplot7py-adapter-import", "status": "ok"}


@app.post("/cgiserver_import")
async def cgiserver_import(request: Request):
    if NCExecutionEngine is None or StatefulIsoTurnNCControl is None:
        raise HTTPException(status_code=500, detail="ncplot7py package not importable in this environment")

    try:
        req = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON request body")

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
    for entry in machinedata:
        programs.append(entry.get("program", ""))
        canal_names.append(str(entry.get("canalNr", "1")))

    # Create a control that can handle multiple canals
    control = StatefulIsoTurnNCControl(count_of_canals=len(programs), canal_names=canal_names)
    engine = NCExecutionEngine(control)

    try:
        engine_output = engine.get_Syncro_plot(programs, False)
    except Exception as e:
        logging.exception("Engine error")
        raise HTTPException(status_code=500, detail=f"Engine error: {e}")

    # engine_output is a list per canal
    canal_results = {}
    messages = []
    for idx, canal in enumerate(engine_output):
        canal_nr = canal_names[idx] if idx < len(canal_names) else str(idx + 1)
        converted = build_segments_from_engine_output(canal)
        canal_results[canal_nr] = converted
        messages.append(f"Successfully processed canal {canal_nr}")

    return {"canal": canal_results, "message": messages, "success": True}
