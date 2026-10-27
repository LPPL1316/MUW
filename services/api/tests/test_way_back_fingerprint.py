"""The way back to a route draws no route (TASK-314, ADR-0274): the
engine's fingerprint, which keeps the examples drawn, leaves it out."""

from __future__ import annotations

import ast
import shutil
from pathlib import Path

import route_engine

from shaperoute_api.route_store import NOT_ROUTES, engine_fingerprint

ENGINE = Path(route_engine.__file__).parent


def _copy(to: Path) -> Path:
    folder = to / "route_engine"
    shutil.copytree(ENGINE, folder, ignore=shutil.ignore_patterns("__pycache__"))
    return folder


def test_the_fingerprint_is_the_engine_without_the_way_back(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    (folder / "way_back.py").unlink()

    assert engine_fingerprint(folder) == engine_fingerprint()


def test_a_change_to_the_way_back_keeps_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)

    with (folder / "way_back.py").open("a", encoding="utf-8") as file:
        file.write("\n# another way back\n")

    assert engine_fingerprint(folder) == before


def test_a_change_to_the_engine_changes_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)

    with (folder / "directions.py").open("a", encoding="utf-8") as file:
        file.write("\n# other directions\n")

    assert engine_fingerprint(folder) != before


def _imported(path: Path) -> set[str]:
    """The modules of route_engine that `path` imports."""
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text("utf-8"))):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if node.level > 0:
                module = f"route_engine.{module}".rstrip(".")
            found.add(module)
            found.update(f"{module}.{alias.name}" for alias in node.names)
    return found


def test_no_module_that_draws_routes_imports_the_way_back() -> None:
    # If one did, the way back would draw routes: take it out of NOT_ROUTES.
    left_out = {f"route_engine.{name.removesuffix('.py')}" for name in NOT_ROUTES}
    for path in sorted(ENGINE.rglob("*.py")):
        if path.relative_to(ENGINE).as_posix() in NOT_ROUTES:
            continue
        assert not _imported(path) & left_out, path.name
