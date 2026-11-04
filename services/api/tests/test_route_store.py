"""RouteStore: a city's examples kept once drawn, and nothing else."""

from __future__ import annotations

import json
import os
from dataclasses import replace
from pathlib import Path

from route_engine.directions import Direction
from route_engine.models import Landmark, RouteRequest, RouteResult, SwimTurn

from shaperoute_api.images import ImageRequest
from shaperoute_api.route_store import (
    CENTRES_FILE,
    KEEP_S,
    WATER_FOLDER,
    RouteStore,
    cell,
    engine_fingerprint,
)

ROVERETO = (45.8906, 11.0401)
HEART = RouteRequest(start=ROVERETO, shape="heart", distance_m=5000)
OTHER = RouteResult(
    points=[(45.8906, 11.0401), (45.8920, 11.0440), (45.8906, 11.0401)],
    distance_m=4900.0,
    similarity=0.8,
    shape="heart",
)
RESULT = RouteResult(
    points=[(45.8906, 11.0401), (45.8915, 11.0420), (45.8906, 11.0401)],
    distance_m=5100.0,
    similarity=0.9,
    shape="heart",
    warnings=["120 m of the route on steps"],
    directions=[
        Direction(
            node=42,
            point=(45.8906, 11.0401),
            distance_m=0.0,
            turn="depart",
            angle_deg=0.0,
            street="Corso Rosmini",
            road_type=None,
            branches=2,
            along="Via Dante",
        )
    ],
    alternatives=[OTHER],
)


class Clock:
    def __init__(self) -> None:
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now


def store(folder: Path, **options: object) -> RouteStore:
    options.setdefault("engine", "engine-a")
    return RouteStore(folder, **options)  # type: ignore[arg-type]


def test_a_route_from_a_city_centre_is_kept_and_read_whole(tmp_path: Path) -> None:
    kept = store(tmp_path)
    assert kept.get(HEART) is None
    kept.learn([ROVERETO])
    assert kept.put(HEART, RESULT) is True
    assert len(kept) == 1
    # Read as it was drawn: pairs, directions, the other routes to choose.
    assert kept.get(HEART) == RESULT
    # Also by an API started later.
    assert store(tmp_path).get(HEART) == RESULT


def test_the_same_square_of_ten_metres_is_the_same_start(tmp_path: Path) -> None:
    kept = store(tmp_path)
    kept.learn([(45.89061, 11.04012)])
    assert cell((45.89061, 11.04012)) == cell(ROVERETO) == "45.8906,11.0401"
    assert kept.put(HEART, RESULT) is True
    near = replace(HEART, start=(45.89063, 11.04008))
    assert kept.get(near) == RESULT
    assert kept.get(replace(HEART, start=(45.8916, 11.0401))) is None


def test_a_route_from_anywhere_else_is_never_written(tmp_path: Path) -> None:
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    home = replace(HEART, start=(45.8871, 11.0362))
    assert kept.put(home, RESULT) is False
    assert kept.get(home) is None
    assert list(tmp_path.glob("*.json")) == []


def test_an_image_is_never_kept(tmp_path: Path) -> None:
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    outline = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 0.0)]
    image = ImageRequest(start=ROVERETO, outline=outline, distance_m=5000)
    assert kept.put(image, RESULT) is False
    assert kept.get(image) is None


def test_another_request_is_another_route(tmp_path: Path) -> None:
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    kept.put(HEART, RESULT)
    assert kept.get(replace(HEART, shape="star")) is None
    assert kept.get(replace(HEART, distance_m=8000)) is None
    word = RouteRequest(start=ROVERETO, word="CIAO", distance_m=15000)
    assert kept.get(word) is None
    kept.put(word, replace(RESULT, shape=None, word="CIAO", alternatives=[]))
    assert kept.get(replace(word, style="block")) is None
    found = kept.get(word)
    assert found is not None and found.word == "CIAO"
    assert len(kept) == 2


def test_a_bike_route_is_kept_apart_from_the_run(tmp_path: Path) -> None:
    # TASK-190: the same shape from the same centre, by bike, is another
    # route, and the run keeps the file it had.
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    run = replace(HEART, distance_m=10_000)
    ride = replace(run, activity="cycling")
    assert kept.put(run, RESULT)
    run_files = sorted(tmp_path.glob("*.json"))
    assert kept.get(ride) is None
    bike = replace(RESULT, distance_m=10_200.0, alternatives=[])
    assert kept.put(ride, bike)
    assert kept.get(ride) == bike
    assert kept.get(run) == RESULT
    assert len(kept) == 2
    assert set(run_files) < set(tmp_path.glob("*.json"))


