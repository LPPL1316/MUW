"""The lifts and downhill pistes of the Alps from OpenStreetMap extracts
(TASK-375 part D, ADR-0319).

A day of skiing names the lifts it took and the pistes it skied
(ski_names.py). Their lines come from Geofabrik's extracts, as the water
does (water_extract.py), because Overpass refuses the server (ADR-0154):
osmium keeps the lifts and the pistes once, and this command writes them as
files of tiles of TILE_DEG a side in `<cache_dir>/ski/`. Each line goes in
every tile its box touches; the files of a day's box hold every line near
it. A second extract merges into the tiles already written, a line in two
extracts (a lift across a border) kept once.

    osmium tags-filter italy-latest.osm.pbf w/aerialway \
        nwr/piste:type=downhill -o italy-ski.osm.pbf
    python -m shaperoute_api.ski_extract \
        --extract italy-ski.osm.pbf austria-ski.osm.pbf --cache-dir data/cache

`--osm` reads OSM XML files instead. Nothing here needs the network.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import tempfile
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from route_engine.geo import LatLon

from shaperoute_api.water_extract import OsmData, read_osm_xml

BBox = tuple[float, float, float, float]
Kind = Literal["lift", "piste"]
Tile = tuple[int, int]

# The side of a tile in degrees: about 28 × 20 km in the Alps, a ski area or
# two. A day's box touches one to four.
TILE_DEG = 0.25
FILE_VERSION = 1

# The aerialways that carry skiers up. Not the stations, the pylons, the
# goods lifts and the zip lines.
LIFT_TYPES = frozenset(
    {
        "cable_car",
        "gondola",
        "mixed_lift",
        "chair_lift",
        "drag_lift",
        "t-bar",
        "j-bar",
        "platter",
        "rope_tow",
        "magic_carpet",
    }
)


@dataclass(frozen=True)
class SkiLine:
    """A lift or a downhill piste: its OSM way, its name if it has one, and
    the lift's type or the piste's difficulty ("" when OSM has none).
    A lift is drawn from the bottom up, as OSM asks. A piste mapped as an
    area (`area=yes`) is its outline."""

    id: int
    kind: Kind
    type: str
    name: str | None
    points: tuple[LatLon, ...]
    area: bool = False


def ski_lines(data: OsmData) -> list[SkiLine]:
    """The lifts and downhill pistes of `data`, by way id. A piste without a
    name of its own takes the one of a piste relation it is in (a named run
    made of several ways), and its difficulty too. Ways with fewer than two
    known nodes are left out."""
    from_relations: dict[int, Mapping[str, str]] = {}
    for members, tags in data.relations.values():
        if tags.get("piste:type") != "downhill":
            continue
        for kind, ref, _ in members:
            if kind == "way":
                from_relations.setdefault(ref, tags)

    out: list[SkiLine] = []
    for ident in sorted(data.ways):
        refs, tags = data.ways[ident]
        points = tuple(
            (data.nodes[r][0], data.nodes[r][1]) for r in refs if r in data.nodes
        )
        if len(points) < 2:
            continue
        aerialway = tags.get("aerialway", "")
        if aerialway in LIFT_TYPES:
            out.append(SkiLine(ident, "lift", aerialway, _name(tags), points))
        elif tags.get("piste:type") == "downhill" or ident in from_relations:
            relation = from_relations.get(ident, {})
            name = _piste_name(tags) or _piste_name(relation)
            difficulty = tags.get("piste:difficulty") or relation.get(
                "piste:difficulty", ""
            )
            area = tags.get("area") == "yes" and refs[0] == refs[-1]
            out.append(SkiLine(ident, "piste", difficulty, name, points, area))
    return out


def _name(tags: Mapping[str, str]) -> str | None:
    return tags.get("name") or None


def _piste_name(tags: Mapping[str, str]) -> str | None:
    return tags.get("piste:name") or tags.get("name") or None


def tile_of(point: LatLon) -> Tile:
    return math.floor(point[0] / TILE_DEG), math.floor(point[1] / TILE_DEG)


def tiles_of_box(bbox: BBox) -> list[Tile]:
    """The tiles `bbox` (S, W, N, E) touches, south to north, west to east."""
    south, west, north, east = bbox
    (s, w), (n, e) = tile_of((south, west)), tile_of((north, east))
    return [(i, j) for i in range(s, n + 1) for j in range(w, e + 1)]


def box_of(points: Iterable[LatLon]) -> BBox:
    rows = list(points)
    lats = [p[0] for p in rows]
    lons = [p[1] for p in rows]
    return min(lats), min(lons), max(lats), max(lons)


def tile_path(cache_dir: Path, tile: Tile) -> Path:
    return cache_dir / "ski" / f"{tile[0]}_{tile[1]}.json"


def _row(line: SkiLine) -> dict[str, object]:
    return {
        "id": line.id,
        "kind": line.kind,
        "type": line.type,
        "name": line.name,
        "area": line.area,
        "points": [[round(lat, 6), round(lon, 6)] for lat, lon in line.points],
    }


def _line(row: Mapping[str, object]) -> SkiLine:
    kind = str(row["kind"])
    if kind not in ("lift", "piste"):
        raise ValueError(f"Not a lift or a piste: {kind}")
    points = row["points"]
    assert isinstance(points, list)
    name = row.get("name")
    ident = row["id"]
    assert isinstance(ident, int)
    return SkiLine(
        id=ident,
        kind="lift" if kind == "lift" else "piste",
        type=str(row.get("type", "")),
        name=None if name is None else str(name),
        points=tuple((float(p[0]), float(p[1])) for p in points),
        area=bool(row.get("area", False)),
    )


def read_tile(path: Path) -> list[SkiLine]:
    """The lines of a tile file; none when there is no file (no ski area
    there, or not written yet)."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    if data.get("version") != FILE_VERSION:
        raise ValueError(f"{path}: not a ski file of version {FILE_VERSION}")
    return [_line(row) for row in data["lines"]]


