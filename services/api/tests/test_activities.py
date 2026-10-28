"""My activities in a real PostgreSQL (TASK-172, ADR-0140): a run saved,
listed a page at a time, opened and deleted; the API counts metres, seconds
and score itself; each account sees only its own; the bodies are the
examples of packages/shared-types/fixtures. A run along a word with the pen
up keeps its walks and its pauses of the pen (TASK-199); a run opened whole
has its pauses (TASK-200); a run along a route whose shape the engine turned
keeps the turn, and those saved before are north up (TASK-232 part C)."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import psycopg
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from route_engine.track_score import TrackPoint, score_track

from shaperoute_api import activities as activities_module
from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import (
    ActivitiesBody,
    ActivityBody,
    ActivityDetailBody,
    ActivityRequestBody,
    PauseBody,
    PlaceNames,
    parse_place,
)
from shaperoute_api.app import create_app
from shaperoute_api.db import MIGRATIONS_DIR, Database, migrations
from shaperoute_api.recommended import PREVIEW_POINTS
from shaperoute_api.schemas import MAX_TRACK_FIXES

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
KEY = "7c2e91a4b05d3f68"
OTHER_KEY = "e5d0a83f19c7b246"
PLACE_KEY = "test-key"
# Added by TASK-232 part C: the fixtures written before are what an older
# app sends and an older API answers.
TURN = {"rotation_deg"}
# The post of a run (TASK-258): the runs opened whole were written before it.
POST = {"post"}
# Where a run comes from (TASK-312 part A): every fixture written before is
# a run of the app, as an older app sends it and an older API answers it.
SOURCE = {"source"}
MUW = {"source": "muw"}


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 8, 30, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


class PlaceService:
    """Geoapify's reverse geocoding, as far as the API reads it."""

    def __init__(self) -> None:
        self.urls: list[str] = []
        self.answer: Any = {"results": [{"city": "Trento", "country": "Italy"}]}
        self.down = False

    def __call__(self, url: str) -> Any:
        self.urls.append(url)
        if self.down:
            raise OSError("no answer")
        return self.answer


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def service() -> PlaceService:
    return PlaceService()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def client(database: Database, wall: WallClock, service: PlaceService) -> TestClient:
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=accounts,
            run_places=PlaceNames(PLACE_KEY, fetch=service),
        )
    )


def signed_up(client: TestClient, **changes: Any) -> dict[str, str]:
    """A new account, as the header its requests carry."""
    body = {**_load("sign-up-request.json"), **changes}
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def other(client: TestClient) -> dict[str, str]:
    return signed_up(client, email="other@example.com", username="other_runner")


def request(**changes: Any) -> dict[str, Any]:
    return {**_load("activity-request.json"), **changes}


def later(body: dict[str, Any], ms: float) -> dict[str, Any]:
    """The same run begun `ms` later."""
    return {
        **body,
        "track": [{**fix, "time_ms": fix["time_ms"] + ms} for fix in body["track"]],
        "pauses": [
            {**pause, "from_ms": pause["from_ms"] + ms, "to_ms": pause["to_ms"] + ms}
            for pause in body["pauses"]
        ],
    }


def free(**changes: Any) -> dict[str, Any]:
    """A run without a route."""
    return request(points=None, similarity=None, shape=None, **changes)


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


def ids(answer: Any) -> list[str]:
    return [activity["id"] for activity in answer.json()["activities"]]


# --- The contract, without a database ---


def test_the_fixtures_are_the_contract() -> None:
    # Written before TASK-199: the request of an older app, the answer of an
    # older API, without the walks and the pen; and without the activity of
    # TASK-208, in activity-request-cycling.json (test_drawings.py).
    body = _load("activity-request.json")
    assert set(body) == (
        set(ActivityRequestBody.model_fields) - {"walks", "activity"} - TURN - SOURCE
    )
    assert set(body["pauses"][0]) == set(PauseBody.model_fields) - {"pen"}
    ActivityRequestBody.model_validate(body)
    listed = _load("activities.json")
    assert set(listed) == set(ActivitiesBody.model_fields)
    for activity in listed["activities"]:
        assert set(activity) == set(ActivityBody.model_fields) - TURN - SOURCE
    ActivitiesBody.model_validate(listed)
    whole = _load("activity.json")
    assert set(whole) == (
        set(ActivityDetailBody.model_fields)
        - {"walks", "pauses"}
        - TURN
        - POST
        - SOURCE
    )
    # A word with the pen up (TASK-199): every field but the activity.
    walked = _load("activity-request-walks.json")
    assert set(walked) == (
        set(ActivityRequestBody.model_fields) - {"activity"} - TURN - SOURCE
    )
    assert set(walked["pauses"][0]) == set(PauseBody.model_fields)
    ActivityRequestBody.model_validate(walked)
    whole_walked = _load("activity-walks.json")
    assert set(whole_walked) == (
        set(ActivityDetailBody.model_fields) - {"pauses"} - TURN - POST - SOURCE
    )
    # The same run opened from the API of TASK-200: every field.
    whole_paused = _load("activity-pauses.json")
    assert set(whole_paused) == (
        set(ActivityDetailBody.model_fields) - TURN - POST - SOURCE
    )
    assert {**whole_paused, "pauses": None} == {**whole_walked, "pauses": None}
    ActivityDetailBody.model_validate(whole_paused)
    # A run along a route whose shape is turned (TASK-232 part C): the
    # request of before with its turn, and the run whole with every field.
    turned = _load("activity-request-turned.json")
    assert set(turned) == (
        set(ActivityRequestBody.model_fields) - {"walks", "activity"} - SOURCE
    )
    assert {**turned, "rotation_deg": None} == {**body, "rotation_deg": None}
    assert ActivityRequestBody.model_validate(turned).rotation_deg == -30
    whole_turned = _load("activity-turned.json")
    assert set(whole_turned) == set(ActivityDetailBody.model_fields) - POST - SOURCE
    assert ActivityDetailBody.model_validate(whole_turned).rotation_deg == -30