def test_a_bike_route_keeps_where_it_is_walked(tmp_path: Path) -> None:
    # TASK-206: the stretches with the bike on foot, in the alternatives too.
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    ride = replace(HEART, distance_m=10_000, activity="cycling")
    other = replace(OTHER, on_foot=[(0, 1)])
    bike = replace(RESULT, on_foot=[(1, 2)], alternatives=[other])
    assert kept.put(ride, bike)
    assert kept.get(ride) == bike
    assert store(tmp_path).get(ride) == bike


def test_a_route_kept_before_walks_nowhere(tmp_path: Path) -> None:
    # Kept before TASK-206 part B: no `on_foot` in the file.
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    kept.put(HEART, RESULT)
    (path,) = tmp_path.glob("*.json")
    data = json.loads(path.read_text())
    for result in (data["result"], *data["result"]["alternatives"]):
        del result["on_foot"]
    path.write_text(json.dumps(data))
    assert kept.get(HEART) == RESULT


def test_a_new_engine_draws_again(tmp_path: Path) -> None:
    old = store(tmp_path, engine="engine-a")
    old.learn([ROVERETO])
    old.put(HEART, RESULT)
    assert store(tmp_path, engine="engine-b").get(HEART) is None
    assert store(tmp_path, engine="engine-a").get(HEART) == RESULT


def test_the_engine_fingerprint_is_the_same_for_the_same_code() -> None:
    assert engine_fingerprint() == engine_fingerprint()
    assert len(engine_fingerprint()) == 12


def test_an_old_route_is_drawn_again(tmp_path: Path) -> None:
    clock = Clock()
    kept = store(tmp_path, clock=clock)
    kept.learn([ROVERETO])
    kept.put(HEART, RESULT)
    clock.now += KEEP_S - 1
    assert kept.get(HEART) == RESULT
    clock.now += 2
    assert kept.get(HEART) is None
    assert len(kept) == 0


def test_a_file_that_does_not_read_is_as_not_kept(tmp_path: Path) -> None:
    kept = store(tmp_path)
    kept.learn([ROVERETO])
    kept.put(HEART, RESULT)
    (path,) = tmp_path.glob("*.json")
    path.write_text('{"saved_at": 1000000.0, "result": {"points": [[45.89]]}}')
    assert kept.get(HEART) is None
    assert not path.exists()
    path.write_text("{half")
    assert kept.get(HEART) is None


def test_only_the_newest_routes_stay(tmp_path: Path) -> None:
    kept = store(tmp_path, max_routes=2)
    kept.learn([ROVERETO])
    for age, shape in enumerate(("heart", "circle", "star")):
        before = set(tmp_path.glob("*.json"))
        kept.put(replace(HEART, shape=shape), replace(RESULT, shape=shape))
        # Dates apart, whatever the grain of the disk's clock.
        (path,) = set(tmp_path.glob("*.json")) - before
        os.utime(path, (age + 1, age + 1))
    assert kept.get(HEART) is None
    assert kept.get(replace(HEART, shape="circle")) is not None
    assert kept.get(replace(HEART, shape="star")) is not None


def test_centres_are_remembered_by_the_next_api(tmp_path: Path) -> None:
    first = store(tmp_path)
    first.learn([ROVERETO, (46.0679, 11.1211)])
    first.learn([ROVERETO])
    assert (tmp_path / CENTRES_FILE).read_text().split() == [
        "45.8906,11.0401",
        "46.0679,11.1211",
    ]
    assert store(tmp_path).put(HEART, RESULT) is True


def test_the_oldest_centres_are_forgotten(tmp_path: Path) -> None:
    kept = store(tmp_path, max_centres=4)
    kept.learn([(45.0 + i / 100, 11.0) for i in range(5)])
    # Past the limit only the newest half is written again.
    assert (tmp_path / CENTRES_FILE).read_text().split() == [
        "45.0300,11.0000",
        "45.0400,11.0000",
    ]
    assert kept.put(replace(HEART, start=(45.04, 11.0)), RESULT) is True
    assert kept.put(replace(HEART, start=(45.0, 11.0)), RESULT) is False


def test_a_folder_that_cannot_be_written_keeps_nothing(tmp_path: Path) -> None:
    blocked = tmp_path / "file"
    blocked.write_text("not a folder")
    kept = store(blocked / "routes")
    kept.learn([ROVERETO])  # known until the API stops, not written
    assert kept.put(HEART, RESULT) is False
    assert kept.get(HEART) is None