def read_lines(cache_dir: Path, bbox: BBox) -> list[SkiLine]:
    """Every line of the tiles `bbox` touches, each once, by id."""
    lines: dict[int, SkiLine] = {}
    for tile in tiles_of_box(bbox):
        for line in read_tile(tile_path(cache_dir, tile)):
            lines.setdefault(line.id, line)
    return [lines[i] for i in sorted(lines)]


def write_tiles(lines: Sequence[SkiLine], cache_dir: Path) -> dict[Path, int]:
    """Writes `lines` into the tiles their boxes touch, merged with what the
    tiles hold (the same way id written again replaces the old one); returns
    each file written and how many lines it holds."""
    by_tile: dict[Tile, list[SkiLine]] = {}
    for line in lines:
        for tile in tiles_of_box(box_of(line.points)):
            by_tile.setdefault(tile, []).append(line)
    written: dict[Path, int] = {}
    for tile in sorted(by_tile):
        path = tile_path(cache_dir, tile)
        merged = {line.id: line for line in read_tile(path)}
        merged.update((line.id, line) for line in by_tile[tile])
        south, west = tile[0] * TILE_DEG, tile[1] * TILE_DEG
        body = {
            "version": FILE_VERSION,
            "bbox": [south, west, south + TILE_DEG, west + TILE_DEG],
            "lines": [_row(merged[i]) for i in sorted(merged)],
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(body, separators=(",", ":")), encoding="utf-8")
        written[path] = len(merged)
    return written


def osmium_cat_args(pbf: Path, out: Path) -> list[str]:
    """An extract already filtered to the lifts and pistes, as OSM XML."""
    return ["osmium", "cat", "--overwrite", "--output", str(out), str(pbf)]


Run = Callable[[list[str]], None]


def _run(args: list[str]) -> None:
    subprocess.run(args, check=True, capture_output=True)


def main(argv: Sequence[str] | None = None, run: Run = _run) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.ski_extract",
        description="The lifts and pistes of OpenStreetMap extracts (TASK-375).",
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--osm", type=Path, nargs="+", help="OSM XML files")
    source.add_argument(
        "--extract",
        type=Path,
        nargs="+",
        help="extracts filtered to the lifts and pistes",
    )
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    args = parser.parse_args(argv)

    lines: list[SkiLine] = []
    if args.osm is not None:
        for path in args.osm:
            lines += ski_lines(read_osm_xml(path))
    else:
        with tempfile.TemporaryDirectory(prefix="ski-") as folder:
            for index, pbf in enumerate(args.extract):
                cut = Path(folder) / f"ski-{index}.osm"
                run(osmium_cat_args(pbf, cut))
                lines += ski_lines(read_osm_xml(cut))
    try:
        written = write_tiles(lines, args.cache_dir)
    except OSError as exc:
        print(f"Could not write the ski tiles: {exc}", file=sys.stderr)
        return 1
    lifts = len({line.id for line in lines if line.kind == "lift"})
    pistes = len({line.id for line in lines if line.kind == "piste"})
    print(f"Wrote {len(written)} tiles: {lifts} lifts, {pistes} pistes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