def test_the_migration_comes_after_the_favorites() -> None:
    names = [path.name for path in migrations()]
    assert names.index("0003_runs.sql") > names.index("0002_favorites.sql")


def test_the_walks_come_after_the_runs_and_the_favorites() -> None:
    names = [path.name for path in migrations()]
    walks = next(
        i for i, name in enumerate(names) if name.endswith("_pen_up_walks.sql")
    )
    assert walks > names.index("0003_runs.sql") > names.index("0002_favorites.sql")


def test_the_turn_comes_last_and_once() -> None:
    names = [path.name for path in migrations()]
    turns = [name for name in names if name.endswith("_route_rotation.sql")]
    assert len(turns) == 1
    assert names.index(turns[0]) > names.index("0003_runs.sql")


@pytest.mark.parametrize(
    ("body", "name"),
    [
        ({"results": [{"city": "Trento", "name": "Povo"}]}, "Trento"),
        ({"results": [{"name": " Levico Terme "}]}, "Levico Terme"),
        ({"results": [{"city": "x" * 200}]}, "x" * 80),
        ({"results": [{"country": "Italy"}]}, None),
        ({"results": []}, None),
        ({"results": ["Trento"]}, None),
        ({}, None),
        ("Trento", None),
    ],
)
def test_the_place_is_the_town_of_the_first_result(body: Any, name: str | None) -> None:
    assert parse_place(body) == name


# --- Saving, listing, opening, deleting ---


def test_a_run_saved_is_listed_as_the_example(client: TestClient) -> None:
    me = signed_up(client)
    saved = client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert saved.status_code == 201
    # The example of before TASK-232 part C: north up.
    expected = {
        **_load("activities.json")["activities"][0],
        "rotation_deg": None,
        **MUW,
    }
    assert saved.json() == expected
    listed = client.get("/me/activities", headers=me)
    assert listed.status_code == 200
    assert listed.json() == {"activities": [expected], "next": None, "total": 1}


