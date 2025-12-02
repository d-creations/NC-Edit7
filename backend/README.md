# ncplot7py FastAPI adapter

This folder contains a small FastAPI adapter that runs side-by-side with the existing `cgiserver.cgi` script.

What it does
- Exposes a JSON HTTP endpoint at `/cgiserver` on port `8000`.
- For each request it invokes the existing `ncplot7py/scripts/cgiserver.cgi` as a subprocess, passing JSON on stdin and returning JSON on stdout.

Run locally with Docker Compose

Build and start the adapter (this also mounts the repo for live edits):

```bash
docker-compose build backend
docker-compose up backend
```

Then test the adapter:

```bash
curl -sS -X POST http://localhost:8000/cgiserver -H 'Content-Type: application/json' -d '{"action":"list_machines"}' | jq
```

Notes
- The original `cgiserver.cgi` is left in place — this adapter simply runs it as a subprocess so no behaviour change is required.
- Environment variables:
  - `CGI_PATH` - path to the CGI script inside container (default `/app/ncplot7py/scripts/cgiserver.cgi`).
  - `CGI_TIMEOUT` - seconds to wait for CGI to respond (default `30`).

If you want I can also:
- Add a Vite dev proxy so the frontend dev server forwards requests to the adapter path transparently.
- Implement a direct-import adapter (faster) if `ncplot7py` exposes callable functions.
