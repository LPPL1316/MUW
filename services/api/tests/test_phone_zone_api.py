"""GET /phone-zones/{network} (phone_zone_api.py, TASK-214, ADR-0177)."""

from __future__ import annotations

import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import osmnx as ox
import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api import __main__ as entry
from shaperoute_api.app import create_app
from shaperoute_api.phone_zone_api import install_phone_zones, main, write_all
from shaperoute_api.phone_zone_cap import TrafficCap
from shaperoute_api.phone_zones import SUFFIX, read_zone, zone_name

REPO = Path(__file__).resolve().parents[3]
LEVICO_GRAPH = REPO / "services/route-engine/tests/fixtures/levico_walk_1km.graphml"
BBOX = (45.95, 11.2, 46.07, 11.4)
LEVICO = {"lat": 46.0122, "lon": 11.2986}
AHEAD = {**LEVICO, "prefetch": 1}
PHONE = {"X-Phone-Id": "0123456789abcdef0123456789abcdef"}
OTHER_PHONE = {"X-Phone-Id": "fedcba9876543210fedcba9876543210"}


@pytest.fixture
def cache(tmp_path: Path) -> Path:
    shutil.copy(LEVICO_GRAPH, tmp_path / f"{zone_name('foot', BBOX)}.graphml")
    return tmp_path


@pytest.fixture
def client(cache: Path) -> TestClient:
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache)
    return TestClient(app)


def test_the_zone_around_a_point(client: TestClient, tmp_path: Path) -> None:
    response = client.get("/phone-zones/foot", params=LEVICO)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/gzip"
    name = f"{zone_name('foot', BBOX)}{SUFFIX}"
    assert name in response.headers["content-disposition"]
    assert response.headers["etag"]
    received = tmp_path / "received" / name
    received.parent.mkdir()
    received.write_bytes(response.content)
    graph, _ = read_zone(received)
    expected = ox.load_graphml(LEVICO_GRAPH)  # test_phone_zones checks it all
    assert list(graph.nodes(data=True)) == list(expected.nodes(data=True))
    assert list(graph.edges(keys=True)) == list(expected.edges(keys=True))


def test_a_zone_the_phone_has_is_not_sent_again(client: TestClient) -> None:
    tag = client.get("/phone-zones/foot", params=LEVICO).headers["etag"]
    again = client.get(
        "/phone-zones/foot", params=LEVICO, headers={"If-None-Match": tag}
    )
    assert again.status_code == 304
    assert again.content == b""


def test_a_newer_zone_is_written_again(client: TestClient, cache: Path) -> None:
    tag = client.get("/phone-zones/foot", params=LEVICO).headers["etag"]
    zone = cache / f"{zone_name('foot', BBOX)}.graphml"
    later = zone.stat().st_mtime_ns + 10**10
    os.utime(zone, ns=(later, later))
    again = client.get(
        "/phone-zones/foot", params=LEVICO, headers={"If-None-Match": tag}
    )
    assert again.status_code == 200
    assert again.headers["etag"] != tag


def test_no_zone_around_the_point(client: TestClient) -> None:
    response = client.get("/phone-zones/foot", params={"lat": 45.4642, "lon": 9.19})
    assert response.status_code == 404
    assert "No zone around this point" in response.text


def test_the_other_network_has_its_own_zones(client: TestClient) -> None:
    assert client.get("/phone-zones/bike", params=LEVICO).status_code == 404


@pytest.mark.parametrize(
    ("network", "params", "status"),
    [
        ("water", LEVICO, 404),
        ("..", LEVICO, 404),
        ("foot", {"lat": 91, "lon": 11.3}, 422),
        ("foot", {"lat": 46.0}, 422),
    ],
)
def test_wrong_requests(
    client: TestClient, network: str, params: dict[str, float], status: int
) -> None:
    assert client.get(f"/phone-zones/{network}", params=params).status_code == status