def test_a_run_opens_whole_as_the_example(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    whole = client.get(f"/me/activities/{KEY}", headers=me)
    assert whole.status_code == 200
    # The example of before TASK-199, no walks, and its pause standing still
    # on the clock of the track.
    assert whole.json() == {
        **_load("activity.json"),
        "post": None,
        "walks": [],
        "pauses": [{"from_s": 300.0, "to_s": 360.0, "auto": True}],
        "rotation_deg": None,
        **MUW,
    }


def test_a_run_along_a_turned_route_keeps_the_turn(client: TestClient) -> None:
    """TASK-232 part C: the app sends how far the engine turned the shape,
    and reads it back in the list and on the run whole, to draw the run
    turned back."""
    me = signed_up(client)
    turned = _load("activity-request-turned.json")
    saved = client.put(f"/me/activities/{KEY}", json=turned, headers=me)
    assert saved.status_code == 201
    assert saved.json()["rotation_deg"] == -30
    listed = client.get("/me/activities", headers=me).json()["activities"]
    assert [run["rotation_deg"] for run in listed] == [-30]
    whole = client.get(f"/me/activities/{KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json() == {**_load("activity-turned.json"), "post": None, **MUW}
    # Half degrees come back as sent: the water tries every 5°, and a
    # `real` column holds them.
    client.put(
        f"/me/activities/{OTHER_KEY}",
        json=later({**turned, "rotation_deg": 22.5}, 60_000),
        headers=me,
    )
    assert (
        client.get(f"/me/activities/{OTHER_KEY}", headers=me).json()["rotation_deg"]
        == 22.5
    )


def test_a_turn_is_the_routes_and_within_half_a_turn(client: TestClient) -> None:
    me = signed_up(client)
    # Without a route there is nothing turned.
    answer = client.put(
        f"/me/activities/{KEY}", json=free(rotation_deg=-30), headers=me
    )
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    for turn in (181, -180.5, "thirty", [30]):
        answer = client.put(
            f"/me/activities/{KEY}", json=request(rotation_deg=turn), headers=me
        )
        assert answer.status_code == 422, turn
    assert client.get("/me/activities", headers=me).json()["total"] == 0


def test_a_run_without_a_route_has_no_score(client: TestClient) -> None:
    me = signed_up(client)
    saved = client.put(f"/me/activities/{KEY}", json=free(), headers=me)
    assert saved.status_code == 201
    run = saved.json()
    assert run["score"] is None and run["fidelity"] is None
    assert run["route_preview"] is None
    assert (run["distance_m"], run["duration_s"]) == (4007, 1140)
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert whole["points"] is None and whole["similarity"] is None
    assert len(whole["track"]) == 5


def test_the_score_is_the_engines(client: TestClient) -> None:
    me = signed_up(client)
    body = request(track=request()["track"][:3], pauses=[])
    track = [
        TrackPoint(*fix["point"], fix["time_ms"] / 1000, fix["accuracy_m"])
        for fix in body["track"]
    ]
    route = [tuple(point) for point in body["points"]]
    expected = score_track(track, route, body["similarity"])
    run = client.put(f"/me/activities/{KEY}", json=body, headers=me).json()
    assert run["score"] == expected.score < round(body["similarity"] * 100)
    assert run["fidelity"] == pytest.approx(expected.fidelity, abs=1e-4)
    assert run["distance_m"] == round(expected.distance_m)
    assert run["duration_s"] == 600


@pytest.mark.parametrize(
    "numbers", [{"score": 100}, {"distance_m": 42_195}, {"duration_s": 60}]
)
def test_the_apps_own_numbers_are_not_taken(
    client: TestClient, numbers: dict[str, Any]
) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/activities/{KEY}", json=request(**numbers), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/activities", headers=me).json()["total"] == 0


def test_a_run_too_short_for_a_score_is_kept_without_one(client: TestClient) -> None:
    me = signed_up(client)
    # 77 m of a 4 km route: the engine does not judge it.
    track = [
        {"point": [46.0671, 11.1214], "time_ms": 1790000000000},
        {"point": [46.0671, 11.1224], "time_ms": 1790000030000},
    ]
    saved = client.put(
        f"/me/activities/{KEY}", json=request(track=track, pauses=[]), headers=me
    )
    assert saved.status_code == 201
    run = saved.json()
    assert run["score"] is None and run["fidelity"] is None
    assert run["route_preview"] is not None
    assert (run["distance_m"], run["duration_s"]) == (77, 30)


def test_the_track_kept_is_where_the_runner_was(client: TestClient) -> None:
    me = signed_up(client)
    fixes = request()["track"]
    track = [
        fixes[0],
        # Too uncertain, and then a jump no runner makes: neither is kept.
        {"point": [46.0672, 11.1250], "time_ms": 1790000100000, "accuracy_m": 90.0},
        {"point": [46.2000, 11.1300], "time_ms": 1790000200000, "accuracy_m": 5.0},
        *fixes[1:],
    ]
    client.put(f"/me/activities/{KEY}", json=request(track=track), headers=me)
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert whole["track"] == _load("activity.json")["track"]
    assert whole["distance_m"] == 4007


def test_the_runners_pause_is_not_of_the_run(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client)
    # Paused by hand along the second side, for five minutes less a second.
    pause = {"from_ms": 1790000300500, "to_ms": 1790000599000, "auto": False}
    run = client.put(
        f"/me/activities/{KEY}", json=request(pauses=[pause]), headers=me
    ).json()
    # Three sides of the four, about a kilometre each, and their minutes.
    assert run["distance_m"] == 4007 - 1001
    assert run["duration_s"] == round(1200 - 298.5)
    with database.connect() as conn:
        row = conn.execute(
            "SELECT pauses, ST_M(ST_PointN(track, 2)) AS second,"
            " ST_M(ST_EndPoint(track)) AS last FROM runs"
        ).fetchone()
    assert row is not None
    # M is the clock since the first point, pauses included.
    assert (row["second"], row["last"]) == (300.0, 1200.0)
    assert row["pauses"] == [{"from_s": 300.5, "to_s": 599.0, "auto": False}]


def test_a_pause_is_the_runners_from_where_it_begins(client: TestClient) -> None:
    me = signed_up(client)
    # Begun on the second fix itself, as when a run is taken up again, and
    # ended a moment after the clock of the third: the phone's clock and the
    # GPS's do not tick together.
    pause = {"from_ms": 1790000300000, "to_ms": 1790000600400, "auto": False}
    run = client.put(
        f"/me/activities/{KEY}", json=request(pauses=[pause]), headers=me
    ).json()
    assert run["distance_m"] == 4007 - 1001
    assert run["duration_s"] == round(1200 - 300.4)


def test_a_pause_while_standing_still_takes_only_time(client: TestClient) -> None:
    me = signed_up(client)
    pauses = [
        {"from_ms": 1790000300000, "to_ms": 1790000360000, "auto": True},
        # Counted once where two overlap, and only inside the run.
        {"from_ms": 1790000330000, "to_ms": 1790000390000, "auto": True},
        {"from_ms": 1790001190000, "to_ms": 1790009990000, "auto": True},
        {"from_ms": 1780000000000, "to_ms": 1789999999000, "auto": False},
    ]
    run = client.put(
        f"/me/activities/{KEY}", json=request(pauses=pauses), headers=me
    ).json()
    assert run["distance_m"] == 4007
    assert run["duration_s"] == 1200 - 90 - 10


def test_a_run_opened_whole_has_its_pauses_as_kept(client: TestClient) -> None:
    me = signed_up(client)
    pauses = [
        {"from_ms": 1790000300000, "to_ms": 1790000360000, "auto": True},
        {"from_ms": 1790000330000, "to_ms": 1790000390000, "auto": True},
        {"from_ms": 1790001190000, "to_ms": 1790009990000, "auto": True},
        {"from_ms": 1780000000000, "to_ms": 1789999999000, "auto": False},
    ]
    track = [
        # Too uncertain: not kept, and the clock starts at the next fix.
        {"point": [46.0670, 11.1214], "time_ms": 1789999940000, "accuracy_m": 90.0},
        *request()["track"],
    ]
    client.put(
        f"/me/activities/{KEY}",
        json=request(track=track, pauses=pauses),
        headers=me,
    )
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert whole["track"] == _load("activity.json")["track"]
    # In the order sent, in seconds since the first point of the track, and
    # only what of each lies inside the run; overlaps are kept as they are.
    assert whole["pauses"] == [
        {"from_s": 300.0, "to_s": 360.0, "auto": True},
        {"from_s": 330.0, "to_s": 390.0, "auto": True},
        {"from_s": 1190.0, "to_s": 1200.0, "auto": True},
    ]
    # The list does not have them.
    listed = client.get("/me/activities", headers=me).json()["activities"]
    assert "pauses" not in listed[0]


def test_a_run_without_pauses_opens_with_none(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=free(pauses=[]), headers=me)
    assert client.get(f"/me/activities/{KEY}", headers=me).json()["pauses"] == []


def test_saving_twice_saves_once(client: TestClient, wall: WallClock) -> None:
    me = signed_up(client)
    first = client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    wall.t += timedelta(hours=1)
    again = client.put(f"/me/activities/{KEY}", json=free(), headers=me)
    assert again.status_code == 200
    # As it was saved the first time: the route and the score stay.
    assert again.json() == first.json()
    listed = client.get("/me/activities", headers=me).json()
    assert listed["total"] == 1 and len(listed["activities"]) == 1


def test_a_long_run_is_listed_light_and_opened_whole(client: TestClient) -> None:
    me = signed_up(client)
    track = [
        {
            "point": [46.0 + i * 2e-5, 11.0 + i * 2e-5],
            "time_ms": 1790000000000 + i * 1000,
        }
        for i in range(1000)
    ]
    points = [[46.0 + i * 1e-5, 11.0 + i * 1e-5] for i in range(2000)]
    saved = client.put(
        f"/me/activities/{KEY}",
        json=request(track=track, points=points, pauses=[]),
        headers=me,
    ).json()
    assert len(saved["track_preview"]) == len(saved["route_preview"]) == PREVIEW_POINTS
    assert saved["track_preview"][0] == saved["route_preview"][0] == [46.0, 11.0]
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert len(whole["track"]) == 1000
    assert whole["points"] == points


def test_deleting_is_done_once_or_twice(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert client.delete(f"/me/activities/{KEY}", headers=me).status_code == 204
    assert client.get("/me/activities", headers=me).json() == {
        "activities": [],
        "next": None,
        "total": 0,
    }
    assert client.delete(f"/me/activities/{KEY}", headers=me).status_code == 204
    gone = client.get(f"/me/activities/{KEY}", headers=me)
    assert gone.status_code == 404
    assert code(gone) == "http_error"


# --- A word with the pen up (TASK-199) ---


def walked(**changes: Any) -> dict[str, Any]:
    """A run along «II» with the pen up, paused by the pen between the two
    letters."""
    return {**_load("activity-request-walks.json"), **changes}


def test_a_run_with_walks_has_the_score_of_its_letters(client: TestClient) -> None:
    me = signed_up(client)
    body = walked()
    saved = client.put(f"/me/activities/{KEY}", json=body, headers=me)
    assert saved.status_code == 201
    scored = client.post(
        "/track-scores",
        json={key: body[key] for key in ("points", "similarity", "track", "walks")},
    )
    assert scored.status_code == 200
    run = saved.json()
    # The score seen at the end of the run: the same numbers.
    assert (run["score"], run["fidelity"]) == (
        scored.json()["score"],
        scored.json()["fidelity"],
    )
    assert (run["score"], run["fidelity"]) == (88, 1.0)
    # The walk run to the next letter is not of the run, as any pause.
    assert (run["distance_m"], run["duration_s"]) == (4003, 1200)
    whole = client.get(f"/me/activities/{KEY}", headers=me)
    assert whole.status_code == 200
    # With its pause of the pen (TASK-200); north up (TASK-232).
    assert whole.json() == {
        **_load("activity-pauses.json"),
        "rotation_deg": None,
        "post": None,
        **MUW,
    }


def test_the_same_run_without_walks_is_scored_on_the_whole_route(
    client: TestClient,
) -> None:
    me = signed_up(client)
    body = walked()
    del body["walks"]
    run = client.put(f"/me/activities/{KEY}", json=body, headers=me).json()
    # The walk from one letter to the next is judged as if drawn: lower.
    assert (run["score"], run["fidelity"]) == (80, pytest.approx(0.9071, abs=1e-4))
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert whole["walks"] == []


def test_a_pause_of_the_pen_is_kept_as_one(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client)
    pauses = [
        {"from_ms": 1790000600000, "to_ms": 1790000900000, "pen": True},
        # The runner's own, on the second letter: as before TASK-199.
        {"from_ms": 1790001300000, "to_ms": 1790001320000, "auto": False},
    ]
    run = client.put(
        f"/me/activities/{KEY}", json=walked(pauses=pauses), headers=me
    ).json()
    # A pause of the pen counts as the runner's: neither the walk nor its
    # minutes are of the run.
    assert run["duration_s"] == 1500 - 300 - 20
    assert run["distance_m"] == 4003 - 1001
    with database.connect() as conn:
        row = conn.execute("SELECT pauses, walks FROM runs").fetchone()
    assert row is not None
    assert row["pauses"] == [
        {"from_s": 600.0, "to_s": 900.0, "auto": False, "pen": True},
        {"from_s": 1300.0, "to_s": 1320.0, "auto": False},
    ]
    assert row["walks"] == [[2, 5]]
    # Opened whole: `pen` only on the pause of the pen, as the row keeps it
    # (TASK-200).
    whole = client.get(f"/me/activities/{KEY}", headers=me).json()
    assert whole["pauses"] == [
        {"from_s": 600.0, "to_s": 900.0, "auto": False, "pen": True},
        {"from_s": 1300.0, "to_s": 1320.0, "auto": False},
    ]


@pytest.mark.parametrize(
    "changes",
    [
        # Beyond the 8 points of the route.
        {"walks": [[2, 8]]},
        {"walks": [[5, 2]]},
        {"walks": [[-1, 2]]},
        {"walks": [[2, 5], [3, 6]]},
        {"walks": [[2, 5, 7]]},
        {"walks": [[2, 5]] * 40},
        # Walks without a route to be stretches of.
        {"points": None, "similarity": None},
        {"pauses": [{"from_ms": 1790000600000, "to_ms": 1790000900000, "pen": "or"}]},
    ],
)
def test_walks_that_are_not_of_the_route_are_refused(
    client: TestClient, changes: dict[str, Any]
) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/activities/{KEY}", json=walked(**changes), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/activities", headers=me).json()["total"] == 0


def test_runs_saved_before_the_turn_are_north_up(
    database_url: str, tmp_path: Path, wall: WallClock, service: PlaceService
) -> None:
    """TASK-232 part C: the schema of before, with a run and a favorite in
    it; the API of part C starts with its migration, and reads them without
    a turn: the app shows them north up, as they were."""
    database = Database(database_url)
    before = [p for p in migrations() if not p.name.endswith("_route_rotation.sql")]
    assert len(before) == len(migrations()) - 1
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    old = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=accounts,
            run_places=PlaceNames(PLACE_KEY, fetch=service),
        )
    )
    me = signed_up(old)
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
        # As the API of before wrote them.
        conn.execute(
            "INSERT INTO runs (user_id, key, route, route_similarity, shape,"
            " track, pauses, started_at, distance_m, duration_s, score,"
            " fidelity, place, created_at) VALUES (%s, %s,"
            " ST_GeomFromText('LINESTRING(11.1214 46.0671,11.1344 46.0671)', 4326),"
            " 0.91, 'star', ST_GeomFromText("
            "'LINESTRING M (11.1214 46.0671 0,11.1344 46.0671 300)', 4326),"
            " '[]', %s, 1001, 299, 91, 1.0, 'Trento', %s)",
            (user["id"], KEY, wall.t, wall.t),
        )
        conn.execute(
            "INSERT INTO favorites (user_id, key, city, shape, distance_m,"
            " route_m, similarity, line, created_at) VALUES (%s, %s, 'trento',"
            " 'star', 5000, 5120, 0.996,"
            " ST_GeomFromText('LINESTRING(11.1215 46.067,11.123 46.07)', 4326), %s)",
            (user["id"], "3f9a1c0e7b2d4a65", wall.t),
        )
    assert database.migrate(MIGRATIONS_DIR) == [
        p.stem for p in migrations() if p.name.endswith("_route_rotation.sql")
    ]
    new = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=accounts,
            run_places=PlaceNames(PLACE_KEY, fetch=service),
        )
    )
    listed = new.get("/me/activities", headers=me).json()["activities"]
    assert [run["rotation_deg"] for run in listed] == [None]
    whole = new.get(f"/me/activities/{KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json()["rotation_deg"] is None
    assert whole.json()["points"] == [[46.0671, 11.1214], [46.0671, 11.1344]]
    favorite = new.get("/me/favorites/3f9a1c0e7b2d4a65", headers=me)
    assert favorite.status_code == 200
    assert favorite.json()["rotation_deg"] is None
    assert (
        new.get("/me/favorites", headers=me).json()["favorites"][0]["rotation_deg"]
        is None
    )


def test_runs_saved_before_the_walks_read_as_they_did(
    database_url: str, tmp_path: Path, wall: WallClock, service: PlaceService
) -> None:
    database = Database(database_url)
    # The schema of before TASK-199, with a run and a favorite in it.
    before = [path for path in migrations() if not path.name.endswith("_walks.sql")]
    assert len(before) == len(migrations()) - 1
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    old = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            run_places=PlaceNames(PLACE_KEY, fetch=service),
        )
    )
    me = signed_up(old)
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
        # As the API of before wrote them.
        conn.execute(
            "INSERT INTO runs (user_id, key, route, route_similarity, shape,"
            " track, pauses, started_at, distance_m, duration_s, score,"
            " fidelity, place, created_at) VALUES (%s, %s,"
            " ST_GeomFromText('LINESTRING(11.1214 46.0671,11.1344 46.0671)', 4326),"
            " 0.91, 'star', ST_GeomFromText("
            "'LINESTRING M (11.1214 46.0671 0,11.1344 46.0671 300)', 4326),"
            ' \'[{"from_s": 1.0, "to_s": 2.0, "auto": true}]\','
            " %s, 1001, 299, 91, 1.0, 'Trento', %s)",
            (user["id"], KEY, wall.t, wall.t),
        )
        conn.execute(
            "INSERT INTO favorites (user_id, key, city, shape, distance_m,"
            " route_m, similarity, line, created_at) VALUES (%s, %s, 'trento',"
            " 'star', 5000, 5120, 0.996,"
            " ST_GeomFromText('LINESTRING(11.1215 46.067,11.123 46.07)', 4326), %s)",
            (user["id"], "3f9a1c0e7b2d4a65", wall.t),
        )
    # The API of TASK-199 starts: the walks' migration, and nothing else.
    assert database.migrate(MIGRATIONS_DIR) == [
        path.stem for path in migrations() if path.name.endswith("_walks.sql")
    ]
    new = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            run_places=PlaceNames(PLACE_KEY, fetch=service),
        )
    )
    whole = new.get(f"/me/activities/{KEY}", headers=me)
    assert whole.status_code == 200
    assert whole.json()["walks"] == []
    # Its pauses, as they were kept (TASK-200).
    assert whole.json()["pauses"] == [{"from_s": 1.0, "to_s": 2.0, "auto": True}]
    assert whole.json()["score"] == 91
    assert whole.json()["points"] == [[46.0671, 11.1214], [46.0671, 11.1344]]
    assert new.get("/me/activities", headers=me).json()["total"] == 1
    favorite = new.get("/me/favorites/3f9a1c0e7b2d4a65", headers=me)
    assert favorite.status_code == 200
    assert favorite.json()["walks"] == []
    assert favorite.json()["points"] == [[46.067, 11.1215], [46.07, 11.123]]
    with database.connect() as conn:
        row = conn.execute("SELECT pauses FROM runs").fetchone()
    assert row is not None
    assert row["pauses"] == [{"from_s": 1.0, "to_s": 2.0, "auto": True}]


