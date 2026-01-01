from fastapi.testclient import TestClient
from backend.main_import import app
import os


client = TestClient(app)


def test_security_headers_default_deny_framing():
    os.environ.pop("FRAME_ANCESTORS", None)
    resp = client.get("/")
    assert resp.status_code in (200, 307)
    assert resp.headers.get("X-Frame-Options") == "DENY"


def test_security_headers_allow_iframe_with_frame_ancestors():
    os.environ["FRAME_ANCESTORS"] = "https://www.star-ncplot.com"
    resp = client.get("/")
    assert resp.status_code in (200, 307)
    assert "X-Frame-Options" not in resp.headers
    csp = resp.headers.get("Content-Security-Policy", "")
    assert "frame-ancestors" in csp.lower()
    assert "https://www.star-ncplot.com" in csp


def test_list_machines():
    resp = client.post("/ncplot7py/scripts/cgiserver.cgi", json={"action": "list_machines"})
    assert resp.status_code == 200
    j = resp.json()
    assert "success" in j
    assert j.get("success") in (True, False)
    assert ("message" in j) or ("machines" in j) or ("canal" in j)


def test_post_machinedata_minimal():
    payload = {"machinedata": [{"program": "G1 X10 X10", "machineName": "ISO_MILL", "canalNr": "1"}]}
    resp = client.post("/ncplot7py/scripts/cgiserver.cgi", json=payload)
    assert resp.status_code == 200
    j = resp.json()
    assert "success" in j
