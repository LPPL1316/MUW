"""Words written with the pen up (TASK-197, ADR-0157): each letter on its
own, walks between them, and every word without the pen up as before."""

import hashlib
import math
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

import networkx as nx
import numpy as np
import pytest

import route_engine.__main__ as cli
from route_engine.__main__ import main, parse_request
from route_engine.export_gpx import GPX_NAMESPACE, PAUSE, RESUME, to_gpx
from route_engine.geo import LatLon, haversine_m, local_to_latlon, path_length_m
from route_engine.models import (
    PEN_UP_WITHOUT_WORD,
    InvalidRequestError,
    RouteRequest,
    RouteResult,
)
from route_engine.nearby_starts import ShapeJob, plan_nearby, with_approach
from route_engine.network import (
    FileSource,
    Graph,
    NetworkRoute,
    nearest_nodes,
    snap_to_network,
)
from route_engine.optimizer import (
    DISTANCE_TOLERANCE,
    LETTER_BAND,
    WORD_TOLERANCE,
    RoadMask,
    fit_letters,
    plan_route,
    plan_shape,
)
from route_engine.pen_up import (
    drawn_m,
    drawn_pieces,
    letter_lines,
    place_line,
    similarity,
    trace,
    walks_problem,
)
from route_engine.track_score import TrackPoint, score_track
from route_engine.words import STYLES, Place, Style, compose

TRENTO = (46.0671, 11.1214)
LEVICO = (46.0122, 11.2986)
FIXTURE = Path(__file__).parent / "fixtures" / "levico_walk_1km.graphml"


def _grid(origin: LatLon, spacing_m: float, half_m: float) -> nx.MultiDiGraph:
    """Streets every `spacing_m` around `origin`, both directions."""
    graph = nx.MultiDiGraph()
    n = int(half_m / spacing_m)
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            lat, lon = local_to_latlon(origin, i * spacing_m, j * spacing_m)
            graph.add_node((i, j), y=lat, x=lon)
    for i, j in list(graph.nodes):
        for b in ((i + 1, j), (i, j + 1)):
            if b in graph:
                graph.add_edge((i, j), b, length=spacing_m)
                graph.add_edge(b, (i, j), length=spacing_m)
    return graph


class _Source:
    """The same graph for any area: the grid of test_words, a little wider
    for the taller letters of a word with the pen up."""

    def __init__(self, graph: Graph | None = None) -> None:
        self.graph = graph if graph is not None else _grid(TRENTO, 100.0, 4000.0)

    def is_cached(self, bbox: tuple[float, float, float, float]) -> bool:
        return True

    def load(self, bbox: tuple[float, float, float, float]) -> Graph:
        return self.graph


def _node_at(graph: Graph, point: LatLon) -> object:
    [node], [away] = nearest_nodes(graph, [point])
    assert away < 0.01
    return node


# --- The word: each letter's `out`, the gaps on the base line ---


def _length(line: list[tuple[float, float]] | tuple[tuple[float, float], ...]) -> float:
    return sum(math.dist(a, b) for a, b in zip(line, line[1:], strict=False))


@pytest.mark.parametrize("style", sorted(STYLES))
def test_a_word_with_the_pen_up_is_each_letter_once_left_to_right(
    style: Style,
) -> None:
    word = compose("ciao", style=style, pen_up=True)
    assert word.pen_up and not compose("ciao", style=style).pen_up
    assert word.starts == (0,) and word.phases == (0.0,)
    assert not any(word.tops)
    # Each letter is its `out`, once, where the closed word puts it: the
    # gap of the style between two letters.
    alphabet, gap = STYLES[style]
    x = 0.0
    for k, letter in enumerate(word.letters):
        assert letter == alphabet[letter.char]
        drawn = [
            p
            for p, place in zip(word.units, word.places, strict=True)
            if place == Place(k)
        ]
        dx = x - letter.left
        assert drawn[0] == pytest.approx((letter.out[0][0] + dx, 0.0))
        assert drawn[-1] == pytest.approx((letter.out[-1][0] + dx, 0.0))
        assert _length(drawn) == pytest.approx(_length(letter.out))
        x += letter.right - letter.left + gap
    # Open: from the entry of the first letter to the exit of the last,
    # the gaps along the base line in between.
    assert word.units[0] != word.units[-1]
    for unit, place in zip(word.units, word.places, strict=True):
        if place.along is not None:
            assert unit[1] == 0.0
    letters = sum(_length(letter.out) for letter in word.letters)
    assert word.drawn_length / word.height == pytest.approx(letters)