def test_a_run_without_a_route_cannot_keep_walks(
    client: TestClient, database: Database
) -> None:
    signed_up(client)
    with database.connect() as conn:
        user = conn.execute("SELECT id FROM users").fetchone()
        assert user is not None
    with pytest.raises(psycopg.errors.CheckViolation):
        with database.connect() as conn:
            conn.execute(
                "INSERT INTO runs (user_id, key, track, started_at, distance_m,"
                " duration_s, created_at, walks) VALUES (%s, %s, ST_GeomFromText("
                "'LINESTRING M (11.1214 46.0671 0,11.1344 46.0671 300)', 4326),"
                " now(), 1001, 300, now(), '[[0, 1]]')",
                (user["id"], KEY),
            )


# --- The list, a page at a time ---

HOUR_MS = 3_600_000


def five_runs(client: TestClient, me: dict[str, str]) -> list[str]:
    """Five runs an hour apart, saved out of order; their keys, the latest
    first."""
    keys = [f"run{n}key000" for n in range(5)]
    for n in (2, 0, 4, 1, 3):
        body = later(free(), n * HOUR_MS)
        assert (
            client.put(f"/me/activities/{keys[n]}", json=body, headers=me).status_code
            == 201
        )
    return keys[::-1]


def test_the_pages_neither_repeat_nor_skip(client: TestClient) -> None:
    me = signed_up(client)
    keys = five_runs(client, me)
    seen: list[str] = []
    cursor: str | None = None
    sizes = []
    while True:
        params: dict[str, Any] = {"limit": 2}
        if cursor is not None:
            params["cursor"] = cursor
        page = client.get("/me/activities", params=params, headers=me)
        assert page.status_code == 200
        assert page.json()["total"] == 5
        seen += ids(page)
        sizes.append(len(ids(page)))
        cursor = page.json()["next"]
        if cursor is None:
            break
    assert seen == keys
    assert sizes == [2, 2, 1]