# Inside BBOX: 3.6-4 km around Levico, so 3 km but not 6 (part E).
SMALL_BBOX = (45.98, 11.25, 46.045, 11.35)
SMALL = f"{zone_name('foot', SMALL_BBOX)}{SUFFIX}"
WIDE = f"{zone_name('foot', BBOX)}{SUFFIX}"


def two_zones(cache: Path, wide_max_bytes: int = 12_000_000) -> TestClient:
    """The Levico zone and a smaller one inside it, around the same point."""
    shutil.copy(LEVICO_GRAPH, cache / f"{zone_name('foot', SMALL_BBOX)}.graphml")
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, wide_max_bytes=wide_max_bytes)
    return TestClient(app)


def given(response: Any) -> str:
    disposition: str = response.headers["content-disposition"]
    return disposition.split("filename=")[1].strip('"')


def test_without_a_margin_the_phone_gets_the_smallest_zone(cache: Path) -> None:
    response = two_zones(cache).get("/phone-zones/foot", params=LEVICO)
    assert response.status_code == 200
    assert given(response) == SMALL


def test_a_wider_margin_gets_the_zone_holding_it(cache: Path) -> None:
    client = two_zones(cache)
    response = client.get("/phone-zones/foot", params={**LEVICO, "margin_m": 6000})
    assert response.status_code == 200
    assert given(response) == WIDE


def test_a_wider_zone_too_large_for_the_phone_is_not_given(cache: Path) -> None:
    client = two_zones(cache, wide_max_bytes=1000)
    response = client.get("/phone-zones/foot", params={**LEVICO, "margin_m": 6000})
    assert response.status_code == 200
    assert given(response) == SMALL


def test_a_margin_no_zone_holds_gives_the_usual_zone(cache: Path) -> None:
    client = two_zones(cache)
    response = client.get("/phone-zones/foot", params={**LEVICO, "margin_m": 10000})
    assert response.status_code == 200
    assert given(response) == SMALL


def test_any_zone_the_phone_has_there_is_not_sent_again(cache: Path) -> None:
    client = two_zones(cache)
    wide = {**LEVICO, "margin_m": 6000}
    small_tag = client.get("/phone-zones/foot", params=LEVICO).headers["etag"]
    wide_tag = client.get("/phone-zones/foot", params=wide).headers["etag"]
    assert small_tag != wide_tag
    again = client.get(
        "/phone-zones/foot",
        params=wide,
        headers={"If-None-Match": f"{small_tag}, W/{wide_tag}"},
    )
    assert again.status_code == 304
    assert again.headers["etag"] == wide_tag
    # As the app of part E asks: the smallest zone's ETag where a server
    # before it looks, the others beside.
    beside = client.get(
        "/phone-zones/foot",
        params=wide,
        headers={"If-None-Match": small_tag, "X-Zone-ETags": wide_tag},
    )
    assert beside.status_code == 304
    assert beside.headers["etag"] == wide_tag
    other = client.get(
        "/phone-zones/foot", params=wide, headers={"If-None-Match": small_tag}
    )
    assert other.status_code == 200


@pytest.mark.parametrize("margin_m", [2999, 10001])
def test_a_margin_out_of_bounds_is_refused(client: TestClient, margin_m: int) -> None:
    response = client.get("/phone-zones/foot", params={**LEVICO, "margin_m": margin_m})
    assert response.status_code == 422


def capped_client(cache: Path, zones: float, total: float = 100) -> TestClient:
    """`zones` of the Levico zone a day for each phone, `total` in all, at
    18:00 UTC."""
    size = len(TestClient(_app(cache)).get("/phone-zones/foot", params=LEVICO).content)
    cap = TrafficCap(
        per_phone=int(size * zones),
        total=int(size * total),
        clock=lambda: datetime(2026, 10, 5, 18, 0, tzinfo=UTC),
    )
    return TestClient(_app(cache, cap))


def _app(cache: Path, cap: TrafficCap | None = None) -> Any:
    app = create_app(FileSource(LEVICO_GRAPH))
    install_phone_zones(app, cache, cap)
    return app