def test_the_first_letter_holds_the_start_and_the_others_move() -> None:
    word = compose("iio", pen_up=True)
    points, _ = word.line(0)
    shifts = np.array([[0.25, 0.0], [0.125, 0.0625], [-0.125, 0.0]])
    moved = (np.array(word.moved(0, shifts)) - points) / word.height
    for place, move in zip(word.places, moved, strict=True):
        if place.along is None and place.index == 0:
            assert np.allclose(move, 0.0)
        elif place.along is None:
            assert np.allclose(move, shifts[place.index])
    assert np.allclose(moved[0], 0.0)


def test_the_first_letter_stays_even_beside_a_road() -> None:
    # «II» with the pen up, 1 km high, a road 180 m east of each I: the
    # second I moves onto its road, the first stays where the route starts.
    word = compose("II", pen_up=True)
    scale = 1000.0 / word.height
    graph = nx.MultiDiGraph()
    for x_m, name in ((180.0, "a"), (780.0, "b")):
        for j in range(41):
            lat, lon = local_to_latlon(LEVICO, x_m, -500.0 + 50.0 * j)
            graph.add_node((name, j), y=lat, x=lon)
            if j:
                graph.add_edge((name, j - 1), (name, j), length=50.0)
                graph.add_edge((name, j), (name, j - 1), length=50.0)
    mask = RoadMask(graph, LEVICO)
    band = LETTER_BAND * 1000.0
    _, shifts = fit_letters(word, 0, 0.0, scale, np.zeros(2), mask, band)
    assert tuple(shifts[0]) == (0.0, 0.0)
    assert shifts[1][0] > 0.0


def test_a_request_with_the_pen_up_needs_a_word() -> None:
    word = RouteRequest(start=TRENTO, distance_m=6000, word="io", pen_up=True)
    assert word.pen_up
    assert not RouteRequest(start=TRENTO, distance_m=6000, word="io").pen_up
    with pytest.raises(InvalidRequestError, match=PEN_UP_WITHOUT_WORD):
        RouteRequest(start=TRENTO, distance_m=6000, shape="heart", pen_up=True)
    assert PEN_UP_WITHOUT_WORD == "pen_up is for the letters of a word"


# --- Without the pen up, every word as before ---

# Routes of main at 59dd8a7, before TASK-197: `_digest` of the result.
BEFORE = {
    "grid io 6000": "752db4f68f1a45d8",
    "grid ciao block 12000": "fd96bddd213a8e83",
    # Tilted since TASK-232 (ADR-0195): -30°, and the LO tried tilted.
    "levico IO 2500": "3336c17f3b851d4b",
    "levico LO 3000": "832c26d07d47df65",
    "levico nearby io 6000": "c7560d2d0ad932f2",
}


def _digest(result: RouteResult) -> str:
    text = repr(
        (
            [(round(a, 9), round(b, 9)) for a, b in result.points],
            round(result.distance_m, 6),
            round(result.similarity, 9),
            result.warnings,
        )
    )
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def _before(case: str) -> RouteResult:
    grid = _Source(_grid(TRENTO, 100.0, 3000.0))
    if case == "grid io 6000":
        request = RouteRequest(start=TRENTO, distance_m=6000, word="io")
        return plan_route(request, grid).result
    if case == "grid ciao block 12000":
        request = RouteRequest(
            start=TRENTO, distance_m=12000, word="ciao", style="block"
        )
        return plan_route(request, grid).result
    if case == "levico nearby io 6000":
        request = RouteRequest(start=LEVICO, distance_m=6000, word="io")
        job = ShapeJob.of_request(request)
        return plan_nearby(
            job, LEVICO, FileSource(FIXTURE), processes=False
        ).plan.result
    text, distance = case.split()[1], int(case.split()[2])
    word = compose(text)
    plan = plan_shape(
        list(word.points), word.text, LEVICO, distance, FileSource(FIXTURE), word=word
    )
    return plan.result


@pytest.mark.parametrize("case", sorted(BEFORE))
def test_a_word_without_the_pen_up_is_the_route_of_before(case: str) -> None:
    result = _before(case)
    assert _digest(result) == BEFORE[case]
    assert result.walks == []


