"""The anchored drawing and the strokes of TASK-347 (ADR-0300) change no
route kept: the engine's fingerprint, which keeps the examples drawn, leaves
the two modules out (route_store.ANCHORED_ONLY), as it does the swims
(test_swim_fingerprint.py), and no module that draws other routes imports
them."""

from __future__ import annotations

import ast
import shutil
from pathlib import Path

import route_engine

from shaperoute_api.paddle_examples import engine_files
from shaperoute_api.route_store import (
    ANCHORED_ONLY,
    NOT_ROUTES,
    SWIM_ONLY,
    engine_fingerprint,
)

ENGINE = Path(route_engine.__file__).parent


def _imported(path: Path) -> set[str]:
    """The modules of route_engine that `path` imports (as
    test_swim_fingerprint reads them; not imported from there: in CI the
    tests folder is not a package)."""
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


def test_the_two_modules_exist_and_are_left_out() -> None:
    assert ANCHORED_ONLY == {"anchored.py", "stroke_match.py"}
    for name in ANCHORED_ONLY:
        assert (ENGINE / name).is_file()
    assert not ANCHORED_ONLY & (NOT_ROUTES | SWIM_ONLY)


def test_the_fingerprint_is_the_engine_without_them(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    for name in ANCHORED_ONLY:
        (folder / name).unlink()
    assert engine_fingerprint(folder) == engine_fingerprint()


def test_a_change_to_them_keeps_the_fingerprint(tmp_path: Path) -> None:
    folder = _copy(tmp_path)
    before = engine_fingerprint(folder)
    for name in ANCHORED_ONLY:
        with (folder / name).open("a", encoding="utf-8") as file:
            file.write("\n# a tighter magnet\n")
    assert engine_fingerprint(folder) == before


def test_no_module_that_draws_other_routes_imports_them() -> None:
    # If one did, the anchored code would draw the routes kept: take it out
    # of ANCHORED_ONLY.
    anchored = {f"route_engine.{name.removesuffix('.py')}" for name in ANCHORED_ONLY}
    for path in sorted(ENGINE.rglob("*.py")):
        if (
            path.relative_to(ENGINE).as_posix()
            in NOT_ROUTES | SWIM_ONLY | ANCHORED_ONLY
        ):
            continue
        assert not _imported(path) & anchored, path.name


def test_the_paddling_examples_are_drawn_without_them() -> None:
    files = {path.relative_to(ENGINE).as_posix() for path in engine_files()}
    assert not files & ANCHORED_ONLY
