"""The request log and its replay (TASK-090, ADR-0085): what is written for
a shape, a word and an image, what never is, and the request redone."""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from route_engine.models import RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import GraphLoader, Plan, ShapeNotDrawableError

from shaperoute_api import __main__ as entry
from shaperoute_api import replay
from shaperoute_api.access import KEY_HEADER, KEY_VARIABLE
from shaperoute_api.app import create_app, to_request
from shaperoute_api.images import AnyRequest
from shaperoute_api.request_log import (
    FILE_NAME,
    OLD_FILE_NAME,
    ON_VARIABLE,
    RequestLog,
    fingerprint,
    read_entries,
    wanted,
)
from shaperoute_api.schemas import ImageRouteRequestBody, RouteRequestBody

START = [45.9934, 11.258]
HEART = {"start": START, "shape": "heart", "distance_m": 10000}
WORD = {"start": START, "word": "ciao", "distance_m": 12000, "style": "block"}
IMAGE = {
    "start": START,
    "outline": [[-1.0, -1.0], [1.0, -1.0], [1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0]],
    "strokes": [[[1.0, 1.0], [0.5, 0.5]]],
    "distance_m": 15000,
}
RESULT = RouteResult(
    points=[(45.9934, 11.258), (45.9940, 11.259), (45.9934, 11.258)],
    distance_m=10234.56,
    similarity=0.87654,
    shape="heart",
)
WHEN = datetime(2026, 9, 30, 12, 0, 0, tzinfo=UTC)
KEY = "a-key-of-the-tests-0123456789"


class Planner:
    """Answers or raises, and remembers the requests the engine was given."""

    def __init__(self, outcome: RouteResult | Exception = RESULT) -> None:
        self.outcome = outcome
        self.requests: list[AnyRequest] = []

    def __call__(self, request: AnyRequest, source: GraphLoader) -> Plan:
        self.requests.append(request)
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return Plan(result=self.outcome, search=None)


SOURCE = FileSource(Path("unused.graphml"))


@pytest.fixture
def api(tmp_path: Path) -> Iterator[Any]:
    clients: list[TestClient] = []

    def make(planner: Planner, directory: Path = tmp_path, **log_options: Any):
        request_log = RequestLog(directory, now=lambda: WHEN, **log_options)
        client = TestClient(create_app(SOURCE, planner, request_log=request_log))
        client.__enter__()
        clients.append(client)
        return client

    yield make
    for client in clients:
        client.__exit__(None, None, None)