# --- The route: letters traced on their own, walks between them ---


def _pen_up_plan(text: str = "ciao", distance_m: int = 12000, style: Style = "round"):
    source = _Source()
    request = RouteRequest(
        start=TRENTO, distance_m=distance_m, word=text, style=style, pen_up=True
    )
    return plan_route(request, source), source.graph


@pytest.mark.parametrize("style", sorted(STYLES))
def test_a_word_with_the_pen_up_walks_from_each_letter_to_the_next(
    style: Style,
) -> None:
    plan, graph = _pen_up_plan(style=style)
    result = plan.result
    assert plan.search is not None
    word = compose("ciao", style=style, pen_up=True)
    # n letters, n - 1 walks, within the points, in order, apart.
    assert len(result.walks) == len(word.letters) - 1
    assert walks_problem(result.walks, len(result.points)) is None
    assert all(a < b for a, b in result.walks)
    # The route begins at the start and ends on the last letter: open.
    assert result.points[0] != result.points[-1]
    # Each walk is the shortest way along the roads, and where it ends the
    # next letter begins: at the road node nearest to its entry.
    entries = [letter[0] for letter in letter_lines(word, plan.search.best.shape)]
    for k, (a, b) in enumerate(result.walks, start=1):
        shortest = nx.shortest_path_length(
            graph,
            _node_at(graph, result.points[a]),
            _node_at(graph, result.points[b]),
            weight="length",
        )
        assert path_length_m(result.points[a : b + 1]) == pytest.approx(shortest)
        [entry], _ = nearest_nodes(graph, [entries[k]])
        assert _node_at(graph, result.points[b]) == entry
    # The distance asked for is the letters'; distance_m is all the points.
    drawn = drawn_m(result.points, result.distance_m, result.walks)
    assert abs(drawn / 12000 - 1) <= DISTANCE_TOLERANCE
    assert result.distance_m == pytest.approx(path_length_m(result.points))
    assert result.distance_m > drawn
    assert result.word == "CIAO" and result.shape is None


def test_the_letters_alone_make_the_similarity() -> None:
    plan, _ = _pen_up_plan()
    result = plan.result
    assert plan.search is not None
    best = plan.search.best
    word = compose("ciao", pen_up=True)
    tolerance = WORD_TOLERANCE * best.scale_m * word.height
    sim = similarity(word, result.points, result.walks, best.shape, tolerance)
    assert sim == pytest.approx(result.similarity)
    # A walk twice as long, 1.5 km away and back: the same similarity.
    a, b = result.walks[0]
    far = local_to_latlon(result.points[a], 0.0, -1500.0)
    detour = [far, result.points[a]]
    points = [*result.points[: a + 1], *detour, *result.points[a + 1 :]]
    walks = [(a, b + 2), *((s + 2, e + 2) for s, e in result.walks[1:])]
    assert walks_problem(walks, len(points)) is None
    longer = similarity(word, points, walks, best.shape, tolerance)
    assert longer == sim
    assert drawn_m(points, path_length_m(points), walks) == pytest.approx(
        drawn_m(result.points, result.distance_m, result.walks)
    )
    # Counted as drawn, the detour would cost precision.
    assert similarity(word, points, [], best.shape, tolerance) < sim


def test_drawn_pieces_and_drawn_metres_leave_the_walks_out() -> None:
    line = [local_to_latlon(TRENTO, 100.0 * i, 0.0) for i in range(7)]
    walks = [(1, 3), (3, 4)]
    assert drawn_pieces(line, walks) == [line[:2], line[3:4], line[4:]]
    total = path_length_m(line)
    assert drawn_m(line, total, walks) == pytest.approx(total - 300.0)
    assert drawn_m(line, total, []) == total


@pytest.mark.parametrize(
    ("walks", "problem"),
    [
        ([(2, 1)], "is not a stretch"),
        ([(0, 7)], "is not a stretch"),
        ([(-1, 2)], "is not a stretch"),
        ([(2, 4), (3, 5)], "starts before"),
    ],
)
def test_walks_that_are_not_stretches_of_the_route_are_named(
    walks: list[tuple[int, int]], problem: str
) -> None:
    message = walks_problem(walks, 7)
    assert message is not None and problem in message
    assert walks_problem([(1, 2), (2, 2), (4, 6)], 7) is None


