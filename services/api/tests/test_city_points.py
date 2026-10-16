"""A place has one point: OpenStreetMap's own for it (TASK-249, ADR-0213).
No network: the answers are cut from Geoapify's geocoding and Places, as
they came on 2026-10-06 for Tenna, Levico Terme and Milan."""

from __future__ import annotations

import urllib.parse
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.app import create_app
from shaperoute_api.cities import (
    GEOCODE_URL,
    MAX_NODES,
    NODES,
    PLACES_URL,
    CitySearch,
    node_point,
    node_url,
    place_label,
)
from shaperoute_api.nearby_cities import NearbyCities, install_nearby_cities
from shaperoute_api.places import PlacesUnavailableError
from shaperoute_api.route_store import RouteStore, cell

HERE = Path(__file__).parent
TRENTINO = "Trentino – Alto Adige/Südtirol"
TENNA_LABEL = f"Tenna, {TRENTINO}, Italy"
# The middle of the municipality's area, and the village: 650 m apart.
TENNA_AREA = (46.0215385, 11.2599038)
TENNA_VILLAGE = (46.015703, 11.264283)
LEVICO_POINT = (46.0091259, 11.3017774)
MILAN_POINT = (45.4641943, 9.1896346)


def area(
    name: str,
    state: str,
    point: tuple[float, float],
    box: tuple[float, float, float, float],
) -> dict[str, Any]:
    """A municipality as the geocoding gives it: an area and its bounds."""
    return {
        "name": name,
        "city": name,
        "state": state,
        "country": "Italy",
        "lat": point[0],
        "lon": point[1],
        "result_type": "city",
        "category": "administrative",
        "bbox": dict(zip(("lon1", "lat1", "lon2", "lat2"), box, strict=True)),
    }


def node(
    name: str, city: str, state: str, point: tuple[float, float], country: str = "Italy"
) -> dict[str, Any]:
    """One of the Places API's places: `city` is the municipality around."""
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "city": city,
            "state": state,
            "country": country,
            "lat": point[0],
            "lon": point[1],
        },
    }


TENNA = area(
    "Tenna", TRENTINO, TENNA_AREA, (11.2459242, 46.0089954, 11.2765214, 46.0337447)
)
# A village of the same name in Switzerland: a place already, in Safiental.
TENNA_CH = {
    "name": "Tenna",
    "city": "Safiental",
    "state": "Grisons",
    "country": "Switzerland",
    "lat": 46.7469787,
    "lon": 9.3390283,
    "result_type": "city",
    "category": "populated_place",
    "bbox": {
        "lon1": 9.3190283,
        "lat1": 46.7269787,
        "lon2": 9.3590283,
        "lat2": 46.7669787,
    },
}
LEVICO = area(
    "Levico Terme",
    TRENTINO,
    LEVICO_POINT,
    (11.2648807, 45.9421573, 11.3835036, 46.0499915),
)
MILAN = area(
    "Milan", "Lombardy", MILAN_POINT, (9.0408867, 45.3867381, 9.2781103, 45.5358482)
)

TENNA_NODE = node("Tenna", "Tenna", TRENTINO, TENNA_VILLAGE)
# In Tenna's bounds too: a village of Pergine Valsugana.
ISCHIA_NODE = node("Ischia", "Pergine Valsugana", TRENTINO, (46.0327785, 11.2472099))
LEVICO_NODE = node("Levico Terme", "Levico Terme", TRENTINO, LEVICO_POINT)
# The service's own names: "Milano", in the municipality of "Milan".
MILAN_NODES = [
    node("Novate Milanese", "Novate Milanese", "Lombardy", (45.5316547, 9.1407322)),
    node("Milano", "Milan", "Lombardy", MILAN_POINT),
]