def finished(client: TestClient, job_id: str) -> dict[str, Any]:
    deadline = time.monotonic() + 5
    while True:
        body: dict[str, Any] = client.get(f"/route-jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        assert time.monotonic() < deadline, body
        time.sleep(0.01)


def lines(path: Path, count: int = 1) -> list[dict[str, Any]]:
    """The log's lines, once the job's thread has written `count` of them:
    the line comes after the job's answer."""
    deadline = time.monotonic() + 5
    while True:
        entries = read_entries(path) if path.exists() else []
        if len(entries) >= count:
            return entries
        assert time.monotonic() < deadline, entries
        time.sleep(0.01)


def run_job(client: TestClient, url: str, body: dict[str, Any]) -> dict[str, Any]:
    response = client.post(url, json=body)
    assert response.status_code == 202, response.text
    return finished(client, response.json()["job_id"])


def test_a_shape_is_recorded_with_its_request_and_its_outcome(
    api: Any, tmp_path: Path
) -> None:
    job = run_job(api(Planner()), "/route-jobs", HEART)
    [line] = lines(tmp_path / FILE_NAME)
    assert line["time"] == "2026-09-30T12:00:00+00:00"
    assert line["kind"] == "shape"
    assert line["job_id"] == job["job_id"]
    assert line["request"] == {
        "start": START,
        "shape": "heart",
        "word": None,
        "distance_m": 10000,
        "activity": "running",
        "style": "round",
        "pen_up": False,  # TASK-197
        "near": None,  # TASK-238
        "placement": "free",  # TASK-347
        "fit": None,
    }
    outcome = line["outcome"]
    assert outcome.pop("elapsed_s") >= 0
    assert outcome == {
        "status": "done",
        "distance_m": 10234.6,
        "similarity": 0.8765,
        "points": 3,
        "route": fingerprint(RESULT.points),
        "alternatives": [],
    }


def test_a_word_is_recorded_with_its_style(api: Any, tmp_path: Path) -> None:
    run_job(api(Planner()), "/route-jobs", WORD)
    [line] = lines(tmp_path / FILE_NAME)
    assert line["kind"] == "word"
    assert line["request"]["word"] == "ciao"
    assert line["request"]["style"] == "block"


def test_an_image_is_recorded_with_its_outline_and_strokes(
    api: Any, tmp_path: Path
) -> None:
    run_job(api(Planner()), "/image-route-jobs", IMAGE)
    [line] = lines(tmp_path / FILE_NAME)
    assert line["kind"] == "image"
    assert line["request"]["outline"] == IMAGE["outline"]
    assert line["request"]["strokes"] == IMAGE["strokes"]
    assert line["request"]["start"] == START


def test_a_failed_job_is_recorded_with_the_code_of_its_error(
    api: Any, tmp_path: Path
) -> None:
    planner = Planner(ShapeNotDrawableError("a 10 km heart cannot be drawn here"))
    job = run_job(api(planner), "/route-jobs", HEART)
    assert job["status"] == "failed"
    [line] = lines(tmp_path / FILE_NAME)
    assert line["outcome"].pop("elapsed_s") >= 0
    assert line["outcome"] == {"status": "failed", "code": "shape_not_drawable"}
    # The message may name places: the code is enough.
    assert "cannot be drawn" not in (tmp_path / FILE_NAME).read_text()


def test_the_one_go_route_is_recorded_without_a_job(api: Any, tmp_path: Path) -> None:
    assert api(Planner()).post("/routes", json=HEART).status_code == 200
    [line] = lines(tmp_path / FILE_NAME)
    assert line["job_id"] is None
    assert line["outcome"]["status"] == "done"


def test_a_request_that_is_not_valid_is_not_recorded(api: Any, tmp_path: Path) -> None:
    client = api(Planner())
    assert (
        client.post("/route-jobs", json={**HEART, "distance_m": 1}).status_code == 422
    )
    run_job(client, "/route-jobs", HEART)
    assert len(lines(tmp_path / FILE_NAME)) == 1


def test_neither_the_picture_nor_the_key_nor_a_header_reaches_the_file(
    api: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(KEY_VARIABLE, KEY)
    client = api(Planner())
    headers = {KEY_HEADER: KEY, "User-Agent": "the-phone-of-the-tests"}
    picture = "QUJDREVGR0hJSktMTU5PUA=="
    # The picture is refused or traced, never written.
    client.post("/image-outlines", json={"image": picture}, headers=headers)
    client.post(
        "/image-outline-edits",
        json={"points": IMAGE["outline"], "line": [[0, 0], [1, 1]], "mode": "part"},
        headers=headers,
    )
    response = client.post("/image-route-jobs", json=IMAGE, headers=headers)
    assert response.status_code == 202, response.text
    finished_job = client.get(
        f"/route-jobs/{response.json()['job_id']}", headers=headers
    )
    assert finished_job.status_code == 200
    [line] = lines(tmp_path / FILE_NAME)
    assert set(line) == {"time", "kind", "job_id", "request", "outcome"}
    assert set(line["request"]) == set(ImageRouteRequestBody.model_fields)
    text = (tmp_path / FILE_NAME).read_text()
    for secret in (KEY, KEY_HEADER, "the-phone-of-the-tests", picture, 'image":"'):
        assert secret not in text


def test_the_file_is_for_its_owner_only(api: Any, tmp_path: Path) -> None:
    run_job(api(Planner(), tmp_path / "requests"), "/route-jobs", HEART)
    path = tmp_path / "requests" / FILE_NAME
    lines(path)
    assert path.stat().st_mode & 0o077 == 0


def test_a_file_that_cannot_be_written_does_not_stop_the_request(
    api: Any, tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    blocked = tmp_path / "not-a-directory"
    blocked.write_text("a file where the directory should be")
    client = api(Planner(), blocked)
    with caplog.at_level(logging.WARNING, logger="shaperoute_api.request_log"):
        job = run_job(client, "/route-jobs", HEART)
        assert job["status"] == "done"
        assert job["result"]["distance_m"] == RESULT.distance_m
        assert client.post("/routes", json=HEART).status_code == 200
        deadline = time.monotonic() + 5
        while len(caplog.records) < 2:
            assert time.monotonic() < deadline
            time.sleep(0.01)
    for record in caplog.records:
        message = record.getMessage()
        assert "not written" in message
        # The warning must not carry the start to the API log.
        assert "45.99" not in message and "11.25" not in message


def test_a_listener_that_raises_leaves_the_job_done(tmp_path: Path) -> None:
    from shaperoute_api.jobs import RouteJobs

    def broken(*_: object) -> None:
        raise RuntimeError("the disk is gone")

    jobs = RouteJobs(SOURCE, Planner(), on_end=broken)
    try:
        job_id = jobs.submit(to_request(RouteRequestBody(**HEART)), dict(HEART)).job_id
        deadline = time.monotonic() + 5
        while (job := jobs.get(job_id)) is None or job.status != "done":
            assert time.monotonic() < deadline
            time.sleep(0.01)
        assert job.result == RESULT
    finally:
        jobs.shutdown()


def test_the_file_is_replaced_when_full_and_one_older_file_is_kept(
    tmp_path: Path,
) -> None:
    request_log = RequestLog(tmp_path, max_bytes=1000, now=lambda: WHEN)
    for _ in range(40):
        request_log.record(HEART, RESULT, None, 1.0, "job")
    files = sorted(path.name for path in tmp_path.iterdir())
    assert files == sorted([FILE_NAME, OLD_FILE_NAME])
    for name in files:
        assert 0 < (tmp_path / name).stat().st_size <= 1000
        assert read_entries(tmp_path / name)  # whole lines only


def test_the_log_is_off_unless_asked_for() -> None:
    assert not wanted(False, {})
    assert not wanted(False, {ON_VARIABLE: "0"})
    assert not wanted(False, {ON_VARIABLE: ""})
    assert wanted(True, {})
    assert wanted(False, {ON_VARIABLE: "1"})
    assert wanted(False, {ON_VARIABLE: "TRUE"})


def test_the_api_starts_without_a_log_and_says_so(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str], tmp_path: Path
) -> None:
    made: list[Any] = []

    def fake_create_app(source: object, **options: Any) -> FastAPI:
        made.append(options["request_log"])
        return FastAPI()  # main() adds the phone zones to it (TASK-214)

    monkeypatch.setattr(entry, "create_app", fake_create_app)
    monkeypatch.setattr(entry.uvicorn, "run", lambda *_, **__: None)
    monkeypatch.delenv(ON_VARIABLE, raising=False)

    entry.main([])
    assert made[-1] is None
    assert "not recorded" in capsys.readouterr().out

    entry.main(["--request-log", "--request-log-dir", str(tmp_path)])
    assert made[-1].path == tmp_path / FILE_NAME
    assert str(tmp_path / FILE_NAME) in capsys.readouterr().out

    monkeypatch.setenv(ON_VARIABLE, "1")
    entry.main(["--request-log-dir", str(tmp_path)])
    assert made[-1].path == tmp_path / FILE_NAME


@pytest.mark.parametrize(
    ("url", "body"),
    [("/route-jobs", HEART), ("/route-jobs", WORD), ("/image-route-jobs", IMAGE)],
)
def test_a_request_redone_from_the_file_is_the_same_request_to_the_engine(
    api: Any, tmp_path: Path, url: str, body: dict[str, Any]
) -> None:
    first = Planner()
    run_job(api(first), url, body)
    [line] = lines(tmp_path / FILE_NAME)

    again = Planner()
    assert replay.replay(line, SOURCE, again) == RESULT
    assert again.requests == first.requests
    assert len(again.requests) == 1


def test_the_replay_says_whether_the_route_is_the_recorded_one(
    api: Any, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    client = api(Planner())
    run_job(client, "/route-jobs", HEART)
    second = run_job(client, "/route-jobs", WORD)
    path = tmp_path / FILE_NAME
    lines(path, 2)
    gpx = tmp_path / "again.gpx"

    replay.main(["--file", str(path), "--gpx", str(gpx)], SOURCE, Planner())
    out = capsys.readouterr().out
    assert second["job_id"] in out  # the last line, without --job or --line
    assert "The same route as recorded, point for point." in out
    assert "<trkpt" in gpx.read_text()

    other = RouteResult(
        points=[(45.9934, 11.258), (45.9941, 11.259), (45.9934, 11.258)],
        distance_m=10234.56,
        similarity=0.87654,
        shape="heart",
    )
    with pytest.raises(SystemExit) as stopped:
        replay.main(["--file", str(path), "--line", "1"], SOURCE, Planner(other))
    assert stopped.value.code == 1
    assert "NOT what was recorded" in capsys.readouterr().out

    replay.main(["--file", str(path), "--list"], SOURCE, Planner())
    listed = capsys.readouterr().out.splitlines()
    assert len(listed) == 2
    assert "heart, 10000 m from 45.99340, 11.25800" in listed[0]
    assert "word ciao (block)" in listed[1]


def test_a_line_cut_short_is_skipped(tmp_path: Path) -> None:
    path = tmp_path / FILE_NAME
    RequestLog(tmp_path, now=lambda: WHEN).record(HEART, RESULT, None, 1.0, "whole")
    with path.open("a") as file:
        file.write('{"time": "2026-09-30T12:00:01+00:00", "kind": "sha')
    assert [line["job_id"] for line in read_entries(path)] == ["whole"]
    assert json.loads(path.read_text().splitlines()[0])["job_id"] == "whole"
