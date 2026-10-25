"""Deterministic tests for tools/phone_engine/phone_engine.py: the engine in
the app is the engine in the repository, and Pyodide in the app is the one
written in the script. No network: they read the two zips in
apps/mobile/assets/engine/ and the repository's code."""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

import pytest
from phone_engine import (
    ASSETS,
    CORE,
    DEPENDS,
    ENTRY,
    LOCK,
    NOTICE,
    PACKAGES,
    BuildError,
    closure,
    engine_files,
    imported,
    module_path,
    stored_zip,
    trimmed_lock,
    zip_files,
)

REBUILD = "run: python tools/phone_engine/phone_engine.py engine"


def test_the_engine_in_the_app_is_the_engine_in_the_repository() -> None:
    # Fails when route_engine, or a module of the API the phone imports,
    # changed after engine.zip was built: the phone would draw with old code.
    shipped = zip_files((ASSETS / "engine.zip").read_bytes())
    fresh = engine_files()
    assert sorted(shipped) == sorted(fresh), f"engine.zip lists other files; {REBUILD}"
    changed = sorted(name for name in fresh if shipped[name] != fresh[name])
    assert not changed, f"engine.zip is older than {changed}; {REBUILD}"


def test_the_phone_gets_the_job_of_the_api_without_fastapi() -> None:
    modules = closure(ENTRY)
    assert ENTRY in modules
    assert "route_engine.nearby_starts" in modules
    assert "shaperoute_api.jobs" in modules
    for module, path in modules.items():
        assert "fastapi" not in imported(module, path), module
    assert "shaperoute_api.app" not in modules


def test_the_phone_draws_without_the_archive() -> None:
    # The archive of the drawn routes (TASK-297, ADR-0256) is the server's:
    # it needs PostgreSQL, which Pyodide has not. The phone's job must not
    # pull it in, nor psycopg, and jobs.py keeps working without a store.
    modules = closure(ENTRY)
    assert "shaperoute_api.route_archive" not in modules
    for module, path in modules.items():
        assert "psycopg" not in imported(module, path), module


def test_the_whole_engine_goes_with_its_data() -> None:
    names = engine_files()
    assert "route_engine/letters.json" in names
    assert "route_engine/shapes/outlines/star.json" in names
    assert "shaperoute_api/on_phone.py" in names
    assert not [
        name for name in names if "__pycache__" in name or name.endswith(".pyc")
    ]


def test_pyodide_in_the_app_is_the_one_written_here() -> None:
    files = zip_files((ASSETS / "pyodide.zip").read_bytes())
    for name, digest in CORE.items():
        if name != LOCK:
            assert hashlib.sha256(files[name]).hexdigest() == digest, name
    lock = json.loads(files[LOCK])
    assert sorted(lock["packages"]) == sorted(PACKAGES)
    wheels = {package["file_name"]: package for package in lock["packages"].values()}
    for name, package in wheels.items():
        assert hashlib.sha256(files[name]).hexdigest() == package["sha256"], name
    assert sorted(files) == sorted([*CORE, *wheels, NOTICE])
    assert lock["packages"]["networkx"]["depends"] == DEPENDS["networkx"]


def test_both_zips_are_stored_so_the_page_reads_them() -> None:
    for name in ("pyodide.zip", "engine.zip"):
        with zipfile.ZipFile(ASSETS / name) as archive:
            assert {i.compress_type for i in archive.infolist()} == {zipfile.ZIP_STORED}


def test_the_same_files_give_the_same_zip() -> None:
    files = [("b.txt", b"two"), ("a/one.py", b"one")]
    first = stored_zip(files)
    assert first == stored_zip(list(reversed(files)))
    assert zip_files(first) == {"a/one.py": b"one", "b.txt": b"two"}


def lock_of(**depends: list[str]) -> dict:
    return {
        "info": {"python": "3.14"},
        "packages": {
            name: {"name": name, "depends": depends.get(name, []), "version": "1"}
            for name in [*PACKAGES, "matplotlib"]
        },
    }


def test_the_lock_keeps_only_the_packages_of_the_engine() -> None:
    lock = trimmed_lock(lock_of(networkx=["matplotlib", "numpy"]))
    assert sorted(lock["packages"]) == sorted(PACKAGES)
    assert lock["packages"]["networkx"]["depends"] == ["numpy"]
    assert lock["info"] == {"python": "3.14"}


def test_a_package_that_needs_one_left_out_stops_the_build() -> None:
    with pytest.raises(BuildError, match="shapely depends on"):
        trimmed_lock(lock_of(shapely=["matplotlib"]))


def test_imports_are_followed_relative_or_absolute(tmp_path: Path) -> None:
    package = tmp_path / "shaperoute_api"
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "start.py").write_text(
        "from . import near\nfrom .far import thing\nimport json\n"
        "def later():\n    from shaperoute_api import lazy\n"
    )
    for name in ("near", "far", "lazy"):
        (package / f"{name}.py").write_text("")
    (package / "unused.py").write_text("")
    sources = {"shaperoute_api": tmp_path}
    found = closure("shaperoute_api.start", sources)
    assert sorted(found) == [
        "shaperoute_api",
        "shaperoute_api.far",
        "shaperoute_api.lazy",
        "shaperoute_api.near",
        "shaperoute_api.start",
    ]
    assert module_path("json", sources) is None
