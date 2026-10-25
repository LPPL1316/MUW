"""The API's image carries the bytecode of its packages (TASK-289): the
processes of the nearby starts no longer compile the engine at every route,
and the routes already kept stay valid."""

from __future__ import annotations

import compileall
import shutil
from pathlib import Path

import pytest
import route_engine

from shaperoute_api import route_store

REPO = Path(__file__).resolve().parents[3]
PACKAGES = (
    "services/route-engine/route_engine",
    "services/ai/shaperoute_ai",
    "services/api/shaperoute_api",
)


def test_the_image_compiles_the_packages_it_copies() -> None:
    dockerfile = (REPO / "Dockerfile").read_text(encoding="utf-8")
    compiled = dockerfile.index("RUN python -m compileall")
    # The instruction, its lines joined where they end in a backslash.
    command = dockerfile[compiled:].replace("\\\n", " ").split("\n")[0]
    for package in PACKAGES:
        assert package in command
    # After the sources are copied, and while still root: the user that runs
    # the API cannot write next to them.
    assert dockerfile.index("COPY services/api services/api") < compiled
    assert compiled < dockerfile.index("USER shaperoute")


def test_bytecode_leaves_the_engine_fingerprint_alone(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The routes kept on the server are those of the engine's fingerprint
    (ADR-0136): compiling the engine must not change it."""
    engine = tmp_path / "route_engine"
    shutil.copytree(
        Path(route_engine.__file__).parent,
        engine,
        ignore=shutil.ignore_patterns("__pycache__"),
    )
    monkeypatch.setattr(route_store.route_engine, "__file__", str(engine / "x.py"))
    before = route_store.engine_fingerprint()
    assert compileall.compile_dir(engine, quiet=1)
    assert any(engine.rglob("*.pyc"))
    assert route_store.engine_fingerprint() == before
