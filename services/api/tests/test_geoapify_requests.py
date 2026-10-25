"""Geoapify asked side by side, and once more when it is slow or busy
(TASK-288, ADR-0249). No network: the opener of the URLs and the service
are functions, and a request in a test never waits for a clock."""

from __future__ import annotations

import io
import json
import logging
import threading
import time
import urllib.error
import urllib.parse
from email.message import Message
from typing import Any

import pytest
from test_city_points import (
    LEVICO,
    LEVICO_NODE,
    LEVICO_POINT,
    TENNA,
    TENNA_AREA,
    TENNA_NODE,
    TENNA_VILLAGE,
    Service,
)
from test_nearby_cities import around_caldonazzo

from shaperoute_api.cities import CitySearch
from shaperoute_api.nearby_cities import NearbyCities
from shaperoute_api.places import (
    ATTEMPTS,
    BUSY_RETRY_AFTER_S,
    RETRY_AFTER_S,
    TIMEOUT_S,
    PlacesUnavailableError,
    failure_of,
    fetch_json,
    fetch_together,
)

URL = "https://api.geoapify.com/v1/geocode/search?text=Tenna&apiKey=SECRET"
# Long enough for any machine to reach a barrier; only a failing test waits.
BARRIER_S = 10.0


def http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(URL, code, "no", Message(), None)


class Opener:
    """urlopen: each call the next answer, a JSON body or what it raises."""

    def __init__(self, *answers: Any) -> None:
        self.answers = list(answers)
        self.timeouts: list[float] = []

    def __call__(self, request: Any, timeout: float) -> io.BytesIO:
        self.timeouts.append(timeout)
        answer = self.answers.pop(0)
        if isinstance(answer, BaseException):
            raise answer
        return io.BytesIO(json.dumps(answer).encode())


# --- fetch_json ---


def test_an_answer_is_read_at_once() -> None:
    opener, slept = Opener({"results": []}), []
    assert fetch_json(URL, opener, slept.append) == {"results": []}
    assert opener.timeouts == [TIMEOUT_S] and slept == []


@pytest.mark.parametrize(
    "failure",
    [
        TimeoutError("timed out"),
        urllib.error.URLError(TimeoutError("timed out")),
        ConnectionResetError("reset"),
        http_error(500),
        http_error(503),
    ],
)
def test_a_slow_or_broken_answer_is_asked_again_after_a_moment(
    failure: Exception,
) -> None:
    opener, slept = Opener(failure, {"results": [1]}), []
    assert fetch_json(URL, opener, slept.append) == {"results": [1]}
    assert slept == [RETRY_AFTER_S]
    assert opener.timeouts == [TIMEOUT_S] * 2


def test_a_busy_service_is_asked_again_after_a_second() -> None:
    opener, slept = Opener(http_error(429), {"results": [1]}), []
    assert fetch_json(URL, opener, slept.append) == {"results": [1]}
    assert slept == [BUSY_RETRY_AFTER_S]


@pytest.mark.parametrize("failure", [http_error(400), http_error(401), http_error(404)])
def test_an_answer_that_would_be_the_same_is_not_asked_again(
    failure: Exception,
) -> None:
    opener, slept = Opener(failure, {"results": [1]}), []
    with pytest.raises(urllib.error.HTTPError):
        fetch_json(URL, opener, slept.append)
    assert len(opener.timeouts) == 1 and slept == []


def test_two_failures_raise_and_log_the_status_never_the_key(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="shaperoute_api.places")
    opener = Opener(http_error(503), http_error(502))
    with pytest.raises(urllib.error.HTTPError) as failed:
        fetch_json(URL, opener, lambda s: None)
    assert failed.value.code == 502
    assert len(opener.timeouts) == ATTEMPTS
    assert "HTTP 503" in caplog.text and "HTTP 502" in caplog.text
    assert "SECRET" not in caplog.text and "geocode" not in caplog.text


def test_what_failed_says_no_url() -> None:
    assert failure_of(http_error(429)) == "HTTP 429"
    assert failure_of(urllib.error.URLError(TimeoutError(URL))) == "TimeoutError"
    assert failure_of(urllib.error.URLError(URL)) == "URLError"
    assert failure_of(OSError(URL)) == "OSError"


# --- fetch_together ---


