import tempfile
from pathlib import Path

import pytest

from app.security import safe_relative_path, workspace_path
from app.config import Settings
from app import tools as tools_module
from app.tools import WorkspaceTools


def test_workspace_is_created_inside_root():
    with tempfile.TemporaryDirectory() as root:
        target = workspace_path(root, "demo-1")
        assert target == Path(root).resolve() / "demo-1"
        assert target.is_dir()


@pytest.mark.parametrize("value", ["../escape", "/etc/passwd", "a/../../b", "", "a\\b"])
def test_unsafe_relative_paths_are_rejected(value):
    with pytest.raises(ValueError):
        safe_relative_path(value)


def test_nested_relative_path_is_allowed():
    assert safe_relative_path("src/main.py").as_posix() == "src/main.py"


def test_invalid_workspace_id_is_rejected():
    with tempfile.TemporaryDirectory() as root:
        with pytest.raises(ValueError):
            workspace_path(root, "../outside")



def test_workspace_sync_and_export_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(tools_module, "settings", Settings(workspace_root=str(tmp_path)))
    workspace = WorkspaceTools("sync-demo")
    result = workspace.sync_files({"index.html": "<!doctype html><html></html>", "src/app.js": "console.log('ok')"})
    assert result["ok"] is True
    exported = workspace.export_files()
    assert exported["ok"] is True
    assert exported["files"]["src/app.js"] == "console.log('ok')"


def test_workspace_sync_removes_stale_visible_files(tmp_path, monkeypatch):
    monkeypatch.setattr(tools_module, "settings", Settings(workspace_root=str(tmp_path)))
    workspace = WorkspaceTools("sync-demo")
    workspace.write_file("old.js", "old")
    workspace.sync_files({"index.html": "<!doctype html><html></html>"})
    assert workspace.export_files()["files"] == {"index.html": "<!doctype html><html></html>"}


@pytest.mark.parametrize("files", [
    {"../escape.txt": "no"},
    {".secret": "no"},
    {"nested/.secret": "no"},
])
def test_workspace_sync_rejects_unsafe_paths_without_writing(tmp_path, monkeypatch, files):
    monkeypatch.setattr(tools_module, "settings", Settings(workspace_root=str(tmp_path)))
    workspace = WorkspaceTools("sync-demo")
    result = workspace.sync_files(files)
    assert result["ok"] is False
    assert workspace.export_files()["files"] == {}


def test_workspace_sync_rejects_oversized_file(tmp_path, monkeypatch):
    monkeypatch.setattr(tools_module, "settings", Settings(workspace_root=str(tmp_path)))
    workspace = WorkspaceTools("sync-demo")
    result = workspace.sync_files({"large.txt": "x" * 256_001})
    assert result["ok"] is False
    assert workspace.export_files()["files"] == {}


def test_workspace_sync_validates_all_paths_before_writing(tmp_path, monkeypatch):
    monkeypatch.setattr(tools_module, "settings", Settings(workspace_root=str(tmp_path)))
    workspace = WorkspaceTools("atomic-demo")
    result = workspace.sync_files({"valid.txt": "must not be written", "../invalid.txt": "reject"})
    assert result["ok"] is False
    assert workspace.export_files()["files"] == {}