# A point of the app's list of lakes (TASK-246 part B).
LEVICO_LAKE = (46.00869, 11.27722)
ON_THE_LAKE = RouteRequest(
    start=LEVICO_LAKE,
    shape="dog_head",
    distance_m=2000,
    activity="paddling",
    pen_up=True,
)
PADDLED = RouteResult(
    points=[LEVICO_LAKE, (46.0095, 11.2790), LEVICO_LAKE],
    distance_m=2010.0,
    similarity=0.95,
    shape="dog_head",
    walks=[(1, 2)],
    centre=(46.0091, 11.2781),
    rotation_deg=30.0,
)


def test_a_route_from_a_point_on_the_water_is_kept_apart(tmp_path: Path) -> None:
    kept = store(tmp_path, water=[LEVICO_LAKE])
    assert kept.water_points == 1
    # Nothing learned: the point is a centre from the start.
    assert kept.put(ON_THE_LAKE, PADDLED) is True
    assert kept.get(ON_THE_LAKE) == PADDLED
    assert store(tmp_path, water=[LEVICO_LAKE]).get(ON_THE_LAKE) == PADDLED
    # In its own folder, never among the city centres.
    assert len(kept) == 0 and kept.kept_on_water() == 1
    assert len(list((tmp_path / WATER_FOLDER).glob("*.json"))) == 1
    assert not (tmp_path / CENTRES_FILE).exists()
    # Ten metres away is someone's position: not kept.
    away = replace(ON_THE_LAKE, start=(46.0089, 11.2774))
    assert kept.put(away, PADDLED) is False
    # Nor without the lists.
    assert store(tmp_path / "other").put(ON_THE_LAKE, PADDLED) is False


def test_the_shapes_on_the_water_never_push_a_city_out(tmp_path: Path) -> None:
    points = [(46.0 + i / 100, 11.0) for i in range(4)]
    kept = store(tmp_path, max_routes=1, max_water_routes=2, water=points)
    kept.learn([ROVERETO])
    assert kept.put(HEART, RESULT) is True
    for age, point in enumerate(points):
        assert kept.put(replace(ON_THE_LAKE, start=point), PADDLED) is True
        for path in (tmp_path / WATER_FOLDER).glob("*.json"):
            if os.stat(path).st_mtime > 100:
                os.utime(path, (age + 1, age + 1))
    assert kept.get(HEART) == RESULT
    assert kept.kept_on_water() == 2
    assert kept.get(replace(ON_THE_LAKE, start=points[0])) is None
    assert kept.get(replace(ON_THE_LAKE, start=points[3])) == PADDLED


def test_a_shape_moved_on_the_water_is_the_users_own(tmp_path: Path) -> None:
    kept = store(tmp_path, water=[LEVICO_LAKE])
    moved = replace(ON_THE_LAKE, near=(46.0100, 11.2800))
    assert kept.put(moved, PADDLED) is False
    assert kept.get(moved) is None


SWIM_ON_THE_LAKE = RouteRequest(
    start=LEVICO_LAKE, shape="heart", distance_m=1000, activity="swimming", laps=3
)
SWUM = RouteResult(
    points=[LEVICO_LAKE, (46.0095, 11.2790), (46.0094, 11.2795), LEVICO_LAKE],
    distance_m=1010.0,
    similarity=1.0,
    shape="heart",
    centre=(46.0091, 11.2781),
    laps=3,
    turns=[
        SwimTurn(
            point=(46.0095, 11.2790),
            at_m=28.0,
            side="left",
            angle_deg=71.0,
            lap=1,
            landmark=Landmark(
                name="Lido di Levico",
                kind="beach_resort",
                point=(46.0099, 11.2788),
                distance_m=46.0,
                bearing_deg=342.0,
            ),
        ),
        SwimTurn(point=(46.0094, 11.2795), at_m=150.0, side="right", angle_deg=121.0),
    ],
)


def test_a_swim_is_kept_with_its_laps_and_turns(tmp_path: Path) -> None:
    # TASK-323 part B: read back as drawn, its laps part of what it is, and
    # under the fingerprint of the swims.
    kept = RouteStore(tmp_path, water=[LEVICO_LAKE])
    assert kept.put(SWIM_ON_THE_LAKE, SWUM) is True
    assert kept.get(SWIM_ON_THE_LAKE) == SWUM
    assert kept.get(replace(SWIM_ON_THE_LAKE, laps=4)) is None
    (path,) = (tmp_path / WATER_FOLDER).glob("*.json")
    assert json.loads(path.read_text())["engine"] == engine_fingerprint(swims=True)
    paddled = RouteStore(tmp_path, water=[LEVICO_LAKE])
    assert paddled.put(ON_THE_LAKE, PADDLED) is True
    engines = {
        json.loads(p.read_text())["engine"]
        for p in (tmp_path / WATER_FOLDER).glob("*.json")
    }
    assert engines == {engine_fingerprint(), engine_fingerprint(swims=True)}