def test_the_urls_are_asked_side_by_side_and_answered_in_order() -> None:
    barrier = threading.Barrier(3, timeout=BARRIER_S)

    def fetch(url: str) -> Any:
        # Only three requests at once reach the end of it.
        barrier.wait()
        return {"url": url}

    assert fetch_together(fetch, ["a", "b", "c"], 3) == [
        {"url": "a"},
        {"url": "b"},
        {"url": "c"},
    ]


def test_a_failure_stays_in_its_place_and_the_others_answer() -> None:
    def fetch(url: str) -> Any:
        if url == "b":
            raise OSError("down")
        return url

    a, b, c = fetch_together(fetch, ["a", "b", "c"], 3)
    assert (a, c) == ("a", "c") and isinstance(b, OSError)
    [alone] = fetch_together(fetch, ["b"], 3)
    assert isinstance(alone, OSError)
    assert fetch_together(fetch, [], 3) == []


def test_never_more_than_the_workers_at_once() -> None:
    lock, at_once, most = threading.Lock(), [0], [0]

    def fetch(url: str) -> Any:
        with lock:
            at_once[0] += 1
            most[0] = max(most[0], at_once[0])
        time.sleep(0.01)
        with lock:
            at_once[0] -= 1
        return url

    assert fetch_together(fetch, list("abcdef"), 2) == list("abcdef")
    assert most[0] <= 2


# --- The cities' areas ---


class Waiting(Service):
    """The Places API answers only when all the areas are asked at once."""

    def __init__(self, areas: int, *args: Any) -> None:
        super().__init__(*args)
        self.barrier = threading.Barrier(areas, timeout=BARRIER_S)

    def __call__(self, url: str) -> Any:
        if "/v2/places" in url:
            self.barrier.wait()
        return super().__call__(url)


def test_the_places_of_the_areas_are_asked_side_by_side() -> None:
    service = Waiting(
        2,
        {"Trentino": [TENNA, LEVICO]},
        {"Tenna": [TENNA_NODE], "Levico Terme": [LEVICO_NODE]},
    )
    found = CitySearch("K", service).search("Trentino")
    # One after the other, the first would never be answered.
    assert [city.point for city in found] == [TENNA_VILLAGE, LEVICO_POINT]


def test_one_area_unanswered_leaves_the_others_at_their_place() -> None:
    asked: list[str] = []

    def service(url: str) -> Any:
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        if "/v1/geocode/search" in url:
            asked.append("cities")
            return {"results": [LEVICO, TENNA]}
        if query["name"] == ["Levico Terme"]:
            raise OSError("down")
        return {"features": [TENNA_NODE]}

    search = CitySearch("K", service)
    # Levico first, unanswered: Tenna, after it, is at its village all the
    # same.
    assert [city.point for city in search.search("Trentino")] == [
        LEVICO_POINT,
        TENNA_VILLAGE,
    ]
    # Not kept: the next search asks again.
    search.search("Trentino")
    assert asked == ["cities", "cities"]


def test_a_name_found_nowhere_is_asked_again() -> None:
    service = Service({"Xyzzy": []})
    search = CitySearch("K", service)
    assert search.search("Xyzzy") == []
    assert search.search("Xyzzy") == []
    assert service.calls == ["cities Xyzzy"] * 2


def test_a_geocoding_unanswered_is_still_the_search_failing() -> None:
    def down(url: str) -> Any:
        raise http_error(503)

    with pytest.raises(PlacesUnavailableError):
        CitySearch("K", down).search("Tenna")
    # The areas at the geocoding's points when the places do not answer.
    service = Service({"Tenna": [TENNA]})
    service.places_down = True
    assert [c.point for c in CitySearch("K", service).search("Tenna")] == [TENNA_AREA]


# --- The towns near a point ---


def test_the_towns_near_a_point_are_asked_side_by_side() -> None:
    service = around_caldonazzo()
    barrier = threading.Barrier(3, timeout=BARRIER_S)

    def waiting(url: str) -> Any:
        barrier.wait()
        return service(url)

    towns = NearbyCities("K", waiting).towns((46.0036, 11.2647))
    assert len(towns) == 6 and len(service.calls) == 3


def test_a_kind_of_town_unanswered_fails_the_list() -> None:
    service = around_caldonazzo()

    def one_down(url: str) -> Any:
        if "populated_place.village" in url:
            raise OSError("down")
        return service(url)

    with pytest.raises(PlacesUnavailableError):
        NearbyCities("K", one_down).towns((46.0036, 11.2647))