def test_the_latest_run_comes_first_whenever_it_was_sent(
    client: TestClient, wall: WallClock
) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=later(free(), HOUR_MS), headers=me)
    # A run of before, left on the phone without a network and sent after.
    wall.t += timedelta(days=1)
    client.put(f"/me/activities/{OTHER_KEY}", json=free(), headers=me)
    assert ids(client.get("/me/activities", headers=me)) == [KEY, OTHER_KEY]


def test_a_page_stays_right_when_the_list_changes(client: TestClient) -> None:
    me = signed_up(client)
    keys = five_runs(client, me)
    first = client.get("/me/activities", params={"limit": 2}, headers=me)
    assert ids(first) == keys[:2]
    # The last run of the page is deleted and a newer one is saved.
    client.delete(f"/me/activities/{keys[1]}", headers=me)
    client.put(
        "/me/activities/newestkey00", json=later(free(), 9 * HOUR_MS), headers=me
    )
    second = client.get(
        "/me/activities",
        params={"limit": 2, "cursor": first.json()["next"]},
        headers=me,
    )
    assert ids(second) == keys[2:4]
    assert second.json()["total"] == 5


def test_a_cursor_past_every_run_is_the_first_page(client: TestClient) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=free(), headers=me)
    # As far ahead as a cursor may say, and as far back.
    ahead = client.get(
        "/me/activities", params={"cursor": "99999999999999999-1"}, headers=me
    )
    assert ahead.status_code == 200 and ids(ahead) == [KEY]
    behind = client.get("/me/activities", params={"cursor": "0-0"}, headers=me)
    assert behind.status_code == 200 and ids(behind) == []
    assert behind.json()["total"] == 1


