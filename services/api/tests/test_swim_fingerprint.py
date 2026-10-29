"""The swims of TASK-323 change no route kept (ADR-0283): the engine's
fingerprint, which keeps the examples drawn, leaves the files that draw only
swims out, and no module that draws other routes imports them."""

from __future__ import annotations

import ast
import shutil
from pathlib import Path

import route_engine

from shaperoute_api.paddle_examples import engine_files
from shaperoute_api.route_store import NOT_ROUTES, SWIM_ONLY, engine_fingerprint

ENGINE = Path(route_engine.__file__).parent


def _copy(to: Path) -> Path:
    folder = to / "route_engine"
    shutil.copytree(ENGINE, folder, ignore=shutil.ignore_patterns("__pycache__"))
    return folder


def test_the_fingerprint_is_the_engine_without_the_swims(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    for name in SWIM_ONLY:
        (folder / name).unlink()

    assert engine_fingerprint(folder) == engine_fingerprint()


def test_a_change_to_a_swim_keeps_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)

    for name in SWIM_ONLY:
        with (folder / name).open("a", encoding="utf-8") as file:
            file.write("\n# another band\n")

    assert engine_fingerprint(folder) == before


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


def test_no_module_that_draws_other_routes_imports_a_swim() -> None:
    # If one did, the swims would draw the routes kept: take it out of
    # SWIM_ONLY.
    swims = {f"route_engine.{name.removesuffix('.py')}" for name in SWIM_ONLY}
    for path in sorted(ENGINE.rglob("*.py")):
        if path.relative_to(ENGINE).as_posix() in NOT_ROUTES | SWIM_ONLY:
            continue
        assert not _imported(path) & swims, path.name


def test_the_paddling_examples_are_drawn_without_the_swims() -> None:
    # The app's paddling examples say the engine that drew them
    # (paddle_examples.engine_fingerprint): the swims are not part of it.
    files = {path.relative_to(ENGINE).as_posix() for path in engine_files()}
    assert not files & SWIM_ONLY
