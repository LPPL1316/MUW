"""A walk (TASK-371, ADR-0315): the API's activity "walking", 1-30 km,
drawn as a run on the foot network. The engine itself does not know it
(models.py is as before); `python -m route_engine.walking` draws one from the
command line, as `python -m route_engine` without `--activity`."""

from __future__ import annotations

from collections.abc import Sequence

import pytest

import route_engine.__main__ as cli
from route_engine import walking
from route_engine.models import (
    DISTANCE_LIMITS_M,
    SUPPORTED_ACTIVITIES,
    InvalidRequestError,
    RouteRequest,
)
from route_engine.network import FOOT_NETWORK_NAME, NETWORKS

ARGS = ["--start", "46.0122,11.2986", "--shape", "heart", "--distance", "5000"]


def test_a_walk_is_an_activity_of_the_api_not_of_the_engine() -> None:
    assert walking.API_ACTIVITIES == (*SUPPORTED_ACTIVITIES, "walking")
    assert "walking" not in SUPPORTED_ACTIVITIES
    assert "walking" not in DISTANCE_LIMITS_M
    assert walking.API_DISTANCE_LIMITS_M == {
        **DISTANCE_LIMITS_M,
        "walking": (1_000, 30_000),
    }


def test_a_walk_is_within_the_distances_of_a_run() -> None:
    low, high = walking.WALK_DISTANCE_M
    run_low, run_high = DISTANCE_LIMITS_M[walking.RUN]
    assert run_low <= low and high <= run_high


def test_a_walk_goes_on_the_foot_network_with_no_network_of_its_own() -> None:
    assert walking.drawn_as("walking") == "running"
    assert NETWORKS[walking.drawn_as("walking")] == FOOT_NETWORK_NAME
    assert "walking" not in NETWORKS


@pytest.mark.parametrize("distance", [1_000, 5_000, 30_000])
def test_a_walk_asks_the_engine_for_a_run(distance: int) -> None:
    activity = walking.engine_activity("walking", distance)
    request = RouteRequest(
        start=(46.0122, 11.2986), shape="heart", distance_m=distance, activity=activity
    )
    assert request.activity == "running"


@pytest.mark.parametrize("distance", [0, 999, 30_001])
def test_a_walk_out_of_its_distances_is_refused(distance: int) -> None:
    with pytest.raises(InvalidRequestError, match="for walking"):
        walking.engine_activity("walking", distance)


def test_the_other_activities_are_left_as_they_are() -> None:
    for activity in SUPPORTED_ACTIVITIES:
        assert walking.drawn_as(activity) == activity
        assert walking.engine_activity(activity, 40_000) == activity


def _recording(monkeypatch: pytest.MonkeyPatch) -> list[list[str]]:
    calls: list[list[str]] = []

    def main(argv: Sequence[str] | None = None) -> int:
        calls.append(list(argv or []))
        return 0

    monkeypatch.setattr(cli, "main", main)
    return calls


def test_the_command_line_draws_a_run(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = _recording(monkeypatch)
    assert walking.main(ARGS) == 0
    assert calls == [[*ARGS, "--activity", "running"]]


@pytest.mark.parametrize(
    ("argv", "message"),
    [
        ([*ARGS, "--activity", "cycling"], "a walk is always on foot"),
        ([*ARGS[:-1], "31000"], "1000 and 30000 metres for walking"),
        ([*ARGS[:-2], "--distance=500"], "1000 and 30000 metres for walking"),
    ],
)
def test_the_command_line_refuses_what_is_not_a_walk(
    argv: list[str],
    message: str,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    calls = _recording(monkeypatch)
    assert walking.main(argv) == 2
    assert message in capsys.readouterr().err
    assert calls == []