def test_runs_begun_together_are_each_on_one_page(client: TestClient) -> None:
    me = signed_up(client)
    keys = [f"same{n}key000" for n in range(3)]
    for key in keys:
        client.put(f"/me/activities/{key}", json=free(), headers=me)
    first = client.get("/me/activities", params={"limit": 2}, headers=me)
    second = client.get(
        "/me/activities",
        params={"limit": 2, "cursor": first.json()["next"]},
        headers=me,
    )
    assert sorted(ids(first) + ids(second)) == keys
    assert second.json()["next"] is None


@pytest.mark.parametrize(
    "params",
    [
        {"limit": 0},
        {"limit": 51},
        {"cursor": "yesterday"},
        {"cursor": "12-"},
        # More microseconds than a date holds.
        {"cursor": "999999999999999999-1"},
    ],
)
def test_a_page_that_is_not_one_is_refused(
    client: TestClient, params: dict[str, Any]
) -> None:
    me = signed_up(client)
    answer = client.get("/me/activities", params=params, headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"


# --- The place ---


def test_the_place_is_asked_a_kilometre_wide(
    client: TestClient, service: PlaceService
) -> None:
    me = signed_up(client)
    track = [
        {"point": [46.0671234, 11.1214567], "time_ms": 1790000000000},
        {"point": [46.0681234, 11.1224567], "time_ms": 1790000060000},
    ]
    run = client.put(f"/me/activities/{KEY}", json=free(track=track), headers=me)
    assert run.json()["place"] == "Trento"
    assert len(service.urls) == 1
    url = service.urls[0]
    assert "lat=46.07&lon=11.12&" in url
    assert "type=city" in url and f"apiKey={PLACE_KEY}" in url
    # Never the start itself.
    assert "46.067" not in url and "11.121" not in url


def test_runs_from_the_same_place_ask_once(
    client: TestClient, service: PlaceService
) -> None:
    me = signed_up(client)
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    again = client.put(
        f"/me/activities/{OTHER_KEY}", json=later(free(), HOUR_MS), headers=me
    )
    assert again.json()["place"] == "Trento"
    assert len(service.urls) == 1
    # Nor does a run already saved.
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert len(service.urls) == 1


def test_a_run_is_saved_without_its_place(
    client: TestClient, service: PlaceService
) -> None:
    me = signed_up(client)
    service.down = True
    saved = client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert saved.status_code == 201
    assert saved.json()["place"] is None
    # A service that failed is asked again by the next run.
    service.down = False
    found = client.put(
        f"/me/activities/{OTHER_KEY}", json=later(free(), HOUR_MS), headers=me
    )
    assert found.json()["place"] == "Trento"
    # In the middle of a lake there is no town: no name, and a run all the same.
    service.answer = {"results": []}
    nowhere = [
        {"point": [45.6, 10.6], "time_ms": 1790000000000},
        {"point": [45.601, 10.601], "time_ms": 1790000060000},
    ]
    lake = client.put(
        "/me/activities/lakekey0000", json=free(track=nowhere), headers=me
    )
    assert lake.status_code == 201
    assert lake.json()["place"] is None


def test_without_a_key_no_place_is_asked(database: Database, wall: WallClock) -> None:
    service = PlaceService()
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    client = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=accounts,
            run_places=PlaceNames(None, fetch=service),
        )
    )
    me = signed_up(client)
    saved = client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert saved.status_code == 201
    assert saved.json()["place"] is None
    assert service.urls == []


