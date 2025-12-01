from fastapi import FastAPI, Request, HTTPException
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

    return stdout.decode("utf-8")


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