def test_an_open_line_is_traced_without_coming_back() -> None:
    graph = _grid(TRENTO, 50.0, 1500.0)
    line = [local_to_latlon(TRENTO, 0.0, 50.0 * j) for j in range(21)]
    route = snap_to_network(graph, line, closed=False)
    assert route.points[0] == line[0]
    assert haversine_m(route.points[-1], line[-1]) < 1.0
    assert route.distance_m == pytest.approx(1000.0)
    closed = snap_to_network(graph, line)
    assert closed.points[-1] == closed.points[0]


def test_a_word_with_the_pen_up_traced_once_is_open_too() -> None:
    request = RouteRequest(start=TRENTO, distance_m=6000, word="io", pen_up=True)
    result = plan_route(request, _Source(), optimize=False).result
    assert len(result.walks) == 1
    assert result.points[0] != result.points[-1]
    assert 0.0 < result.similarity <= 1.0


def test_the_nearby_starts_plan_a_word_with_the_pen_up() -> None:
    request = RouteRequest(start=TRENTO, distance_m=6000, word="io", pen_up=True)
    source = _Source()
    nearby = plan_nearby(
        ShapeJob.of_request(request), TRENTO, source, count=2, processes=False
    )
    for plan in [nearby.plan, *nearby.plan.alternatives]:
        result = plan.result
        assert len(result.walks) == 1
        assert walks_problem(result.walks, len(result.points)) is None
        assert result.word == "IO"


def test_the_approach_of_a_nearby_start_moves_the_walks_along() -> None:
    graph = _grid(TRENTO, 100.0, 4000.0)
    word = compose("io", pen_up=True)
    job = ShapeJob(tuple(word.points), word.text, 6000, word=word, word_result=True)
    nearby = local_to_latlon(TRENTO, 200.0, 0.0)
    plan = job.here(nearby, _Source(graph))
    start, there = _node_at(graph, TRENTO), _node_at(graph, plan.result.points[0])
    approach = nx.shortest_path(graph, start, there, weight="length")
    assert len(approach) == 3
    reached = with_approach(graph, plan, approach)
    assert reached.result.walks == [(a + 2, b + 2) for a, b in plan.result.walks]
    assert reached.search is not None
    assert reached.search.best.route.walks == reached.result.walks
    for (a, b), (c, d) in zip(plan.result.walks, reached.result.walks, strict=True):
        assert reached.result.points[c] == plan.result.points[a]
        assert reached.result.points[d] == plan.result.points[b]
    # Open: no way back to the start after the last letter.
    assert reached.result.points[-1] == plan.result.points[-1]


# --- The run, the GPX and the CLI ---


def _two_letters() -> tuple[list[LatLon], list[tuple[int, int]]]:
    """Two I's 300 m apart, each up 1 km and down, and a walk between them
    that goes round 200 m below the base line."""
    xy = [(0, 0), (0, 1000), (0, 0), (0, -200), (300, -200), (300, 0)]
    xy += [(300, 1000), (300, 0)]
    return [local_to_latlon(TRENTO, x, y) for x, y in xy], [(2, 5)]


def _run(xy: list[tuple[float, float]]) -> list[TrackPoint]:
    """Fixes every 20 m along `xy`, 4 s apart, as one track."""
    points: list[LatLon] = []
    for (x0, y0), (x1, y1) in zip(xy, xy[1:], strict=False):
        n = max(1, round(math.dist((x0, y0), (x1, y1)) / 20.0))
        points.extend(
            local_to_latlon(TRENTO, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)
            for i in range(n)
        )
    points.append(local_to_latlon(TRENTO, *xy[-1]))
    return [TrackPoint(lat, lon, time_s=4.0 * i) for i, (lat, lon) in enumerate(points)]


def test_a_run_with_the_recording_paused_on_the_walks_scores_the_letters() -> None:
    route, walks = _two_letters()
    # Paused at the end of the first I, resumed at the second: the track
    # jumps along the base line, as Strava draws it.
    paused = _run([(0, 0), (0, 1000), (0, 0), (300, 0), (300, 1000), (300, 0)])
    scored = score_track(paused, route, 0.88, walks)
    assert scored.score == 88
    assert scored.covered == 1.0 and scored.on_route == 1.0
    # Without the walks, the walk is a part of the route not run, and the
    # jump a part of the run off the route.
    plain = score_track(paused, route, 0.88)
    assert plain.covered < 1.0 and plain.on_route < 1.0


