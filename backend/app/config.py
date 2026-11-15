from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = "Nexera Agent API"
    api_key: str = os.getenv("NEXERA_API_KEY", "")
    openrouter_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_base_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    default_model: str = os.getenv("NEXERA_DEFAULT_MODEL", "openrouter/auto")
    workspace_root: str = os.getenv("NEXERA_WORKSPACE_ROOT", "/data/workspaces")
    enable_docker_sandbox: bool = os.getenv("NEXERA_ENABLE_SANDBOX", "false").lower() == "true"
    max_tool_rounds: int = int(os.getenv("NEXERA_MAX_TOOL_ROUNDS", "8"))
    max_output_chars: int = int(os.getenv("NEXERA_MAX_OUTPUT_CHARS", "18000"))
    request_timeout_seconds: float = float(os.getenv("NEXERA_REQUEST_TIMEOUT", "90"))


settings = Settings()
