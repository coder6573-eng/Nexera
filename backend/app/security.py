from __future__ import annotations

import re
from pathlib import Path

WORKSPACE_ID = re.compile(r"^[a-zA-Z0-9_-]{1,64}$")


def workspace_path(root: str, workspace_id: str) -> Path:
    if not WORKSPACE_ID.fullmatch(workspace_id):
        raise ValueError("Invalid workspace identifier.")
    base = Path(root).resolve()
    target = (base / workspace_id).resolve()
    if target != base and base not in target.parents:
        raise ValueError("Workspace path escaped its root.")
    target.mkdir(parents=True, exist_ok=True)
    return target


def safe_relative_path(raw: str) -> Path:
    candidate = Path(raw)
    if not raw or candidate.is_absolute() or "\\" in raw:
        raise ValueError("Use a safe relative workspace path.")
    if any(part in {"", ".", ".."} for part in candidate.parts):
        raise ValueError("Path traversal is not allowed.")
    if len(candidate.parts) > 8 or len(raw) > 240:
        raise ValueError("Path is too deep or too long.")
    return candidate
