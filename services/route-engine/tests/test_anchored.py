"""A drawing left where it was drawn, traced once (anchored.py, TASK-347
part A, ADR-0300), and its command line. No network: a street grid made
here and the Levico fixture, as the other tests."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import networkx as nx
import numpy as np
import osmnx as ox
import pytest

import route_engine.anchored as cli
from route_engine.anchored import (
    ANCHORED_ON_LAND_ONLY,
    FIT_WITH_ANCHORED_ONLY,
    PLACEMENTS,
    AnchoredPlan,
    check_placement,
    distance_warning,
    main,
    placed_lines,
    plan_anchored,
    read_stroke,
)
from route_engine.errors import ShapeNotDrawableError
from route_engine.geo import LatLon, haversine_m, local_to_latlon, path_length_m
from route_engine.models import InvalidRequestError, RouteRequest
from route_engine.network import BBox, Graph, OsmnxSource, area_around
from route_engine.optimizer import SHAPE_POINTS, Plan, plan_shape
from route_engine.projection import initial_scale, project_shape
from route_engine.shapes import get_shape
from route_engine.words import compose

LEVICO = (46.0122, 11.2986)
FIXTURE = Path(__file__).parent / "fixtures" / "levico_walk_1km.graphml"
SPACING_M = 100.0
CIRCLE = get_shape("circle")(SHAPE_POINTS)
HEART = get_shape("heart")(SHAPE_POINTS)


def _grid(size: int) -> Graph:
    graph: Graph = nx.MultiDiGraph(crs="epsg:4326")
    for i in range(size):
        for j in range(size):
            lat, lon = local_to_latlon(LEVICO, i * SPACING_M, j * SPACING_M)
            graph.add_node((i, j), y=lat, x=lon)
    for i in range(size):
        for j in range(size):
            for di, dj in ((1, 0), (0, 1)):
                a, b = (i, j), (i + di, j + dj)
                if b in graph:
                    graph.add_edge(a, b, length=SPACING_M)
                    graph.add_edge(b, a, length=SPACING_M)
    return graph


class _Grid:
    """A GraphLoader: the grid, whatever the area asked."""

    def __init__(self, size: int = 40) -> None:
        self.graph = _grid(size)
        self.asked: list[BBox] = []

    def load(self, bbox: BBox) -> Graph:
        self.asked.append(bbox)
        return self.graph


START = local_to_latlon(LEVICO, 1500.0, 1500.0)


def test_the_placement_is_free_or_anchored_and_the_magnet_anchored_only() -> None:
    assert PLACEMENTS == ("free", "anchored")
    check_placement("free", None, "running")
    check_placement("anchored", 0.3, "cycling")
    with pytest.raises(InvalidRequestError, match="unknown placement 'glued'"):
        check_placement("glued", None, "running")
    with pytest.raises(InvalidRequestError, match=FIT_WITH_ANCHORED_ONLY):
        check_placement("free", 0.5, "running")
    with pytest.raises(InvalidRequestError, match=ANCHORED_ON_LAND_ONLY):
        check_placement("anchored", None, "paddling")
    with pytest.raises(InvalidRequestError, match="fit must be between 0 and 1"):
        check_placement("anchored", 1.2, "running")


def test_the_drawing_stays_where_it_was_drawn() -> None:
    # The circle's first point on the start, upright, at the scale of the
    # distance: exactly what project_shape gives with no search, and what
    # the result says was placed.
    source = _Grid()
    plan = plan_anchored(CIRCLE, "circle", START, 3000, source, fit=0.5)
    assert isinstance(plan, AnchoredPlan) and isinstance(plan, Plan)
    assert plan.search is None and plan.fit == 0.5
    projected = project_shape(CIRCLE, START, initial_scale(CIRCLE, 3000))
    assert plan.placed == projected
    assert placed_lines(None, plan.placed) == [projected]
    result = plan.result
    assert result.shape == "circle" and result.rotation_deg == 0.0
    assert result.better_distance_m is None
    assert result.points[0] == result.points[-1]
    assert haversine_m(result.points[0], START) < SPACING_M
    assert plan.nodes[0] == plan.nodes[-1]
    assert len(plan.nodes) == len(set(plan.nodes)) + 1
    # The graph asked for is the drawing's own area, not the search's zone.
    south, west, north, east = source.asked[0]
    assert south < START[0] < north and west < START[1] < east


def test_the_distance_is_checked_and_not_corrected() -> None:
    # On a 100 m grid a circle of 3 km comes out longer: the warning says
    # by how much, the route is still given, at the drawing's scale.
    plan = plan_anchored(CIRCLE, "circle", START, 3000, _Grid())
    drawn = plan.result.distance_m
    assert drawn > 3000 * 1.1
    assert [w for w in plan.result.warnings if "not rescaled" in w] == [
        distance_warning(drawn, 3000)
    ]
    assert distance_warning(3250.0, 3000) is None
    assert distance_warning(2600.0, 3000) == (
        "on the roads the drawing is 2.6 km, 13% shorter than the 3 km drawn; "
        "anchored, it is not rescaled"
    )


def test_a_tighter_magnet_keeps_the_route_nearer_the_drawing() -> None:
    source = _Grid()
    loose = plan_anchored(HEART, "heart", START, 5000, source, fit=1.0)
    tight = plan_anchored(HEART, "heart", START, 5000, source, fit=0.0)
    assert loose.placed == tight.placed  # the drawing never moves
    # At fit 0 the zones are a tenth of a cell, so every corner of the
    # drawing is reached from its own nearest node: more of the route lies
    # within a cell of the outline, or as much.
    assert tight.result.similarity >= loose.result.similarity - 1e-9
    assert tight.result.distance_m >= loose.result.distance_m


def test_the_same_tracing_as_plan_shape_without_the_search() -> None:
    # With the default magnet an anchored drawing is plan_shape's own
    # tracing at the initial placement (--no-optimize, TASK-017): the same
    # route, point for point.
    source = _Grid()
    anchored = plan_anchored(HEART, "heart", START, 5000, source)
    before = plan_shape(HEART, "heart", START, 5000, source, optimize=False)
    assert anchored.result.points == before.result.points
    assert anchored.result.similarity == before.result.similarity
    assert anchored.result.on_foot == before.result.on_foot


def test_a_word_with_the_pen_up_is_placed_letter_by_letter() -> None:
    word = compose("IL", pen_up=True)
    plan = plan_anchored(list(word.points), "IL", START, 6000, _Grid(60), word=word)
    lines = placed_lines(word, plan.placed)
    assert len(lines) == 2  # one open line per letter, the gap between left out
    assert all(len(line) >= 2 for line in lines)
    assert sum(len(line) for line in lines) < len(plan.placed)
    assert all(point in plan.placed for line in lines for point in line)
    assert len(plan.result.walks) == 1
    assert plan.result.points[0] != plan.result.points[-1]


def test_anchored_on_the_water_is_refused() -> None:
    with pytest.raises(InvalidRequestError, match=ANCHORED_ON_LAND_ONLY):
        plan_anchored(CIRCLE, "circle", START, 3000, _Grid(), activity="paddling")


def test_a_real_street_fixture_is_traced_where_drawn() -> None:
    source = OsmnxSource(Path("unused"))

    class Levico:
        def load(self, bbox: BBox) -> Graph:
            return ox.load_graphml(FIXTURE)

    plan = plan_anchored(CIRCLE, "circle", LEVICO, 1500, Levico(), fit=0.5)
    assert 0.0 <= plan.result.similarity <= 1.0
    assert plan.result.points[0] == plan.result.points[-1]
    assert haversine_m(plan.placed[0], LEVICO) < 1e-6
    assert path_length_m(plan.placed) == pytest.approx(1500.0, rel=0.01)
    del source


# --- the command line ----------------------------------------------------


@pytest.fixture
def cache(tmp_path: Path) -> Path:
    """A cache with the Levico fixture as the zone of anything near it."""
    source = OsmnxSource(tmp_path)
    shutil.copy(FIXTURE, source.cache_path(area_around([LEVICO], margin_m=20_000.0)))
    return tmp_path


def _stroke_file(tmp_path: Path, points: list[LatLon] | dict[str, object]) -> Path:
    path = tmp_path / "stroke.json"
    path.write_text(json.dumps(points))
    return path


def _along_a_road() -> list[LatLon]:
    """Points along a road of the fixture, 15 m east of it."""
    graph = ox.load_graphml(FIXTURE)
    first = next(iter(graph.nodes))
    lengths = nx.single_source_dijkstra_path_length(graph, first, cutoff=500.0)
    far = max(lengths, key=lengths.get)
    return [
        local_to_latlon((graph.nodes[n]["y"], graph.nodes[n]["x"]), 15.0, 0.0)
        for n in nx.shortest_path(graph, first, far, weight="length")
    ]


def test_the_cli_prints_a_stroke_match_as_json(
    cache: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    line = _along_a_road()
    code = main(
        [
            f"--stroke={_stroke_file(tmp_path, line)}",
            f"--cache-dir={cache}",
            "--fit=0.5",
        ]
    )
    assert code == 0
    out, err = capsys.readouterr()
    assert "Road graph: from the cache" in err
    match = json.loads(out)
    assert set(match) == {"points", "away_m", "off_roads"}
    assert len(match["away_m"]) == len(line)
    assert max(match["away_m"]) <= 15.0 + 0.1
    assert match["off_roads"] is False
    assert len(match["points"]) >= 2


def test_the_cli_takes_the_stroke_as_a_request_too(
    cache: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    line = _along_a_road()
    lat, lon = line[0]
    body = {"activity": "running", "line": [list(p) for p in line[1:]]}
    code = main(
        [
            f"--stroke={_stroke_file(tmp_path, body)}",
            f"--cache-dir={cache}",
            f"--from={lat},{lon}",
        ]
    )
    assert code == 0
    match = json.loads(capsys.readouterr().out)
    assert len(match["away_m"]) == len(line) - 1
    assert haversine_m(tuple(match["points"][0]), line[0]) < 30.0


def test_the_cli_traces_a_shape_where_it_is(
    cache: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    out = tmp_path / "circle.gpx"
    lat, lon = LEVICO
    code = main(
        [
            "--shape=circle",
            "--distance=1500",
            f"--start={lat},{lon}",
            f"--cache-dir={cache}",
            f"--out={out}",
            "--json",
        ]
    )
    assert code == 0
    captured = capsys.readouterr()
    assert "placement:  anchored, magnet 1" in captured.err
    assert out.exists()
    result = json.loads(captured.out)
    assert result["shape"] == "circle"
    assert len(result["placed_outline"]) == 1
    assert result["placed_outline"][0][0] == [lat, lon]
    assert result["points"][0] == result["points"][-1]


@pytest.mark.parametrize(
    ("argv", "message"),
    [
        (["--shape=circle", "--distance=1500"], "required: --distance, --start"),
        (["--shape=circle", "--distance=1500", "--start=46,11", "--fit=2"], "fit must"),
        (
            ["--shape=circle", "--distance=1500", "--start=46,11", "--from=46,11"],
            "--from",
        ),
        (
            [
                "--shape=circle",
                "--distance=1500",
                "--start=46,11",
                "--activity=paddling",
            ],
            "water",
        ),
        (["--shape=house", "--distance=1500", "--start=46,11"], "unknown shape"),
        (["--stroke=nowhere.json", "--distance=5"], "not for --stroke"),
    ],
)
def test_the_cli_refuses_what_it_cannot_do(argv: list[str], message: str) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(argv)
    assert exit_info.value.code == 2
    del message  # argparse prints it on stderr; the exit says it refused


def test_a_stroke_file_is_a_list_of_points(tmp_path: Path) -> None:
    assert read_stroke(_stroke_file(tmp_path, [[46.0, 11.0], [46.1, 11.1]])) == [
        (46.0, 11.0),
        (46.1, 11.1),
    ]
    assert read_stroke(_stroke_file(tmp_path, {"line": [[46.0, 11.0], [46.1, 11.1]]}))
    with pytest.raises(InvalidRequestError, match="at least 2 points"):
        read_stroke(_stroke_file(tmp_path, [[46.0, 11.0]]))
    with pytest.raises(InvalidRequestError, match="not a \\[lat, lon\\] point"):
        read_stroke(_stroke_file(tmp_path, [[46.0, 11.0], [46.1]]))
    with pytest.raises(InvalidRequestError, match="latitude"):
        read_stroke(_stroke_file(tmp_path, [[96.0, 11.0], [46.1, 11.1]]))
    with pytest.raises(InvalidRequestError, match="cannot read"):
        read_stroke(tmp_path / "missing.json")


def test_a_shape_on_a_single_node_is_no_route(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    # A zone whose only roads are far from the start: the circle collapses.
    source = OsmnxSource(tmp_path)
    shutil.copy(FIXTURE, source.cache_path(area_around([LEVICO], margin_m=30_000.0)))
    lat, lon = local_to_latlon(LEVICO, 12_000.0, 9_000.0)
    code = main(
        [
            "--shape=circle",
            "--distance=1000",
            f"--start={lat},{lon}",
            f"--cache-dir={tmp_path}",
        ]
    )
    assert code == 1
    assert "No route:" in capsys.readouterr().err


def test_a_request_of_the_engine_knows_nothing_of_the_placement() -> None:
    # The engine's own request has no placement: the API's has (TASK-347,
    # the fingerprint of the engine unchanged, route_store.ANCHORED_ONLY).
    with pytest.raises(TypeError):
        RouteRequest(start=START, shape="heart", distance_m=5000, placement="anchored")  # type: ignore[call-arg]
    with pytest.raises(ShapeNotDrawableError):
        plan_anchored(CIRCLE, "circle", START, 1000, _Grid(2))
    assert np is not None and cli.main is main
