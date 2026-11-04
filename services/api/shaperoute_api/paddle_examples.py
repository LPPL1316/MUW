"""The paddling examples of «Explore» that come with the app (TASK-227,
ADR-0189).

The user's choice: the examples of the places of «Explore» with «Paddle»
(the lakes and the beaches of the app's `waterPlaces.ts`) are in the app as
it is downloaded, not drawn on its first opening. This command draws them
with the engine, as the API would (`paddling.plan_water`), on the water of a
cache folder: the server's `data/cache/water/`, or a copy of it (TASK-225).
It writes them as the app keeps the examples it draws
(`exampleRoutes.ts`, `asRecommended`): for each place, under the key the app
looks it up by, its eight shapes whole. A shape in pieces is drawn piece by
piece, the pen up between them, as the app asks for it on the water
(TASK-226): its example has the `walks`. Each says the `centre` of its
shape, as the API's answer does, so the app can ask for it moved (TASK-244),
and how far the engine turned the shape (`rotation_deg`, TASK-232), when it
did: the app shows the card and the map turned back.

    python -m shaperoute_api.paddle_examples --cache-dir out/water-cache

Nothing is downloaded: a place whose water is not in the folder stops the
command. The file changes with the places, the shapes and the engine; run
the app's Prettier on it after (`npx prettier --write <file>`).

The file says which engine drew it (`engine`): the fingerprint of the
engine's files a paddling route is drawn with (`route_engine.paddling` and
what it imports, followed through the `import` lines, and the outlines of
the eight shapes). When one of them changes, `tests/test_paddle_examples.py`
fails and says to run this command again, as the phone's engine zip does
(tools/phone_engine). The water comes from the server: `scp
'root@<server>:/root/shaperoute/data/cache/water/*.json' <cache>/water/`.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import route_engine
from route_engine.errors import ShapeNotDrawableError
from route_engine.geo import LatLon
from route_engine.models import RouteRequest
from route_engine.shapes import in_pieces
from route_engine.water import OverpassWaterSource, WaterNotCachedError, WaterSource

from shaperoute_api.paddling import plan_water
from shaperoute_api.route_store import same_routes_as

REPO = Path(__file__).resolve().parents[3]
WATER_PLACES = REPO / "apps" / "mobile" / "src" / "paddle" / "waterPlaces.ts"
OUT = REPO / "apps" / "mobile" / "src" / "paddle" / "paddleExamples.json"

# The app's PADDLE_EXAMPLES, as its cards show them (`setShapes`): the first
# shapes, then the others of the run (TASK-176), the user's choice.
SHAPES = (
    "heart",
    "circle",
    "star",
    "moon",
    "horse",
    "snail",
    "dog_head",
    "rabbit_head",
)
DISTANCE_M = 2000
ACTIVITY = "paddling"
# The shapes in pieces the app draws in one line on the water all the same
# (its penUpShapes.ts, APART_ON_WATER, the user's choice): the sun's rays
# would be nine pauses.
PEN_DOWN_ON_WATER = frozenset({"sun"})
# As the app's: `PADDLE_EXAMPLES.prefix`, `ID_PREFIX`, `LICENSE`.
KEY_PREFIX = "paddling:"
ID_PREFIX = "example:"
LICENSE = (
    "Routes on OpenStreetMap data, (c) OpenStreetMap contributors, "
    "ODbL 1.0: https://www.openstreetmap.org/copyright"
)
# About 10 cm: what the phone's GPS cannot tell apart, a lighter app.
DECIMALS = 6
ENGINE = Path(route_engine.__file__).parent
# What draws a route on the water: its imports are followed from here.
ENTRY = "route_engine.paddling"

_PLACE = re.compile(
    r'name:\s*"(?P<name>[^"]+)"[^{}]*?point:\s*\[\s*(?P<lat>-?[\d.]+)\s*,'
    r"\s*(?P<lon>-?[\d.]+)\s*\]",
    re.DOTALL,
)


@dataclass(frozen=True)
class WaterPlace:
    name: str
    point: LatLon


def read_places(path: Path = WATER_PLACES) -> list[WaterPlace]:
    """The places of the app's `WATER_PLACES`, in its order."""
    text = path.read_text(encoding="utf-8")
    places = [
        WaterPlace(m["name"], (float(m["lat"]), float(m["lon"])))
        for m in _PLACE.finditer(text)
    ]
    if not places:
        raise ValueError(f"no water places in {path}")
    return places


def _module_file(name: str) -> Path | None:
    parts = name.split(".")
    if parts[0] != "route_engine":
        return None
    base = ENGINE.joinpath(*parts[1:])
    for candidate in (base.with_suffix(".py"), base / "__init__.py"):
        if candidate.is_file():
            return candidate
    return None


def _imported(path: Path) -> set[str]:
    """The modules of the engine `path` imports, anywhere in it."""
    found: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            found.add(node.module)
            found.update(f"{node.module}.{alias.name}" for alias in node.names)
    return {name for name in found if name.split(".")[0] == "route_engine"}