def test_the_positions_of_a_walk_run_anyway_do_not_count() -> None:
    route, walks = _two_letters()
    walked = _run(
        [(0, 0), (0, 1000), (0, 0), (0, -200), (300, -200), (300, 0), (300, 1000)]
        + [(300, 0)]
    )
    scored = score_track(walked, route, 0.88, walks)
    assert scored.score == 88
    # A walk that takes another street instead counts no more.
    elsewhere = _run(
        [(0, 0), (0, 1000), (0, 0), (0, -100), (300, -100), (300, 0), (300, 1000)]
        + [(300, 0)]
    )
    assert score_track(elsewhere, route, 0.88, walks).on_route < 1.0
    with pytest.raises(ValueError, match="is not a stretch"):
        score_track(walked, route, 0.88, [(5, 9)])


def test_the_gpx_of_a_word_with_the_pen_up_says_where_to_pause() -> None:
    route, walks = _two_letters()
    walks = [(1, 2), *walks]  # two walks, for the order
    when = datetime(2026, 10, 2, 18, 0, tzinfo=UTC)
    root = ET.fromstring(to_gpx(route, "II", when, walks).encode())
    ns = {"gpx": GPX_NAMESPACE}
    waypoints = root.findall("gpx:wpt", ns)
    assert len(waypoints) == 2 * len(walks)
    names = [w.findtext("gpx:name", namespaces=ns) for w in waypoints]
    assert names == [PAUSE, RESUME] * len(walks)
    at = [(float(w.get("lat", "")), float(w.get("lon", ""))) for w in waypoints]
    expected = [route[i] for walk in walks for i in walk]
    assert np.allclose(at, expected, rtol=0.0, atol=1e-7)
    # Before the track, as GPX 1.1 wants; still one line to follow.
    tags = [child.tag.rsplit("}", 1)[-1] for child in root]
    assert tags == ["metadata", *["wpt"] * len(waypoints), "trk"]
    assert len(root.findall("gpx:trk/gpx:trkseg/gpx:trkpt", ns)) == len(route)
    assert "<wpt" not in to_gpx(route, "II", when)
    with pytest.raises(ValueError, match="not within the points"):
        to_gpx(route, "II", when, [(3, 8)])


def test_the_cli_writes_a_word_with_the_pen_up(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(cli, "OsmnxSource", lambda cache_dir: _Source())
    out = tmp_path / "io.gpx"
    argv = ["--word=io", "--distance=6000", "--start=46.0671,11.1214", "--pen-up"]
    assert main([*argv, f"--out={out}"]) == 0
    printed = capsys.readouterr().out
    assert "pen up: each letter on its own" in printed
    assert "walks:      1, not drawn: " in printed
    assert "m drawn (target 6000 m)" in printed
    gpx = out.read_text(encoding="utf-8")
    assert gpx.count("<wpt") == 2
    request = parse_request(argv)
    assert isinstance(request, cli.WordRequest) and request.word.pen_up


def test_the_cli_refuses_the_pen_up_without_a_word(
    capsys: pytest.CaptureFixture[str],
) -> None:
    # A shape without pieces; an image is drawn in pieces with the pen up
    # since TASK-297 (tests/test_image_pieces.py).
    argv = ["--shape=heart", "--distance=5000", "--start=46.0671,11.1214", "--pen-up"]
    with pytest.raises(SystemExit) as exc:
        parse_request(argv)
    assert exc.value.code == 2
    assert PEN_UP_WITHOUT_WORD in capsys.readouterr().err


def test_a_letter_on_a_single_node_is_that_node() -> None:
    # Letters 10 m high on a grid of 100 m: each I falls on one node, and
    # the route is the nodes and the walks between them.
    word = compose("ii", pen_up=True)
    graph = _grid(TRENTO, 100.0, 1000.0)
    line = place_line(word.points, TRENTO, 10.0 / word.height)
    route = trace(graph, word, line, 2.0, 0.5)
    assert isinstance(route, NetworkRoute)
    assert route.walks == [(0, 0)]
    assert route.points == [line[0]]
