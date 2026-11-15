from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from .config import settings
from .security import safe_relative_path, workspace_path

MAX_FILE_BYTES = 256_000
MAX_FILES = 120


class WorkspaceTools:
    def __init__(self, workspace_id: str):
        self.root = workspace_path(settings.workspace_root, workspace_id)

    def list_files(self) -> dict[str, Any]:
        items = []
        for path in sorted(self.root.rglob("*")):
            if path.is_file() and not any(part.startswith(".") for part in path.relative_to(self.root).parts):
                items.append({"path": path.relative_to(self.root).as_posix(), "bytes": path.stat().st_size})
                if len(items) >= MAX_FILES:
                    break
        return {"ok": True, "files": items}

    def read_file(self, path: str) -> dict[str, Any]:
        rel = safe_relative_path(path)
        target = (self.root / rel).resolve()
        if self.root not in target.parents or not target.is_file():
            return {"ok": False, "error": "File not found in this workspace."}
        data = target.read_bytes()
        return {"ok": True, "path": rel.as_posix(), "content": data[:MAX_FILE_BYTES].decode("utf-8", "replace"),
                "truncated": len(data) > MAX_FILE_BYTES}

    def write_file(self, path: str, content: str) -> dict[str, Any]:
        rel = safe_relative_path(path)
        if len(content.encode("utf-8")) > MAX_FILE_BYTES:
            return {"ok": False, "error": "File exceeds the 256 KB limit."}
        target = (self.root / rel).resolve()
        if self.root not in target.parents:
            return {"ok": False, "error": "Path escaped the workspace."}
        if not target.exists() and sum(1 for p in self.root.rglob("*") if p.is_file()) >= MAX_FILES:
            return {"ok": False, "error": "Workspace file limit reached."}
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return {"ok": True, "path": rel.as_posix(), "bytes": target.stat().st_size}

    def delete_file(self, path: str) -> dict[str, Any]:
        rel = safe_relative_path(path)
        if rel.as_posix() in {"index.html", "package.json"}:
            return {"ok": False, "error": "Core project files cannot be deleted by the agent."}
        target = (self.root / rel).resolve()
        if self.root not in target.parents or not target.is_file():
            return {"ok": False, "error": "File not found."}
        target.unlink()
        return {"ok": True, "path": rel.as_posix()}

    async def run_terminal(self, command: str) -> dict[str, Any]:
        if not settings.enable_docker_sandbox:
            return {"ok": False, "error": "Terminal execution is disabled. Enable the isolated Docker sandbox first."}
        if len(command) > 2000:
            return {"ok": False, "error": "Command is too long."}
        if shutil.which("docker") is None:
            return {"ok": False, "error": "Docker is not installed on this host."}
        # The workspace is the only writable mount. No network, low resource limits, non-root user.
        proc = await asyncio.create_subprocess_exec(
            "docker", "run", "--rm", "--network", "none", "--memory", "512m", "--cpus", "1",
            "--pids-limit", "64", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
            "-v", f"{self.root}:/workspace:rw", "-w", "/workspace",
            "--user", "10001:10001", "python:3.12-slim", "sh", "-lc", command,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        try:
            output, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()
            return {"ok": False, "error": "Sandbox command timed out after 20 seconds."}
        return {"ok": proc.returncode == 0, "exit_code": proc.returncode,
                "output": output.decode("utf-8", "replace")[-settings.max_output_chars:]}

    async def execute(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "workspace.list_files":
            return self.list_files()
        if name == "workspace.read_file":
            return self.read_file(str(arguments.get("path", "")))
        if name == "workspace.write_file":
            return self.write_file(str(arguments.get("path", "")), str(arguments.get("content", "")))
        if name == "workspace.delete_file":
            return self.delete_file(str(arguments.get("path", "")))
        if name == "terminal.run":
            return await self.run_terminal(str(arguments.get("command", "")))
        return {"ok": False, "error": f"Unknown tool: {name}"}
