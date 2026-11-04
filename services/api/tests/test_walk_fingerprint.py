"""A walk (TASK-371, ADR-0315) changes no route kept: it is drawn as a run,
and the engine's fingerprint, which keeps the examples drawn, leaves its
module out (route_store.WALK_ONLY), as it does the swims, the anchored
drawings and the drawings on the water; no module that draws routes imports
it. The fingerprints are those of the night the examples are drawn again
for the swims (TASK-323 B): a walk does not make it two."""

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
    WALK_ONLY,
    engine_fingerprint,
)

ENGINE = Path(route_engine.__file__).parent
LEFT_OUT = NOT_ROUTES | SWIM_ONLY | ANCHORED_ONLY | DRAWN_WATER_ONLY | WALK_ONLY
# The engine's fingerprints when the walk joined: every route but a swim,
# and the swims'.
ROUTES = "5b5e026cea9b"
SWIMS = "b9d00c37d28d"


def _imported(path: Path) -> set[str]:
    """The modules of route_engine that `path` imports (as
    test_drawn_water_fingerprint reads them; not imported from there: in CI
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
    assert WALK_ONLY == {"walking.py"}
    assert (ENGINE / "walking.py").is_file()
    assert not WALK_ONLY & (NOT_ROUTES | SWIM_ONLY | ANCHORED_ONLY | DRAWN_WATER_ONLY)


def test_the_fingerprints_are_those_of_the_engine_before_the_walk() -> None:
    # Changed by something else than the walk: write the new ones here, and
    # say in the PR which examples kept are drawn again.
    assert engine_fingerprint() == ROUTES
    assert engine_fingerprint(swims=True) == SWIMS


def test_the_fingerprint_is_the_engine_without_it(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    (folder / "walking.py").unlink()
    assert engine_fingerprint(folder) == engine_fingerprint()
    assert engine_fingerprint(folder, swims=True) == engine_fingerprint(swims=True)


def test_a_change_to_it_keeps_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)
    with (folder / "walking.py").open("a", encoding="utf-8") as file:
        file.write("\n# a walk drawn otherwise\n")
    assert engine_fingerprint(folder) == before


def test_no_module_that_draws_routes_imports_it() -> None:
    # If one did, the walk would draw the routes kept: take it out of
    # WALK_ONLY.
    walk = {f"route_engine.{name.removesuffix('.py')}" for name in WALK_ONLY}
    for path in sorted(ENGINE.rglob("*.py")):
        if path.relative_to(ENGINE).as_posix() in LEFT_OUT:
            continue
        assert not _imported(path) & walk, path.name


def test_the_paddling_examples_are_drawn_without_it() -> None:
    files = {path.relative_to(ENGINE).as_posix() for path in engine_files()}
    assert not files & WALK_ONLY
