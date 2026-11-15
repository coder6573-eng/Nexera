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

The response is an SSE stream. Each `data:` line contains JSON with a `type` of `stage`, `tool_start`, `tool_result`, `final`, or `error`.

## Docker deployment

Build with `docker build -t nexera-agent-api backend`. Provide `NEXERA_API_KEY` and `OPENROUTER_API_KEY` as runtime secrets, not build arguments. Persist `/data/workspaces` on a private volume. Set `NEXERA_CORS_ORIGINS` to the exact trusted frontend origins.

Do not expose the service without TLS, a strong API key, rate limiting at the edge, and a private workspace volume. Do not put either server secret in frontend JavaScript or a public repository.

## Terminal sandbox

Terminal execution is disabled by default. To enable it, install Docker on the API host and set `NEXERA_ENABLE_SANDBOX=true`. Commands execute in a short-lived container with no network, a 512 MB memory cap, one CPU, 64 process limit, a read-only container filesystem, and only the selected workspace mounted writable. This is a baseline isolation layer, not a substitute for a dedicated hardened sandbox service.

## Limits and current integration status

The API is a deployable backend foundation. The existing Android/Electron frontend still has its own provider path; it does not automatically call this API until an API URL and bearer-token configuration flow is connected. Do not treat the backend as integrated into the shipped APK yet.
