from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import os
import logging
from focas_service import get_focas_client, FocasClientBase, FocasError

app = FastAPI(title="ncplot7py-adapter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CGI_PATH = os.environ.get("CGI_PATH", "/app/ncplot7py/scripts/cgiserver.cgi")
CGI_TIMEOUT = int(os.environ.get("CGI_TIMEOUT", "30"))
ENABLE_FOCAS = os.environ.get("ENABLE_FOCAS", "True").lower() in ("true", "1", "t", "yes")

logging.basicConfig(level=logging.INFO)

@app.get("/api/features")
async def get_features():
    """Endpoint for frontend to query which backend modules are available."""
    return {
        "focas_enabled": ENABLE_FOCAS,
        "cgi_path": CGI_PATH
    }

def strip_cgi_headers(output: str) -> str:
    """Strip CGI HTTP headers from output, returning just the body.

    CGI scripts output HTTP headers followed by a blank line, then the body.
    This function extracts just the body content (typically JSON).
    """
    # Split on double newline (blank line separating headers from body)
    parts = output.split("\n\n", 1)
    if len(parts) == 2:
        return parts[1].strip()
    # If no blank line found, try \r\n\r\n (Windows-style)
    parts = output.split("\r\n\r\n", 1)
    if len(parts) == 2:
        return parts[1].strip()
    # No headers found, return original (might already be just JSON)
    return output.strip()


async def run_cgi(input_data: str, timeout: int = CGI_TIMEOUT) -> str:
    """Run the existing CGI script as a subprocess and return stdout as string.

    The CGI is invoked using `python3 <cgi_path>` and receives JSON on stdin.
    Environment variables `REQUEST_METHOD` and `CONTENT_LENGTH` are set.
    """
    env = os.environ.copy()
    env.update({
        "REQUEST_METHOD": "POST",
        "CONTENT_LENGTH": str(len(input_data)),
    })

    proc = await asyncio.create_subprocess_exec(
        "python3",
        CGI_PATH,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(input=input_data.encode("utf-8")), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        raise HTTPException(status_code=504, detail="CGI subprocess timeout")

    if proc.returncode != 0:
        logging.error("CGI stderr: %s", stderr.decode("utf-8", errors="ignore"))
        raise HTTPException(status_code=500, detail="CGI subprocess returned error")

    raw_output = stdout.decode("utf-8")
    # Strip CGI headers (Content-Type, etc.) before returning JSON body
    return strip_cgi_headers(raw_output)


@app.get("/")
async def index():
    return {"service": "ncplot7py-adapter", "status": "ok"}


# --- FOCAS API Routes ---

class FocasConnection(BaseModel):
    ip_address: str
    port: int = 8193
    timeout: int = 10

class FocasDownloadData(BaseModel):
    program_text: str

@app.get("/api/focas/ping")
async def focas_ping(ip_address: str):
    if not ENABLE_FOCAS:
        raise HTTPException(status_code=501, detail="FOCAS support is disabled on this server.")
    
    import platform
    import asyncio
    
    is_windows = platform.system().lower() == "windows"
    param_count = "-n" if is_windows else "-c"
    param_wait = "-w" if is_windows else "-W"
    wait_val = "1000" if is_windows else "1"
    
    try:
        process = await asyncio.create_subprocess_exec(
            "ping", param_count, "1", param_wait, wait_val, ip_address,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        return {"status": "success", "available": process.returncode == 0}
    except Exception as e:
        return {"status": "success", "available": False, "error": str(e)}

@app.post("/api/focas/connect")
async def focas_connect(conn: FocasConnection, client: FocasClientBase = Depends(get_focas_client)):
    if not ENABLE_FOCAS:
        raise HTTPException(status_code=501, detail="FOCAS support is disabled.")
    try:
        success = client.connect(conn.ip_address, conn.port, conn.timeout)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to connect to CNC")
        
        # Optionally, could query some basic CNC machine info here via client to verify
        client.disconnect()
        return {"status": "success", "message": f"Connected to {conn.ip_address}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/focas/programs/{path_no}")
async def focas_list_programs(path_no: int, ip_address: str, port: int = 8193, client: FocasClientBase = Depends(get_focas_client)):
    if not ENABLE_FOCAS:
        raise HTTPException(status_code=501, detail="FOCAS support is disabled.")
    try:
        if not client.connect(ip_address, port):
            raise HTTPException(status_code=500, detail="Failed to connect to CNC")
            
        programs = client.list_programs(path_no)
        return {"status": "success", "programs": programs}
    except FocasError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        client.disconnect()

@app.get("/api/focas/upload/{path_no}/{prog_num}")
async def focas_upload(path_no: int, prog_num: int, ip_address: str, port: int = 8193, client: FocasClientBase = Depends(get_focas_client)):
    if not ENABLE_FOCAS:
        raise HTTPException(status_code=501, detail="FOCAS support is disabled.")
    try:
        # FOCAS requires connecting, doing the operation, and disconnecting
        if not client.connect(ip_address, port):
            raise HTTPException(status_code=500, detail="Failed to connect to CNC before upload")
            
        program_text = client.upload_program(prog_num, path_no)
        return {"status": "success", "program_text": program_text}
    except FocasError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        client.disconnect()

@app.post("/api/focas/download/{path_no}")
async def focas_download(path_no: int, ip_address: str, data: FocasDownloadData, port: int = 8193, client: FocasClientBase = Depends(get_focas_client)):
    try:
        if not client.connect(ip_address, port):
            raise HTTPException(status_code=500, detail="Failed to connect to CNC before download")
            
        client.download_program(data.program_text, path_no)
        return {"status": "success", "message": "Program successfully downloaded to CNC"}
    except FocasError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        client.disconnect()

# --- Existing CGI Route ---


@app.post("/cgiserver")
async def cgiserver(request: Request):
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON request body")

    raw = json.dumps(data)

    output = await run_cgi(raw)

    try:
        return json.loads(output)
    except Exception:
        # If CGI returned non-JSON, pass raw output as error message
        logging.error("Invalid JSON from CGI: %s", output)
        raise HTTPException(status_code=502, detail="Invalid JSON from CGI subprocess")


# Serve favicon files directly so browsers requesting /favicon.svg or /favicon.ico
# don't get a 404 when the FastAPI backend is the same origin as the frontend.
@app.get("/favicon.svg")
async def favicon_svg():
    # Look for files in repository root and public/ (deployment may copy to either)
    repo_root = Path(__file__).resolve().parents[1]
    candidates = [repo_root / "favicon.svg", repo_root / "public" / "favicon.svg"]
    checked = []
    for p in candidates:
        exists = p.exists()
        checked.append({"path": str(p), "exists": exists})
        logging.info("favicon check: %s exists=%s", p, exists)
        if exists:
            return FileResponse(p, media_type="image/svg+xml")
    # None found — include the checked paths in the error detail to aid debugging
    detail = {"error": "favicon.svg not found", "checked": checked, "cwd": str(Path.cwd())}
    logging.warning("favicon.svg not found; checked: %s", checked)
    raise HTTPException(status_code=404, detail=detail)


@app.get("/favicon.ico")
async def favicon_ico():
    # Prefer an existing .ico file, but fall back to converted PNG if present.
    repo_root = Path(__file__).resolve().parents[1]
    candidates = [repo_root / "favicon.ico", repo_root / "public" / "favicon.ico"]
    checked = []
    for p in candidates:
        exists = p.exists()
        checked.append({"path": str(p), "exists": exists})
        logging.info("favicon.ico check: %s exists=%s", p, exists)
        if exists:
            return FileResponse(p, media_type="image/x-icon")
    detail = {"error": "favicon.ico not found", "checked": checked, "cwd": str(Path.cwd())}
    logging.warning("favicon.ico not found; checked: %s", checked)
    raise HTTPException(status_code=404, detail=detail)
