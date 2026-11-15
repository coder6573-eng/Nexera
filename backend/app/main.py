from __future__ import annotations

import json
import secrets
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .agent import run_agent
from .config import settings
from .schemas import AgentRequest
from .security import workspace_path

app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in __import__("os").getenv("NEXERA_CORS_ORIGINS", "http://localhost:8000").split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


async def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not settings.api_key:
        raise HTTPException(status_code=503, detail="NEXERA_API_KEY is not configured.")
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not secrets.compare_digest(supplied, settings.api_key):
        raise HTTPException(status_code=401, detail="Invalid API key.")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": app.version}


@app.post("/v1/agent/run", dependencies=[Depends(require_auth)])
async def agent_run(request: AgentRequest) -> StreamingResponse:
    # Resolve and create the isolated workspace before starting model work.
    workspace_path(settings.workspace_root, request.workspace_id)

    async def events() -> AsyncIterator[str]:
        async for event in run_agent(request):
            yield "data: " + json.dumps(event, ensure_ascii=False) + "\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/v1/workspaces/{workspace_id}/files", dependencies=[Depends(require_auth)])
async def list_workspace_files(workspace_id: str) -> dict:
    from .tools import WorkspaceTools
    return WorkspaceTools(workspace_id).list_files()
