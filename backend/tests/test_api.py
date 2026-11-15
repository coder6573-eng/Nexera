from __future__ import annotations

from dataclasses import replace

from fastapi.testclient import TestClient

from app import main, tools as tools_module
from app.config import settings


def test_health_endpoint_is_available_without_credentials():
    client = TestClient(main.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_workspace_endpoints_require_bearer_auth(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, api_key="private-test-token", workspace_root=str(tmp_path)))
    monkeypatch.setattr(tools_module, "settings", replace(settings, workspace_root=str(tmp_path)))
    client = TestClient(main.app)

    denied = client.get("/v1/workspaces/demo/files")
    assert denied.status_code == 401

    headers = {"Authorization": "Bearer private-test-token"}
    written = client.put(
        "/v1/workspaces/demo/files",
        headers=headers,
        json={"files": {"index.html": "<h1>hello</h1>"}},
    )
    assert written.status_code == 200
    assert written.json()["written"] == 1

    exported = client.get("/v1/workspaces/demo/files/content", headers=headers)
    assert exported.status_code == 200
    assert exported.json()["files"]["index.html"] == "<h1>hello</h1>"


def test_agent_endpoint_streams_backend_events(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "settings", replace(settings, api_key="private-test-token", workspace_root=str(tmp_path)))

    async def fake_run_agent(request):
        assert request.message == "Build a page"
        yield {"type": "stage", "stage": "Thinking"}
        yield {"type": "final", "content": "Page completed.", "model": "test-model"}

    monkeypatch.setattr(main, "run_agent", fake_run_agent)
    client = TestClient(main.app)
    response = client.post(
        "/v1/agent/run",
        headers={"Authorization": "Bearer private-test-token"},
        json={"message": "Build a page", "workspace_id": "api-test"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert '"type": "stage"' in response.text
    assert '"type": "final"' in response.text
    assert "data: [DONE]" in response.text
