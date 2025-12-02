from fastapi.testclient import TestClient
from backend.main_import import app


client = TestClient(app)


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
