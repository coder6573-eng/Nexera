from __future__ import annotations

import asyncio
from dataclasses import replace
from types import SimpleNamespace

from app import agent, tools
from app.config import settings


class FakeResponse:
    status_code = 200
    text = ""

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class FakeClient:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, *, headers, json):
        self.calls.append(json)
        if json["model"] == "planner":
            return FakeResponse({"model": "planner", "choices": [{"message": {"content": "Inspect files, then update the page."}}]})
        if len(self.calls) == 2:
            return FakeResponse({
                "model": "builder",
                "choices": [{"message": {
                    "content": None,
                    "tool_calls": [{
                        "id": "call-list",
                        "function": {"name": "workspace.list_files", "arguments": "{}"},
                    }],
                }}],
            })
        return FakeResponse({"model": "builder", "choices": [{"message": {"content": "Updated the project after inspecting its files."}}]})


def test_agent_uses_planner_then_executes_real_workspace_tool(tmp_path, monkeypatch):
    FakeClient.calls = []
    monkeypatch.setattr(agent, "settings", replace(settings, openrouter_key="test-key", workspace_root=str(tmp_path)))
    monkeypatch.setattr(tools, "settings", replace(settings, workspace_root=str(tmp_path)))
    monkeypatch.setattr(agent.httpx, "AsyncClient", FakeClient)

    workspace = tools.WorkspaceTools("agent-test")
    workspace.write_file("index.html", "<!doctype html><html></html>")
    request = SimpleNamespace(
        workspace_id="agent-test",
        history=[],
        model="builder",
        planner_model="planner",
        orchestrator_model="builder",
        skill="frontend",
        mode="agent",
        message="Inspect and improve this project.",
    )

    async def collect():
        return [event async for event in agent.run_agent(request)]

    events = asyncio.run(collect())
    types = [event["type"] for event in events]
    assert "plan" in types
    assert "tool_start" in types
    assert "tool_result" in types
    assert types[-1] == "final"
    assert [call["model"] for call in FakeClient.calls] == ["planner", "builder", "builder"]
    tool_result = next(event for event in events if event["type"] == "tool_result")
    assert tool_result["result"]["files"][0]["path"] == "index.html"


def test_build_mode_omits_destructive_and_terminal_tools():
    names = [item["function"]["name"] for item in agent._tools_for_mode("build")]
    assert "workspace.list_files" in names
    assert "workspace.read_file" in names
    assert "workspace.write_file" in names
    assert "workspace.delete_file" not in names
    assert "terminal.run" not in names


def test_agent_request_supports_separate_models():
    from app.schemas import AgentRequest

    request = AgentRequest(
        message="Build a page",
        planner_model="planner",
        orchestrator_model="builder",
        mode="agent",
    )
    assert request.planner_model == "planner"
    assert request.orchestrator_model == "builder"
