"""The lifts and pistes of an OpenStreetMap extract (TASK-375 part D): what
is kept of a made-up ski area, and the tiles it is written into.

No network, no osmium: the extract is the hand-written OSM XML of
fixtures/ski/area.osm.xml (not `.osm`, which git leaves out).
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from shaperoute_api.ski_extract import (
    FILE_VERSION,
    SkiLine,
    main,
    osmium_cat_args,
    read_lines,
    read_tile,
    ski_lines,
    tile_path,
    tiles_of_box,
    write_tiles,
)
from shaperoute_api.water_extract import read_osm_xml

AREA = Path(__file__).parent / "fixtures/ski/area.osm.xml"
# The made-up area, a little around it.
AREA_BOX = (46.54, 11.74, 46.56, 11.77)


def lines_of_area() -> list[SkiLine]:
    return ski_lines(read_osm_xml(AREA))


def test_keeps_the_lifts_and_the_downhill_pistes():
    lines = {line.id: line for line in lines_of_area()}
    assert sorted(lines) == [100, 101, 200, 201, 202, 203]
    assert lines[100].kind == "lift"
    assert lines[100].type == "chair_lift"
    assert lines[100].name == "Seggiovia Col Raiser"
    assert lines[100].points == ((46.55, 11.75), (46.559, 11.75))
    # A lift without a name keeps its type.
    assert (lines[101].type, lines[101].name) == ("drag_lift", None)
    assert lines[200].kind == "piste"
    assert (lines[200].name, lines[200].type) == ("Pista Rossa", "intermediate")
    assert len(lines[200].points) == 4


def test_a_piste_takes_the_name_of_its_relation():
    lines = {line.id: line for line in lines_of_area()}
    # 201 has no tags at all, 202 only piste:type: both are the Gran Risa.
    for ident in (201, 202):
        assert lines[ident].kind == "piste"
        assert (lines[ident].name, lines[ident].type) == ("Gran Risa", "advanced")


def test_a_piste_mapped_as_an_area_is_its_outline():
    lines = {line.id: line for line in lines_of_area()}
    assert lines[203].area is True
    assert lines[203].points[0] == lines[203].points[-1]
    assert (lines[203].name, lines[203].type) == ("Campo scuola", "novice")
    assert lines[200].area is False


def test_leaves_out_stations_zip_lines_nordic_pistes_and_broken_ways():
    kept = {line.id for line in lines_of_area()}
    # The station (102), the zip line (103), the nordic ring (204), and a
    # piste whose nodes are not in the extract (205).
    assert kept.isdisjoint({102, 103, 204, 205})


def test_a_line_goes_in_every_tile_its_box_touches(tmp_path: Path):
    written = write_tiles(lines_of_area(), tmp_path)
    # The Pista Rossa goes west of 11.75°, into the next tile.
    west, east = tile_path(tmp_path, (186, 46)), tile_path(tmp_path, (186, 47))
    assert set(written) == {west, east}
    assert [line.id for line in read_tile(west)] == [200]
    assert [line.id for line in read_tile(east)] == [100, 101, 200, 201, 202, 203]
    body = json.loads(east.read_text(encoding="utf-8"))
    assert body["version"] == FILE_VERSION
    assert body["bbox"] == [46.5, 11.75, 46.75, 12.0]


def test_the_lines_of_a_box_come_once(tmp_path: Path):
    write_tiles(lines_of_area(), tmp_path)
    lines = read_lines(tmp_path, AREA_BOX)
    assert [line.id for line in lines] == [100, 101, 200, 201, 202, 203]
    assert lines == sorted(lines_of_area(), key=lambda line: line.id)


def test_a_second_extract_merges_and_a_border_lift_is_kept_once(tmp_path: Path):
    write_tiles(lines_of_area(), tmp_path)
    renamed = SkiLine(
        100, "lift", "chair_lift", "Col Raiser", ((46.55, 11.75), (46.559, 11.75))
    )
    other = SkiLine(
        400, "lift", "gondola", "Ciampinoi", ((46.552, 11.76), (46.558, 11.77))
    )
    write_tiles([renamed, other], tmp_path)
    lines = {line.id: line for line in read_lines(tmp_path, AREA_BOX)}
    assert sorted(lines) == [100, 101, 200, 201, 202, 203, 400]
    assert lines[100].name == "Col Raiser"


def test_no_file_is_no_ski_area_and_another_version_is_refused(tmp_path: Path):
    assert read_tile(tile_path(tmp_path, (1, 2))) == []
    assert read_lines(tmp_path, AREA_BOX) == []
    path = tile_path(tmp_path, (186, 47))
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"version": 99, "lines": []}), encoding="utf-8")
    with pytest.raises(ValueError):
        read_tile(path)


def test_the_tiles_of_a_box():
    assert tiles_of_box((46.55, 11.74, 46.56, 11.76)) == [(186, 46), (186, 47)]
    assert tiles_of_box((46.49, 11.8, 46.51, 11.8)) == [(185, 47), (186, 47)]


def test_the_command_reads_osm_files(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
):
    assert main(["--osm", str(AREA), "--cache-dir", str(tmp_path)]) == 0
    assert "Wrote 2 tiles: 2 lifts, 4 pistes" in capsys.readouterr().out
    assert len(read_lines(tmp_path, AREA_BOX)) == 6


def test_the_command_reads_extracts_with_osmium(tmp_path: Path):
    asked: list[list[str]] = []

    def run(args: list[str]) -> None:
        asked.append(args)
        shutil.copy(AREA, args[4])

    extracts = [tmp_path / "italy-ski.osm.pbf", tmp_path / "austria-ski.osm.pbf"]
    cache = tmp_path / "cache"
    assert main(["--extract", *map(str, extracts), "--cache-dir", str(cache)], run) == 0
    assert [args[-1] for args in asked] == [str(path) for path in extracts]
    assert asked[0] == osmium_cat_args(extracts[0], Path(asked[0][4]))
    assert asked[0][:4] == ["osmium", "cat", "--overwrite", "--output"]
    # The same area in both: each line once.
    assert len(read_lines(cache, AREA_BOX)) == 6