def test_the_key_comes_from_the_environment() -> None:
    assert PlaceNames.from_env({"GEOAPIFY_API_KEY": " abc "}).key == "abc"
    assert PlaceNames.from_env({}).key is None


# --- Whose they are ---


def test_activities_need_an_account(client: TestClient) -> None:
    for answer in (
        client.get("/me/activities"),
        client.get(f"/me/activities/{KEY}"),
        client.put(f"/me/activities/{KEY}", json=request()),
        client.delete(f"/me/activities/{KEY}"),
    ):
        assert answer.status_code == 401
        assert code(answer) == "not_signed_in"


def test_an_account_sees_only_its_own(client: TestClient) -> None:
    me = signed_up(client)
    them = other(client)
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    assert client.get("/me/activities", headers=them).json() == {
        "activities": [],
        "next": None,
        "total": 0,
    }
    assert client.get(f"/me/activities/{KEY}", headers=them).status_code == 404
    # Deleting under the same key deletes nothing of another account.
    assert client.delete(f"/me/activities/{KEY}", headers=them).status_code == 204
    assert client.get(f"/me/activities/{KEY}", headers=me).status_code == 200
    # The same key in two accounts is two runs.
    assert (
        client.put(f"/me/activities/{KEY}", json=free(), headers=them).status_code
        == 201
    )
    assert client.get("/me/activities", headers=me).json()["total"] == 1