def engine_files(shapes: Sequence[str] = SHAPES) -> list[Path]:
    """The engine's files a paddling example is drawn with: `ENTRY`, every
    module of the engine it imports in turn, with their packages, and the
    outlines of `shapes` that are files."""
    seen: set[str] = set()
    todo = [ENTRY]
    files: set[Path] = set()
    while todo:
        name = todo.pop()
        if name in seen:
            continue
        seen.add(name)
        path = _module_file(name)
        if path is None:
            continue
        files.add(path)
        parts = name.split(".")
        todo.extend(".".join(parts[:n]) for n in range(1, len(parts)))
        todo.extend(_imported(path))
    outlines = ENGINE / "shapes" / "outlines"
    files.update(p for p in (outlines / f"{s}.json" for s in shapes) if p.is_file())
    return sorted(files)


def engine_fingerprint(shapes: Sequence[str] = SHAPES) -> str:
    """`engine_files` as a few letters, from their content (as
    route_store.engine_fingerprint does for the whole engine); an engine
    that only moved its code keeps the earlier one (SAME_ROUTES_AS)."""
    return same_routes_as(code_fingerprint(shapes))


def code_fingerprint(shapes: Sequence[str] = SHAPES) -> str:
    """The fingerprint of `engine_files` as they are, before SAME_ROUTES_AS."""
    digest = hashlib.sha256()
    for path in engine_files(shapes):
        digest.update(path.relative_to(ENGINE).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def place_key(point: LatLon) -> str:
    """The app's `examplesKey(point, PADDLE_EXAMPLES)`."""
    return f"{KEY_PREFIX}{point[0]:.4f},{point[1]:.4f}"


def apart_on_water(shape: str) -> bool:
    """Whether the app asks for `shape` with the pen up on the water: every
    shape in pieces but those of PEN_DOWN_ON_WATER (its `apartOnWater`)."""
    return in_pieces(shape) and shape not in PEN_DOWN_ON_WATER


def example(place: WaterPlace, shape: str, source: WaterSource) -> dict[str, Any]:
    """One example whole, as the app's `asRecommended(...).detail`."""
    request = RouteRequest(
        start=place.point,
        shape=shape,
        distance_m=DISTANCE_M,
        activity=ACTIVITY,
        pen_up=apart_on_water(shape),
    )
    result = plan_water(request, source).result
    return {
        "id": f"{ID_PREFIX}{shape}:{place_key(place.point)}",
        "city": place.name.split(",")[0].strip(),
        "shape": shape,
        "word": None,
        "style": None,
        "distance_m": DISTANCE_M,
        "route_m": round(result.distance_m, 1),
        "similarity": result.similarity,
        "points": [
            [round(lat, DECIMALS), round(lon, DECIMALS)] for lat, lon in result.points
        ],
        "license": LICENSE,
        "activity": ACTIVITY,
        # Where the engine placed the shape: what «Move the shape» moves
        # (TASK-244), as the app keeps it from a route it asked for.
        **(
            {"centre": [round(v, DECIMALS) for v in result.centre]}
            if result.centre is not None
            else {}
        ),
        # The stretches with the pen up, only when there are some.
        **({"walks": [list(walk) for walk in result.walks]} if result.walks else {}),
        # How far the shape is turned (TASK-232, ADR-0195), only when it is:
        # as the app keeps it (`turnOf`), upright means no field.
        **(
            {"rotation_deg": round(result.rotation_deg, 2)}
            if result.rotation_deg
            else {}
        ),
        # On the water the engine places the shape once (ADR-0164).
        "alternatives": [],
    }


def examples(
    places: Sequence[WaterPlace],
    source: WaterSource,
    shapes: Sequence[str] = SHAPES,
) -> dict[str, list[dict[str, Any]]]:
    """Every place's examples, under the key the app reads them by."""
    return {
        place_key(place.point): [example(place, shape, source) for shape in shapes]
        for place in places
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.paddle_examples",
        description="Write the paddling examples the app comes with (TASK-227).",
    )
    parser.add_argument(
        "--cache-dir", type=Path, required=True, help="a cache with water/ in it"
    )
    parser.add_argument("--places", type=Path, default=WATER_PLACES)
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)

    places = read_places(args.places)
    source = OverpassWaterSource(args.cache_dir, download=False)
    try:
        found = examples(places, source)
    except WaterNotCachedError as exc:
        print(f"No water for a place in {args.cache_dir}: {exc}", file=sys.stderr)
        return 1
    except ShapeNotDrawableError as exc:
        print(f"A shape does not fit: {exc}", file=sys.stderr)
        return 1
    text = json.dumps(
        {"engine": engine_fingerprint(), "examples": found},
        ensure_ascii=False,
        indent=2,
    )
    args.out.write_text(text + "\n", encoding="utf-8")
    count = sum(len(routes) for routes in found.values())
    print(f"Wrote {args.out}: {count} examples in {len(found)} places")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