def test_a_zone_downloaded_ahead_counts_against_the_phones_cap(cache: Path) -> None:
    client = capped_client(cache, zones=2)
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 200
    )
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 200
    )
    refused = client.get("/phone-zones/foot", params=AHEAD, headers=PHONE)
    assert refused.status_code == 429
    assert refused.headers["retry-after"] == str(6 * 3600)  # to midnight UTC
    error = refused.json()["error"]
    assert error["code"] == "too_many_requests"
    assert error["message"] == "Enough maps downloaded ahead today: try again tomorrow."
    other = client.get("/phone-zones/foot", params=AHEAD, headers=OTHER_PHONE)
    assert other.status_code == 200


def test_the_zone_around_the_phone_is_always_given(cache: Path) -> None:
    client = capped_client(cache, zones=1, total=1)
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 200
    )
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 429
    )
    for _ in range(3):  # without prefetch=1: never counted, never refused
        assert (
            client.get("/phone-zones/foot", params=LEVICO, headers=PHONE).status_code
            == 200
        )
    params = {**LEVICO, "prefetch": 0}
    assert (
        client.get("/phone-zones/foot", params=params, headers=PHONE).status_code == 200
    )


def test_the_server_gives_zones_ahead_up_to_its_cap(cache: Path) -> None:
    client = capped_client(cache, zones=5, total=1)
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 200
    )
    refused = client.get("/phone-zones/foot", params=AHEAD, headers=OTHER_PHONE)
    assert refused.status_code == 429
    assert refused.headers["retry-after"] == str(6 * 3600)


def test_a_zone_the_phone_has_costs_nothing_even_beyond_the_cap(cache: Path) -> None:
    client = capped_client(cache, zones=1)
    tag = client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).headers["etag"]
    for _ in range(3):
        again = client.get(
            "/phone-zones/foot", params=AHEAD, headers={**PHONE, "If-None-Match": tag}
        )
        assert again.status_code == 304


def test_no_zone_ahead_is_still_404(cache: Path) -> None:
    client = capped_client(cache, zones=0, total=0)
    params = {"lat": 45.4642, "lon": 9.19, "prefetch": 1}
    assert (
        client.get("/phone-zones/foot", params=params, headers=PHONE).status_code == 404
    )


def test_phones_without_an_id_count_by_address(cache: Path) -> None:
    client = capped_client(cache, zones=1)
    assert client.get("/phone-zones/foot", params=AHEAD).status_code == 200
    assert client.get("/phone-zones/foot", params=AHEAD).status_code == 429
    assert (
        client.get("/phone-zones/foot", params=AHEAD, headers=PHONE).status_code == 200
    )


def test_the_api_started_from_the_command_line_has_it(
    monkeypatch: pytest.MonkeyPatch, cache: Path
) -> None:
    served: dict[str, Any] = {}

    def run(app: Any, host: str, port: int) -> None:
        served["app"] = app

    monkeypatch.setattr(entry.uvicorn, "run", run)
    entry.main(["--cache-dir", str(cache)])
    client = TestClient(served["app"])
    assert client.get("/phone-zones/foot", params=LEVICO).status_code == 200


def test_the_server_starts_the_api_from_the_command_line() -> None:
    """The server runs `python -m shaperoute_api` (Dockerfile, compose.yaml):
    main() installs /phone-zones; create_app alone would not."""
    dockerfile = (REPO / "Dockerfile").read_text(encoding="utf-8")
    assert 'CMD ["python", "-m", "shaperoute_api", ' in dockerfile
    compose = (REPO / "deploy/compose.yaml").read_text(encoding="utf-8")
    assert "- python\n      - -m\n      - shaperoute_api\n" in compose


def test_every_cached_zone_written_ahead(
    cache: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    (cache / "bike_x.graphml").touch()  # not a zone name: left alone
    main(["--cache-dir", str(cache)])
    phone = cache / f"{zone_name('foot', BBOX)}{SUFFIX}"
    assert phone.exists()
    assert f"{phone.name}: " in capsys.readouterr().out
    written = phone.stat().st_mtime_ns
    assert write_all(cache) == [phone]
    assert phone.stat().st_mtime_ns == written  # up to date: not written again
