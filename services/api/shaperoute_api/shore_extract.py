"""The places with a name along the shore, from an OpenStreetMap extract
(TASK-323 part B, ADR-0283).

The turns of a swim are named after the place with a name nearest each,
within 300 m (route_engine/shore_names.py): a beach resort, a pier, a
lighthouse, a hotel, a church, a bar on the beach. The engine reads them
from files of the cache, `<cache>/shore_names/`; this command writes one
for a box, as water_extract.py writes the water: from an extract, never
from Overpass, which refuses the server (ADR-0154). A place is kept when it
has a name, is one of KINDS, and lies within SHORE_REACH_M of the sea or of
a lake (the coastline, or the edge of `natural=water`).

    python -m shaperoute_api.shore_extract --osm cut.osm --bbox S,W,N,E \
        --cache-dir data/cache

`--extract places.osm.pbf` cuts the box itself with osmium, from an extract
filtered to the shore and the places, e.g.

    osmium tags-filter italy.osm.pbf nwr/natural=coastline,water \
        nwr/leisure=beach_resort,marina nwr/man_made=pier,lighthouse \
        nwr/tourism=hotel,camp_site,attraction nwr/historic \
        nwr/amenity=bar,cafe,restaurant,ice_cream,place_of_worship \
        -o places.osm.pbf

Nothing here needs the network.
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from route_engine.geo import latlon_to_local_array
from route_engine.shore_names import FOLDER, LANDMARK_REACH_M
from route_engine.water import BBox

from shaperoute_api.water_extract import (
    OsmData,
    Run,
    _bbox,
    _run,
    osmium_extract_args,
    read_osm_xml,
)

Tags = dict[str, str]

# A place this far from the shore is still in front of a turn: the band of
# a swim is within 150 m of it, and a turn takes a place within
# LANDMARK_REACH_M (300 m).
SHORE_REACH_M = LANDMARK_REACH_M
# What a place is, in this order of the keys (the first that matches names
# its kind): seen from the water, a pier or a lighthouse before the bar on it.
KINDS: dict[str, frozenset[str] | None] = {
    "man_made": frozenset({"pier", "lighthouse"}),
    "leisure": frozenset({"beach_resort", "marina"}),
    "tourism": frozenset({"hotel", "camp_site", "attraction"}),
    "amenity": frozenset(
        {"bar", "cafe", "restaurant", "ice_cream", "place_of_worship"}
    ),
    # Any historic place: a tower, a castle, a fort on the shore.
    "historic": None,
}


def kind_of(tags: Tags) -> str | None:
    """What a place with these tags is, by KINDS, or None: not a place to
    turn opposite, or without a name."""
    if not tags.get("name", "").strip():
        return None
    for key, values in KINDS.items():
        value = tags.get(key)
        if value and (values is None or value in values):
            return value if values is not None else f"historic_{value}"
    return None


def _shore(data: OsmData) -> list[list[tuple[float, float]]]:
    """The lines of the shore, as (lat, lon): the coastline, the edges of
    the water, and the member ways of the water's relations."""
    wanted: set[int] = set()
    for ident, (_, tags) in data.ways.items():
        if tags.get("natural") in ("coastline", "water"):
            wanted.add(ident)
    for members, tags in data.relations.values():
        if tags.get("natural") == "water":
            wanted.update(ref for kind, ref, _ in members if kind == "way")
    lines = []
    for ident in sorted(wanted):
        refs = data.ways.get(ident, ([], {}))[0]
        points = [data.nodes[r][:2] for r in refs if r in data.nodes]
        if len(points) >= 2:
            lines.append(points)
    return lines


def _where(data: OsmData, kind: str, ident: int) -> tuple[float, float] | None:
    """A place's position: a node's, or the mean of a way's nodes."""
    if kind == "node":
        lat, lon, _ = data.nodes[ident]
        return lat, lon
    refs = data.ways[ident][0]
    points = [data.nodes[r][:2] for r in refs if r in data.nodes]
    if not points:
        return None
    return (
        sum(p[0] for p in points) / len(points),
        sum(p[1] for p in points) / len(points),
    )


def shore_places(data: OsmData, bbox: BBox) -> list[dict[str, Any]]:
    """The places with a name of KINDS inside `bbox` and within
    SHORE_REACH_M of the shore, in order of name, then position: rows of a
    file of `<cache>/shore_names/`."""
    south, west, north, east = bbox
    origin = ((south + north) / 2, (west + east) / 2)
    lines = [
        shapely.linestrings(latlon_to_local_array(origin, np.asarray(line)))
        for line in _shore(data)
    ]
    if not lines:
        return []
    tree = shapely.STRtree(lines)
    candidates: list[tuple[str, str, tuple[float, float]]] = []
    for kind, table in (("node", data.nodes), ("way", data.ways)):
        for ident, row in table.items():
            what = kind_of(row[-1])
            if what is None:
                continue
            point = _where(data, kind, ident)
            if point is None or not (
                south <= point[0] <= north and west <= point[1] <= east
            ):
                continue
            candidates.append((row[-1]["name"].strip(), what, point))
    if not candidates:
        return []
    xy = latlon_to_local_array(origin, np.asarray([c[2] for c in candidates]))
    near = tree.query(shapely.points(xy), predicate="dwithin", distance=SHORE_REACH_M)
    kept = sorted({int(i) for i in near[0]})
    rows = [
        {
            "name": candidates[i][0],
            "kind": candidates[i][1],
            "lat": round(candidates[i][2][0], 7),
            "lon": round(candidates[i][2][1], 7),
        }
        for i in kept
    ]
    return sorted(rows, key=lambda r: (r["name"], r["lat"], r["lon"]))


def path_for(cache_dir: Path, bbox: BBox) -> Path:
    south, west, north, east = bbox
    name = f"shore_{south:.5f}_{west:.5f}_{north:.5f}_{east:.5f}.json"
    return cache_dir / FOLDER / name


def write_from(data: OsmData, bbox: BBox, cache_dir: Path) -> tuple[Path, int]:
    """The file of the places along the shore of `bbox`, written whole or
    not at all; returns it and how many places it holds."""
    places = shore_places(data, bbox)
    path = path_for(cache_dir, bbox)
    path.parent.mkdir(parents=True, exist_ok=True)
    draft = path.with_name(f".{path.name}.part")
    text = json.dumps({"bbox": list(bbox), "places": places}, ensure_ascii=False)
    draft.write_text(text, encoding="utf-8")
    draft.replace(path)
    return path, len(places)


def main(argv: Sequence[str] | None = None, run: Run = _run) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.shore_extract",
        description=(
            "The places with a name along the shore of a box, from an "
            "OpenStreetMap extract (TASK-323)."
        ),
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--osm", type=Path, help="an OSM XML file holding the box")
    source.add_argument(
        "--extract", type=Path, help="an extract filtered to the shore and places"
    )
    parser.add_argument("--bbox", type=_bbox, required=True, help="S,W,N,E")
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    args = parser.parse_args(argv)

    if args.osm is not None:
        data = read_osm_xml(args.osm)
    else:
        with tempfile.TemporaryDirectory(prefix="shore-") as folder:
            cut = Path(folder) / "shore.osm"
            run(osmium_extract_args(args.extract, args.bbox, cut))
            data = read_osm_xml(cut)
    try:
        path, count = write_from(data, args.bbox, args.cache_dir)
    except OSError as exc:
        print(f"Could not write the places: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote {path}: {count} places along the shore")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