class Service:
    """Geoapify: the geocoding's cities for a name, the places of an area."""

    def __init__(
        self, cities: dict[str, list[Any]], nodes: dict[str, list[Any]] | None = None
    ) -> None:
        self.cities = cities
        self.nodes = nodes or {}
        self.calls: list[str] = []
        self.places_down = False

    def __call__(self, url: str) -> Any:
        base = url.split("?", 1)[0]
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        if base == GEOCODE_URL:
            self.calls.append(f"cities {query['text'][0]}")
            return {"results": self.cities[query["text"][0]]}
        assert base == PLACES_URL
        self.calls.append(f"places {query['name'][0]}")
        if self.places_down:
            raise OSError(url)
        return {"type": "FeatureCollection", "features": self.nodes[query["name"][0]]}


def tenna() -> Service:
    return Service({"Tenna": [TENNA, TENNA_CH]}, {"Tenna": [TENNA_NODE]})


def test_an_area_asks_the_places_named_as_it_is_within_its_bounds() -> None:
    url = node_url("K", TENNA)
    assert url is not None and url.startswith(f"{PLACES_URL}?")
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    assert query == {
        "categories": [NODES],
        "conditions": ["named"],
        "name": ["Tenna"],
        "filter": ["rect:11.2459242,46.0089954,11.2765214,46.0337447"],
        "bias": ["proximity:11.2599038,46.0215385"],
        "limit": [str(MAX_NODES)],
        "apiKey": ["K"],
    }


def test_a_place_already_asks_nothing() -> None:
    assert node_url("K", TENNA_CH) is None
    # Before the service said which: as it was.
    assert node_url("K", {k: v for k, v in TENNA.items() if k != "category"}) is None


@pytest.mark.parametrize(
    "bounds",
    [
        None,
        {},
        {"lon1": 11.2, "lat1": 46.0, "lon2": 11.3},
        {**TENNA["bbox"], "lat2": "46"},
    ],
)
def test_an_area_whose_bounds_do_not_read_asks_nothing(bounds: Any) -> None:
    assert node_url("K", {**TENNA, "bbox": bounds}) is None


def test_the_point_is_of_the_place_with_the_same_label() -> None:
    body = {"features": [ISCHIA_NODE, TENNA_NODE]}
    assert place_label(TENNA_NODE["properties"]) == TENNA_LABEL
    assert node_point(TENNA_LABEL, body) == TENNA_VILLAGE
    # No place named as the area: nothing to move to.
    assert node_point(TENNA_LABEL, {"features": [ISCHIA_NODE]}) is None
    assert node_point(TENNA_LABEL, {"features": []}) is None
    assert node_point(TENNA_LABEL, {"results": [TENNA]}) is None
    assert node_point(TENNA_LABEL, None) is None


def test_a_place_that_does_not_read_is_passed_over() -> None:
    pointless = node("Tenna", "Tenna", TRENTINO, TENNA_VILLAGE)
    del pointless["properties"]["lat"]
    body = {"features": ["Tenna", {"properties": None}, pointless, TENNA_NODE]}
    assert node_point(TENNA_LABEL, body) == TENNA_VILLAGE


def test_a_village_searched_by_name_is_at_the_village() -> None:
    service = tenna()
    search = CitySearch("K", service)
    found = search.search("Tenna")
    assert [(city.label, city.point) for city in found] == [
        (TENNA_LABEL, TENNA_VILLAGE),
        # Its point was its own already.
        ("Safiental, Grisons, Switzerland", (46.7469787, 9.3390283)),
    ]
    # One more request, for the one area; then the answer is kept.
    assert service.calls == ["cities Tenna", "places Tenna"]
    assert search.search(" tenna ") == found
    assert len(service.calls) == 2


def test_a_town_whose_area_has_its_point_stays_there() -> None:
    service = Service({"Levico Terme": [LEVICO]}, {"Levico Terme": [LEVICO_NODE]})
    found = CitySearch("K", service).search("Levico Terme")
    assert [(city.label, city.point) for city in found] == [
        (f"Levico Terme, {TRENTINO}, Italy", LEVICO_POINT)
    ]