def test_deleting_the_account_deletes_its_runs(
    client: TestClient, database: Database
) -> None:
    me = signed_up(client)
    them = other(client)
    client.put(f"/me/activities/{KEY}", json=request(), headers=me)
    client.put(f"/me/activities/{OTHER_KEY}", json=later(free(), HOUR_MS), headers=me)
    client.put(f"/me/activities/{KEY}", json=request(), headers=them)
    assert client.delete("/me", headers=me).status_code == 204
    with database.connect() as conn:
        left = conn.execute(
            "SELECT count(*) AS n, count(DISTINCT user_id) AS owners FROM runs"
        ).fetchone()
    assert left is not None and (left["n"], left["owners"]) == (1, 1)
    assert client.get("/me/activities", headers=them).json()["total"] == 1


# --- What is refused ---

FIX = {"point": [46.0671, 11.1214], "time_ms": 1790000000000}


@pytest.mark.parametrize(
    "changes",
    [
        {"track": []},
        {"track": [FIX]},
        {"track": [FIX, {"point": [96.0, 11.0], "time_ms": 1790000060000}]},
        {"track": [FIX, {"point": [46.0, 191.0], "time_ms": 1790000060000}]},
        {"track": [FIX, {"point": [46.0, 11.0]}]},
        {"track": [FIX] * (MAX_TRACK_FIXES + 1)},
        {"points": None},
        {"similarity": None},
        {"similarity": 1.2},
        {"points": [[46.0671, 11.1214]]},
        {"points": [[96.0, 11.0], [46.0, 11.0]]},
        {"pauses": [{"from_ms": 1790000360000, "to_ms": 1790000300000}]},
        {"pauses": [{"from_ms": 1790000300000}]},
        {"pauses": [{"from_ms": 1790000300000, "to_ms": 1790000360000, "by": "me"}]},
        {"style": "italic"},
        {"title": "x" * 61},
        {"user_id": 1},
        {"place": "Trento"},
        {"started_at": "2026-10-02T08:30:00Z"},
    ],
)
def test_a_run_that_is_not_one_is_refused(
    client: TestClient, changes: dict[str, Any]
) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/activities/{KEY}", json=request(**changes), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/activities", headers=me).json()["total"] == 0


def test_a_track_with_nothing_to_believe_is_refused(client: TestClient) -> None:
    me = signed_up(client)
    # Every fix after the first too uncertain: one position is not a line.
    track = [
        FIX,
        {"point": [46.0681, 11.1214], "time_ms": 1790000060000, "accuracy_m": 80.0},
        {"point": [46.0691, 11.1214], "time_ms": 1790000120000, "accuracy_m": 80.0},
    ]
    answer = client.put(f"/me/activities/{KEY}", json=free(track=track), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert "1 usable positions" in answer.json()["error"]["message"]


@pytest.mark.parametrize(
    "start_ms",
    [
        0,  # seconds since the phone was turned on, not a date
        1500000000000,  # 2017
        1790000000000 + 30 * 24 * HOUR_MS,  # a month after the test's today
        1e300,
    ],
)
def test_a_run_of_no_clock_is_refused(client: TestClient, start_ms: float) -> None:
    me = signed_up(client)
    track = [
        {"point": [46.0671, 11.1214], "time_ms": start_ms},
        {"point": [46.0681, 11.1214], "time_ms": start_ms + 60_000},
    ]
    answer = client.put(f"/me/activities/{KEY}", json=free(track=track), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"
    assert client.get("/me/activities", headers=me).json()["total"] == 0


@pytest.mark.parametrize("key", ["short", "UPPERCASE1234", "with-dash-1234", "x" * 41])
def test_a_key_that_is_not_one_is_refused(client: TestClient, key: str) -> None:
    me = signed_up(client)
    answer = client.put(f"/me/activities/{key}", json=request(), headers=me)
    assert answer.status_code == 422
    assert code(answer) == "invalid_request"


def test_the_list_has_an_end(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(activities_module, "MAX_ACTIVITIES", 2)
    me = signed_up(client)
    for key in ("activity1", "activity2"):
        assert (
            client.put(f"/me/activities/{key}", json=free(), headers=me).status_code
            == 201
        )
    full = client.put("/me/activities/activity3", json=free(), headers=me)
    assert full.status_code == 422
    assert code(full) == "invalid_request"
    # One already saved is still answered, and room is made by deleting.
    assert (
        client.put("/me/activities/activity1", json=free(), headers=me).status_code
        == 200
    )
    client.delete("/me/activities/activity1", headers=me)
    assert (
        client.put("/me/activities/activity3", json=free(), headers=me).status_code
        == 201
    )


def test_without_a_database_activities_are_off() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    answer = client.get("/me/activities", headers={"Authorization": "Bearer x"})
    assert answer.status_code == 503
    assert code(answer) == "accounts_unavailable"
