"""The places with a name along the shore from an extract (TASK-323 part B):
named places of the kinds kept, within 300 m of the coastline or of a lake,
inside the box, written as a file of `<cache>/shore_names/` that the
engine reads (route_engine/shore_names.py). No network, no osmium: an OSM
XML file written here, and osmium's command only built.
"""

from __future__ import annotations

import json
from pathlib import Path

from route_engine.geo import local_to_latlon
from route_engine.shore_names import FolderShoreNames

from shaperoute_api.shore_extract import kind_of, main, path_for, shore_places
from shaperoute_api.water_extract import read_osm_xml

ORIGIN = (44.0, 12.65)
BBOX = (43.98, 12.62, 44.02, 12.68)


def _node(ident: int, x: float, y: float, **tags: str) -> str:
    lat, lon = local_to_latlon(ORIGIN, x, y)
    inner = "".join(f'<tag k="{k}" v="{v}"/>' for k, v in tags.items())
    return f'<node id="{ident}" lat="{lat:.7f}" lon="{lon:.7f}">{inner}</node>'


def _osm(path: Path) -> Path:
    """A coastline along y = 0 from x = -2000 to 2000, a lake's edge
    around (0, 1500), and places near and far."""
    coast = [_node(1 + i, -2000 + 1000 * i, 0) for i in range(5)]
    lake = [
        _node(10 + i, x, y)
        for i, (x, y) in enumerate(
            [(-100, 1400), (100, 1400), (100, 1600), (-100, 1600), (-100, 1400)]
        )
    ]
    places = [
        _node(100, 0, 50, name="Bagno 54", leisure="beach_resort"),
        _node(101, 500, 250, name="Hotel Miramare", tourism="hotel"),
        _node(102, 800, 900, name="Bar lontano", amenity="bar"),
        _node(103, 300, 30, amenity="bar"),  # no name
        _node(104, 200, 20, name="Farmacia", amenity="pharmacy"),  # not a kind kept
        _node(105, 0, 1700, name="Chiesa sul lago", amenity="place_of_worship"),
        _node(106, 300, 10, name="Molo", man_made="pier", amenity="bar"),
        _node(107, 9000, 10, name="Fuori dal riquadro", tourism="hotel"),
    ]
    pier = [_node(200, 1000, 5), _node(201, 1000, -80), _node(202, 1040, -80)]
    ways = (
        '<way id="300">'
        + "".join(f'<nd ref="{1 + i}"/>' for i in range(5))
        + '<tag k="natural" v="coastline"/></way>'
        '<way id="301">'
        + "".join(f'<nd ref="{10 + i}"/>' for i in (0, 1, 2, 3, 0))
        + '<tag k="natural" v="water"/></way>'
        '<way id="302"><nd ref="200"/><nd ref="201"/><nd ref="202"/>'
        '<tag k="man_made" v="pier"/><tag k="name" v="Pontile Nord"/></way>'
    )
    body = "".join(coast + lake[:4] + places + pier)
    path.write_text(
        f'<?xml version="1.0"?><osm version="0.6">{body}{ways}</osm>', encoding="utf-8"
    )
    return path


def test_a_place_needs_a_name_and_a_kind_kept() -> None:
    assert kind_of({"name": "Bagno 54", "leisure": "beach_resort"}) == "beach_resort"
    assert kind_of({"leisure": "beach_resort"}) is None
    assert kind_of({"name": "Farmacia", "amenity": "pharmacy"}) is None
    # Seen from the water the pier comes before the bar on it.
    assert kind_of({"name": "Molo", "man_made": "pier", "amenity": "bar"}) == "pier"
    assert kind_of({"name": "Torre", "historic": "tower"}) == "historic_tower"


def test_the_places_within_300_m_of_the_shore_are_kept(tmp_path: Path) -> None:
    data = read_osm_xml(_osm(tmp_path / "cut.osm"))
    rows = shore_places(data, BBOX)
    assert [(r["name"], r["kind"]) for r in rows] == [
        ("Bagno 54", "beach_resort"),
        ("Chiesa sul lago", "place_of_worship"),
        ("Hotel Miramare", "hotel"),
        ("Molo", "pier"),
        ("Pontile Nord", "pier"),
    ]


def test_the_file_is_read_by_the_engine(tmp_path: Path, capsys) -> None:  # type: ignore[no-untyped-def]
    osm = _osm(tmp_path / "cut.osm")
    cache = tmp_path / "cache"
    bbox = ",".join(str(v) for v in BBOX)
    assert main(["--osm", str(osm), "--bbox", bbox, "--cache-dir", str(cache)]) == 0
    assert "5 places along the shore" in capsys.readouterr().out
    written = json.loads(path_for(cache, BBOX).read_text(encoding="utf-8"))
    assert written["bbox"] == list(BBOX) and len(written["places"]) == 5
    names = {p.name for p in FolderShoreNames(cache).places(BBOX)}
    assert names == {
        "Bagno 54",
        "Chiesa sul lago",
        "Hotel Miramare",
        "Molo",
        "Pontile Nord",
    }


def test_from_an_extract_osmium_cuts_the_box(tmp_path: Path) -> None:
    asked: list[list[str]] = []
    osm = _osm(tmp_path / "source.osm")

    def run(args: list[str]) -> None:
        asked.append(args)
        Path(args[args.index("--output") + 1]).write_text(osm.read_text())

    bbox = ",".join(str(v) for v in BBOX)
    argv = ["--extract", "places.osm.pbf", "--bbox", bbox, "--cache-dir", str(tmp_path)]
    assert main(argv, run=run) == 0
    assert asked and asked[0][:2] == ["osmium", "extract"]
    assert path_for(tmp_path, BBOX).exists()