def test_an_area_without_a_place_of_its_label_keeps_the_geocoding_point() -> None:
    # "Milano" is not "Milan": no place bears the label, and the area's
    # point is the city's own already.
    service = Service({"Milano": [MILAN]}, {"Milan": MILAN_NODES})
    found = CitySearch("K", service).search("Milano")
    assert [(city.label, city.point) for city in found] == [
        ("Milan, Lombardy, Italy", MILAN_POINT)
    ]
    assert service.calls == ["cities Milano", "places Milan"]


def test_places_that_do_not_answer_leave_the_geocoding_points_for_once(
    caplog: pytest.LogCaptureFixture,
) -> None:
    service = tenna()
    service.places_down = True
    search = CitySearch("SECRET", service)
    # The search answers as before TASK-249, and says nothing of the key.
    assert [city.point for city in search.search("Tenna")] == [
        TENNA_AREA,
        (46.7469787, 9.3390283),
    ]
    assert "SECRET" not in caplog.text and "OSError" in caplog.text
    # Not kept: the next search asks again, and finds the village.
    service.places_down = False
    assert search.search("Tenna")[0].point == TENNA_VILLAGE
    assert service.calls == ["cities Tenna", "places Tenna"] * 2
    # That one is kept.
    search.search("Tenna")
    assert len(service.calls) == 4


def test_places_that_do_not_answer_are_waited_for_once() -> None:
    service = Service({"Trentino": [TENNA, LEVICO]})
    service.places_down = True
    found = CitySearch("K", service).search("Trentino")
    assert [city.point for city in found] == [TENNA_AREA, LEVICO_POINT]
    # Both areas asked side by side (TASK-288): one wait, not one each.
    assert service.calls[0] == "cities Trentino"
    assert sorted(service.calls[1:]) == ["places Levico Terme", "places Tenna"]


def test_a_geocoding_that_does_not_answer_fails_the_search() -> None:
    def down(url: str) -> Any:
        raise OSError(url)

    with pytest.raises(PlacesUnavailableError) as failed:
        CitySearch("SECRET", down).search("Tenna")
    assert "SECRET" not in str(failed.value)
    assert failed.value.__cause__ is None


def test_a_label_twice_asks_its_places_once() -> None:
    service = Service({"Tenna": [TENNA, TENNA]}, {"Tenna": [TENNA_NODE]})
    assert len(CitySearch("K", service).search("Tenna")) == 1
    assert service.calls == ["cities Tenna", "places Tenna"]


def test_a_village_typed_and_the_same_village_nearby_are_one_city(
    tmp_path: Path,
) -> None:
    """GET /cities and GET /nearby-cities: one point, one cell of examples
    kept."""

    def nearby_places(url: str) -> Any:
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        village = query["categories"][0] == "populated_place.village"
        return {
            "type": "FeatureCollection",
            "features": [TENNA_NODE] if village else [],
        }

    store = RouteStore(tmp_path / "routes", engine="engine-a")
    app = create_app(
        FileSource(HERE), cities=CitySearch("K", tenna()), route_store=store
    )
    install_nearby_cities(app, NearbyCities("K", nearby_places), store)
    client = TestClient(app)

    typed = client.get("/cities", params={"q": "Tenna"}).json()["places"][0]
    # From Caldonazzo, 1.4 km south of Tenna.
    near = client.get("/nearby-cities", params={"lat": 46.0036, "lon": 11.2647})
    tapped = near.json()["places"][0]

    assert typed["label"] == tapped["label"] == TENNA_LABEL
    assert typed["point"] == tapped["point"] == list(TENNA_VILLAGE)
    # The centres learned for the examples: the village, not the area's.
    centres = (tmp_path / "routes" / "city-centres.txt").read_text().split()
    assert cell(TENNA_VILLAGE) in centres
    assert cell(TENNA_AREA) not in centres
