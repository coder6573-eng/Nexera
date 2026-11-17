# Nexera Python Agent API

This is the server-side agent runtime. It is separate from the Electron/Android shell and is designed to be deployed as a private API service.

## What it does

- Uses an OpenAI-compatible tool-calling model through OpenRouter.
- Runs an iterative agent loop: model reasoning → tool call → real tool result → next model turn → final response.
- Persists project files in per-workspace directories.
- Exposes bounded list/read/write/delete tools and an optional Docker terminal.
- Streams stage updates, tool calls, tool results, and the final answer as server-sent events.

This is not a scripted reply generator. The model chooses tools and arguments, and the backend executes them and returns the actual results.

## Run locally

Python 3.11+:

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export NEXERA_API_KEY="use-a-long-random-secret"
export OPENROUTER_API_KEY="your-provider-key"
export NEXERA_WORKSPACE_ROOT="./data/workspaces"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check `GET /health`. Agent calls use `POST /v1/agent/run` with a bearer token and JSON body:

```json
{
  "message": "Inspect this workspace and improve its responsive layout.",
  "workspace_id": "demo",
  "model": "openrouter/auto",
  "provider": "openrouter",
  "mode": "agent",
  "skill": "frontend"
}
```

The client first synchronizes project files with `PUT /v1/workspaces/{workspace_id}/files` using `{ "files": { "index.html": "..." } }`. It can retrieve the updated workspace with `GET /v1/workspaces/{workspace_id}/files/content`. Both routes require the same bearer token.

The response is an SSE stream. Each `data:` line contains JSON with a `type` of `stage`, `plan`, `tool_start`, `tool_result`, `final`, or `error`. Supply `planner_model` and `orchestrator_model` to route planning and implementation separately. `mode` accepts `agent` or `build`; build mode omits destructive delete and terminal tools.

## Docker deployment

Build with `docker build -t nexera-agent-api backend`. Provide `NEXERA_API_KEY` and `OPENROUTER_API_KEY` as runtime secrets, not build arguments. Persist `/data/workspaces` on a private volume. Set `NEXERA_CORS_ORIGINS` to the exact trusted frontend origins.

Do not expose the service without TLS, a strong API key, rate limiting at the edge, and a private workspace volume. The current single bearer token is suitable only for private testing: any client that uses it can extract it from its own network session. Do not distribute a shared master token to public users; add per-user authentication and quotas before a public launch. The OpenRouter provider key must remain server-side and must never be put in frontend JavaScript or a public repository.

## Terminal sandbox

Terminal execution is disabled by default. To enable it on a private, single-user host, install Docker, build the sandbox image with `docker build -t nexera-agent-sandbox:latest backend/sandbox`, and set `NEXERA_ENABLE_SANDBOX=true`. The image includes Node.js and Python. Commands execute in a short-lived container with no network, dropped Linux capabilities, no-new-privileges, a 512 MB memory cap, one CPU, 64 process limit, a read-only container filesystem, and only the selected workspace mounted writable. The API process must be able to reach the Docker daemon. Do not expose Docker socket access to an untrusted multi-user API; use a dedicated hardened sandbox service for public deployments.

## Client integration and deployment status

The V21 Android/Electron client includes an optional Python Agent route. In Settings, select **Nexera Python Agent**, enter the URL of your privately deployed API and its bearer token, then use Vibecoding mode. The URL is saved in app settings; the token is memory-only and must be entered again after restarting the app. The backend is not hosted by this repository and is not enabled automatically for public users.
