"""Deterministic tests for tools/sport_bench/sport_bench.py: no network, a
made-up graph, a made-up planner, and once the real engine on the small
Levico graph of the Route Engine's tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sport_bench import (
    DEFAULT_DISTANCES_M,
    DEFAULT_SHAPES,
    GOOD_SIMILARITY,
    MIN_SIMILARITY,
    ZONES,
    Row,
    Zone,
    compare,
    engine_planner,
    main,
    measure,
    network_error,
    network_stats,
    network_table,
    read_rows,
    routes_table,
    shapes_table,
    summarize,
    with_retries,
    write_results,
)

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "services" / "route-engine" / "tests" / "fixtures"
LEVICO_GRAPH = FIXTURES / "levico_walk_1km.graphml"
LEVICO = Zone("levico", "Levico", (46.0122, 11.2986), "test")


def test_the_thresholds_are_the_engines() -> None:
    from route_engine.optimizer import MIN_SIMILARITY as ENGINE_MIN

    assert MIN_SIMILARITY == ENGINE_MIN
    assert MIN_SIMILARITY < GOOD_SIMILARITY


def test_the_zones_are_six_in_northern_italy_with_their_own_keys() -> None:
    keys = [zone.key for zone in ZONES]
    assert keys == ["trento", "valsugana", "milano", "fiemme", "asiago", "pianura"]
    for zone in ZONES:
        for lat, lon in filter(None, (zone.start, zone.water_start)):
            assert 44.5 < lat < 47.0 and 8.5 < lon < 12.5


def test_the_default_distances_are_within_the_engines_limits() -> None:
    from route_engine.models import DISTANCE_LIMITS_M
    from route_engine.shapes import SUPPORTED_SHAPES

    for activity, distances in DEFAULT_DISTANCES_M.items():
        if activity not in DISTANCE_LIMITS_M:
            continue  # not in the engine yet (walking, TASK-371)
        low, high = DISTANCE_LIMITS_M[activity]
        assert all(low <= d <= high for d in distances), activity
    assert set(DEFAULT_SHAPES) <= set(SUPPORTED_SHAPES)


def test_a_two_way_street_counts_once() -> None:
    edges = [
        (1, 2, 100.0, {"highway": "residential"}),
        (2, 1, 100.0, {"highway": "residential"}),
        (2, 3, 50.0, {"highway": "path"}),  # one way: once only
    ]
    stats = network_stats(edges)
    assert stats.km == pytest.approx(0.15)
    assert stats.km_by_tag == pytest.approx({"residential": 0.1, "path": 0.05})


def test_pieces_junctions_and_dead_ends() -> None:
    star = [(0, n, 1000.0, {"highway": "track"}) for n in (1, 2, 3)]
    apart = [(10, 11, 500.0, {"highway": ["footway", "path"]})]
    stats = network_stats(star + apart)
    assert stats.pieces == 2
    assert stats.junctions == 1  # the centre of the star
    assert stats.dead_ends == 5  # three tips, and both ends of the piece apart
    assert stats.largest_km == pytest.approx(3.0)
    assert stats.km_by_tag == pytest.approx({"track": 3.0, "footway": 0.5})


def test_no_edges_no_network() -> None:
    stats = network_stats([])
    assert (stats.km, stats.pieces, stats.largest_km) == (0.0, 0, 0.0)


def _row(**kw: object) -> Row:
    base: dict[str, object] = {
        "zone": "trento",
        "shape": "circle",
        "target_m": 5000,
        "seconds": 10.0,
    }
    return Row(**{**base, **kw})  # type: ignore[arg-type]


def test_measure_asks_every_shape_at_every_distance_in_every_zone() -> None:
    asked: list[tuple[str, str, int]] = []

    def plan(zone: Zone, shape: str, distance_m: int) -> Row:
        asked.append((zone.key, shape, distance_m))
        return _row(zone=zone.key, shape=shape, target_m=distance_m)

    rows = measure(ZONES[:2], ["circle", "star"], [3000, 5000], plan)
    assert len(rows) == 8
    assert asked[0] == ("trento", "circle", 3000)
    assert asked[-1] == ("valsugana", "star", 5000)


def test_summary_counts_drawn_good_and_refused() -> None:
    rows = [
        _row(similarity=0.95, seconds=4.0),
        _row(similarity=0.70, seconds=6.0),
        _row(similarity=0.40, seconds=8.0),
        _row(error="ShapeNotDrawableError: no", seconds=20.0),
    ]
    s = summarize(rows)
    assert (s.asked, s.drawn, s.good, s.errors) == (4, 2, 1, 1)
    assert s.median_s == 7.0 and s.max_s == 20.0
    assert s.median_similarity == pytest.approx(0.70)


def test_tables_are_markdown_in_italian_numbers() -> None:
    rows = [
        _row(similarity=0.912, real_m=5100),
        _row(shape="star", error="ShapeNotDrawableError: no"),
    ]
    shapes = shapes_table(rows)
    assert "| trento | 2 | 1 | 1 | 0,91 | 10,0 s | 10,0 s |" in shapes
    assert shapes.splitlines()[-1].startswith("| tutte | 2 |")
    routes = routes_table(rows)
    assert "| trento | circle | 5 | 5,1 | 0,91 | 10,0 s | buono |" in routes
    assert "| — | — | 10,0 s | ShapeNotDrawableError |" in routes
    net = network_table({"trento": network_stats([(1, 2, 1500.0, {})])})
    assert "| trento | 1,5 | 1 | 1,5 km | 0 | 2 |" in net


def test_compare_says_what_got_worse_and_lets_noise_pass() -> None:
    before = [
        _row(shape="circle", similarity=0.90, seconds=10.0),
        _row(shape="heart", similarity=0.90, seconds=10.0),
        _row(shape="star", similarity=0.90, seconds=10.0),
        _row(shape="moon", similarity=0.90, seconds=1.0),
        _row(shape="sun", similarity=0.90, seconds=10.0),
    ]
    after = [
        _row(shape="circle", similarity=0.89, seconds=11.0),  # noise
        _row(shape="heart", similarity=0.80, seconds=10.0),
        _row(shape="star", error="ShapeNotDrawableError: x", seconds=10.0),
        _row(shape="moon", similarity=0.90, seconds=2.5),  # 2.5x but +1.5 s
        _row(shape="fish", similarity=0.90, seconds=10.0),
    ]
    whats = {(c.shape, c.what.split(":")[0]) for c in compare(before, after)}
    assert whats == {
        ("heart", "similarity 0.90 -> 0.80"),
        ("star", "no longer drawn"),
        ("sun", "only before"),
        ("fish", "only after"),
    }
    slow = compare(before[:1], [_row(similarity=0.9, seconds=16.0)])
    assert [c.what for c in slow] == ["slower 10.0 s -> 16.0 s"]


def test_results_round_trip(tmp_path: Path) -> None:
    rows = [_row(similarity=0.9, real_m=5000), _row(error="X: y")]
    path = tmp_path / "phase0" / "running.json"
    stats = {"trento": network_stats([(1, 2, 10.0, {})])}
    write_results(path, "running", "phase0", stats, rows, "abc123")
    data = json.loads(path.read_text(encoding="utf-8"))
    assert (data["activity"], data["label"], data["commit"]) == (
        "running",
        "phase0",
        "abc123",
    )
    assert data["network"]["trento"]["km"] == pytest.approx(0.01)
    assert read_rows(path) == rows


def test_compare_from_the_command_line(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    write_results(a, "running", "a", {}, [_row(similarity=0.9)], None)
    write_results(b, "running", "b", {}, [_row(similarity=0.9)], None)
    assert main(["compare", str(a), str(b)]) == 0
    assert "Nothing worse." in capsys.readouterr().out
    write_results(b, "running", "b", {}, [_row(similarity=0.5)], None)
    assert main(["compare", str(a), str(b)]) == 1


def test_the_engine_planner_draws_on_a_real_graph() -> None:
    from route_engine.network import FileSource

    plan = engine_planner("running", FileSource(LEVICO_GRAPH))
    row = plan(LEVICO, "circle", 1000)
    assert row.error is None, row.error
    # The 1 km graph is small: the circle comes out, longer than asked.
    assert row.drawn and row.similarity is not None
    assert row.real_m is not None and row.real_m > 500
    assert row.seconds >= 0


def test_the_engine_planner_without_water_says_so() -> None:
    plan = engine_planner("paddling", object())
    row = plan(ZONES[0], "circle", 2000)  # Trento has no water start
    assert row.error is not None and row.error.startswith("NoStart")


def test_retries_wait_longer_each_time_then_give_up() -> None:
    waits: list[float] = []
    calls = iter([OSError("502"), OSError("502"), "graph"])

    def task() -> object:
        answer = next(calls)
        if isinstance(answer, Exception):
            raise answer
        return answer

    assert with_retries(task, (1.0, 2.0, 4.0), sleep=waits.append) == "graph"
    assert waits == [1.0, 2.0]

    def always() -> None:
        raise OSError("504")

    waits.clear()
    with pytest.raises(OSError, match="504"):
        with_retries(always, (1.0, 2.0), sleep=waits.append)
    assert waits == [1.0, 2.0]


def test_only_network_errors_are_tried_again() -> None:
    class ResponseStatusCodeError(ValueError):  # as OSMnx names it
        pass

    assert network_error(OSError("502"))
    assert network_error(TimeoutError())
    assert network_error(ResponseStatusCodeError("502 Bad Gateway"))
    assert not network_error(ValueError("distance out of range"))
    assert not network_error(LookupError("not cached"))

    waits: list[float] = []

    def refused() -> None:
        raise ValueError("the shape does not fit")

    with pytest.raises(ValueError):
        with_retries(refused, (1.0,), sleep=waits.append, retry_if=network_error)
    assert waits == []
