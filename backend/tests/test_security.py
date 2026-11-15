import tempfile
from pathlib import Path

import pytest

from app.security import safe_relative_path, workspace_path


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
