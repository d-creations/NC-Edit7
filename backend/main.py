from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import os
import logging

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

logging.basicConfig(level=logging.INFO)


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
