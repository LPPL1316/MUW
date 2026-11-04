"""A drawing paddled on the water (TASK-369, ADR-0313) changes no route
kept: the engine's fingerprint, which keeps the examples drawn, leaves its
module out (route_store.DRAWN_WATER_ONLY), as it does the swims and the
anchored drawings (test_anchored_fingerprint.py), and no module that draws
other routes imports it."""

from __future__ import annotations

import ast
import shutil
from pathlib import Path

import route_engine

from shaperoute_api.paddle_examples import engine_files
from shaperoute_api.route_store import (
    ANCHORED_ONLY,
    DRAWN_WATER_ONLY,
    NOT_ROUTES,
    SWIM_ONLY,
    engine_fingerprint,
)

ENGINE = Path(route_engine.__file__).parent
LEFT_OUT = NOT_ROUTES | SWIM_ONLY | ANCHORED_ONLY | DRAWN_WATER_ONLY


def _imported(path: Path) -> set[str]:
    """The modules of route_engine that `path` imports (as
    test_anchored_fingerprint reads them; not imported from there: in CI
    the tests folder is not a package)."""
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


def _copy(to: Path) -> Path:
    folder = to / "route_engine"
    shutil.copytree(ENGINE, folder, ignore=shutil.ignore_patterns("__pycache__"))
    return folder


def test_the_module_exists_and_is_left_out() -> None:
    assert DRAWN_WATER_ONLY == {"drawn_water.py"}
    assert (ENGINE / "drawn_water.py").is_file()
    assert not DRAWN_WATER_ONLY & (NOT_ROUTES | SWIM_ONLY | ANCHORED_ONLY)


def test_the_fingerprint_is_the_engine_without_it(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    (folder / "drawn_water.py").unlink()
    assert engine_fingerprint(folder) == engine_fingerprint()
    # The swims' own fingerprint leaves it out too.
    assert engine_fingerprint(folder, swims=True) == engine_fingerprint(swims=True)


def test_a_change_to_it_keeps_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)
    with (folder / "drawn_water.py").open("a", encoding="utf-8") as file:
        file.write("\n# a drawing paddled otherwise\n")
    assert engine_fingerprint(folder) == before


def test_no_module_that_draws_other_routes_imports_it() -> None:
    # If one did, the drawing on the water would draw the routes kept: take
    # it out of DRAWN_WATER_ONLY.
    drawn = {f"route_engine.{name.removesuffix('.py')}" for name in DRAWN_WATER_ONLY}
    for path in sorted(ENGINE.rglob("*.py")):
        if path.relative_to(ENGINE).as_posix() in LEFT_OUT:
            continue
        assert not _imported(path) & drawn, path.name


def test_the_paddling_examples_are_drawn_without_it() -> None:
    files = {path.relative_to(ENGINE).as_posix() for path in engine_files()}
    assert not files & DRAWN_WATER_ONLY
