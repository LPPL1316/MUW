"""The towns near a point, for "Near me" in "Explore" (TASK-236, ADR-0200).
No network: the answers are cut from Geoapify's Places, as they came on
2026-10-05 around Caldonazzo and Trento."""

from __future__ import annotations

import urllib.parse
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.app import create_app
from shaperoute_api.city_photos import CityPhotoBody, CityPhotos
from shaperoute_api.nearby_cities import (
    CITIES,
    FAR_RADIUS_M,
    NEAR_RADIUS_M,
    TOWNS,
    VILLAGES,
    NearbyCities,
    Town,
    choose,
    install_nearby_cities,
    nearest_others,
    own_place,
    parse_towns,
    population_of,
)
from shaperoute_api.route_store import RouteStore, cell

HERE = Path(__file__).parent
CALDONAZZO = (46.0036, 11.2647)
TRENTO_CENTRE = (46.0679, 11.1211)
STATE = "Trentino – Alto Adige/Südtirol"


def place(name: str, lat: float, lon: float, population: Any = None) -> Any:
    raw = {"place": "town"} if population is None else {"population": population}
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "city": name,
            "state": STATE,
            "country": "Italy",
            "lat": lat,
            "lon": lon,
            "datasource": {"raw": raw},
        },
    }


TRENTO = place("Trento", 46.0664228, 11.1257601, 117317)
LEVICO = place("Levico Terme", 46.0091259, 11.3017774, 7915)
PERGINE = place("Pergine Valsugana", 46.0605291, 11.2406747, 21280)
BORGO = place("Borgo Valsugana", 46.0533463, 11.4566004, 6945)
ROVERETO = place("Rovereto", 45.886548, 11.0452369, 40285)
RIVA = place("Riva del Garda", 45.8857, 10.8413, 17190)
ARCO = place("Arco", 45.9177, 10.8867, 17588)
BOLZANO = place("Bolzano", 46.4981, 11.3548, 107436)
# Villages: Caldonazzo is where the user is, the others its neighbours.
CALDONAZZO_VILLAGE = place("Caldonazzo", 45.9953, 11.2631, 2766)
CALCERANICA = place("Calceranica al Lago", 46.0036, 11.2436, 1145)
TENNA = place("Tenna", 46.0156, 11.2640, 850)
BOSENTINO = place("Bosentino", 45.9995, 11.2233, 728)
VELA = place("Vela", 46.0823, 11.1017, 963)
SARDAGNA = place("Sardagna", 46.0640, 11.0965, 903)


class Service:
    """Geoapify's Places: what it has for each kind and radius."""

    def __init__(self, answers: dict[tuple[str, int], list[Any]]) -> None:
        self.answers = answers
        self.calls: list[tuple[str, int, str]] = []

    def __call__(self, url: str) -> Any:
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
        kind = query["categories"][0]
        circle = query["filter"][0]
        radius = int(circle.rsplit(",", 1)[1])
        self.calls.append((kind, radius, circle))
        return {"type": "FeatureCollection", "features": self.answers[(kind, radius)]}


def around_caldonazzo() -> Service:
    return Service(
        {
            (CITIES, FAR_RADIUS_M): [TRENTO, BOLZANO],
            (TOWNS, NEAR_RADIUS_M): [LEVICO, PERGINE, BORGO],
            (VILLAGES, NEAR_RADIUS_M): [
                CALDONAZZO_VILLAGE,
                CALCERANICA,
                TENNA,
                BOSENTINO,
            ],
        }
    )


def around_trento() -> Service:
    return Service(
        {
            (CITIES, FAR_RADIUS_M): [TRENTO, BOLZANO],
            (TOWNS, NEAR_RADIUS_M): [PERGINE, LEVICO],
            (TOWNS, FAR_RADIUS_M): [PERGINE, LEVICO, ROVERETO, BORGO, ARCO, RIVA],
            (VILLAGES, NEAR_RADIUS_M): [VELA, SARDAGNA],
        }
    )


def names(towns: list[Town]) -> list[str]:
    return [town.label.split(",")[0] for town in towns]


def test_four_towns_within_20_km_and_the_two_nearest_villages() -> None:
    service = around_caldonazzo()
    towns = NearbyCities("K", service).towns(CALDONAZZO)
    # The nearest first: the two villages next door, then the four towns.
    # Caldonazzo itself is where the user is.
    assert names(towns) == [
        "Calceranica al Lago",
        "Tenna",
        "Levico Terme",
        "Pergine Valsugana",
        "Trento",
        "Borgo Valsugana",
    ]
    # Four towns within 20 km: those further away are not asked for. The
    # three are asked side by side (TASK-288), in no order.
    assert sorted((kind, radius) for kind, radius, _ in service.calls) == sorted(
        [
            (CITIES, FAR_RADIUS_M),
            (TOWNS, NEAR_RADIUS_M),
            (VILLAGES, NEAR_RADIUS_M),
        ]
    )


def test_fewer_than_four_are_filled_with_the_nearest_up_to_50_km() -> None:
    service = around_trento()
    towns = NearbyCities("K", service).towns(TRENTO_CENTRE)
    # Trento is where the user is; Pergine and Levico are within 20 km, and
    # Rovereto and Arco are the nearest beyond: Bolzano is larger, and
    # further. Sardagna and Vela are the two nearest of all.
    assert names(towns) == [
        "Sardagna",
        "Vela",
        "Pergine Valsugana",
        "Levico Terme",
        "Rovereto",
        "Arco",
    ]
    assert (TOWNS, FAR_RADIUS_M) in [(k, r) for k, r, _ in service.calls]


def test_more_than_four_within_20_km_keep_the_largest_and_the_two_nearest() -> None:
    crowd = [place(f"Town {n}", 46.0036, 11.30 + n / 100, 1000 * n) for n in range(9)]
    service = Service(
        {
            (CITIES, FAR_RADIUS_M): [],
            (TOWNS, NEAR_RADIUS_M): crowd,
            (VILLAGES, NEAR_RADIUS_M): [],
        }
    )
    towns = NearbyCities("K", service).towns(CALDONAZZO)
    # Without villages around, the nearest towns that are not the largest.
    assert names(towns) == ["Town 0", "Town 1", "Town 5", "Town 6", "Town 7", "Town 8"]


def test_none_around_is_an_empty_list() -> None:
    service = Service(
        {
            (CITIES, FAR_RADIUS_M): [],
            (TOWNS, NEAR_RADIUS_M): [],
            (TOWNS, FAR_RADIUS_M): [],
            (VILLAGES, NEAR_RADIUS_M): [],
        }
    )
    assert NearbyCities("K", service).towns(CALDONAZZO) == []


def test_the_label_and_the_point_are_those_of_the_city_search() -> None:
    [town] = parse_towns({"features": [LEVICO]})
    assert town == Town(
        "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
        (46.0091259, 11.3017774),
        7915,
    )


def test_a_village_is_named_by_its_own_name_not_its_municipality() -> None:
    village = place("Parè", 45.8109, 9.0078)
    village["properties"]["city"] = "Colverde"
    assert names(parse_towns({"features": [village]})) == ["Parè"]


def test_what_does_not_read_is_dropped_and_a_label_comes_once() -> None:
    body = {
        "features": [
            "nonsense",
            {"properties": {"name": "No point"}},
            {"properties": {"name": "", "lat": 45.0, "lon": 11.0}},
            {"properties": {"name": "Bool", "lat": True, "lon": 11.0}},
            LEVICO,
            LEVICO,
        ]
    }
    assert names(parse_towns(body)) == ["Levico Terme"]
    assert parse_towns(None) == []


def test_the_population_as_openstreetmap_writes_it() -> None:
    def raw(value: Any) -> dict[str, Any]:
        return {"datasource": {"raw": {"population": value}}}

    assert population_of(raw(7915)) == 7915
    assert population_of(raw("7915")) == 7915
    assert population_of(raw("7 915")) == 7915
    assert population_of(raw("about 8000")) == 0
    assert population_of(raw(True)) == 0
    assert population_of({}) == 0


def test_without_a_population_a_town_comes_after_the_others() -> None:
    known = Town("Known", (46.05, 11.30), 500)
    unknown = Town("Unknown", (46.02, 11.28), 0)
    others = [Town(f"T{n}", (46.1, 11.3 + n / 100), 9000) for n in range(3)]
    assert "Unknown" not in names(choose(CALDONAZZO, [unknown, known, *others], []))


def test_only_the_nearest_place_is_where_the_user_is() -> None:
    here = Town("Caldonazzo", (45.9953, 11.2631), 2766)
    next_door = Town("Calceranica al Lago", (46.0036, 11.2436), 1145)
    far = Town("Levico Terme", (46.0091, 11.3018), 7915)
    centre = (46.0, 11.26)
    # Both within 1.5 km: only the nearer is the user's own.
    assert own_place(centre, [next_door, here, far]) == "Caldonazzo"
    assert own_place(centre, [far]) is None
    assert own_place(centre, []) is None
    assert names(nearest_others(centre, [far, next_door, here], [], "Caldonazzo")) == [
        "Calceranica al Lago",
        "Levico Terme",
    ]
    # One taken among the four is not given twice.
    assert names(nearest_others(centre, [far, next_door], [far], None)) == [
        "Calceranica al Lago"
    ]


def test_the_service_is_asked_from_the_square_not_from_the_position() -> None:
    service = around_caldonazzo()
    nearby = NearbyCities("K", service)
    nearby.towns((46.00361234, 11.26474321))
    assert {circle for _, _, circle in service.calls} == {
        f"circle:11.26,46.0,{FAR_RADIUS_M}",
        f"circle:11.26,46.0,{NEAR_RADIUS_M}",
    }
    # Another point of the same square costs nothing.
    nearby.towns((46.0012, 11.2629))
    assert len(service.calls) == 3


def test_the_answer_is_asked_again_after_a_day() -> None:
    now = [0.0]
    service = around_caldonazzo()
    nearby = NearbyCities("K", service, clock=lambda: now[0])
    nearby.towns(CALDONAZZO)
    now[0] = 23 * 3600.0
    nearby.towns(CALDONAZZO)
    assert len(service.calls) == 3
    now[0] = 25 * 3600.0
    nearby.towns(CALDONAZZO)
    assert len(service.calls) == 6


def client_with(nearby: NearbyCities, store: RouteStore | None = None) -> TestClient:
    app = create_app(FileSource(HERE))
    install_nearby_cities(app, nearby, store)
    return TestClient(app)


def test_the_endpoint_gives_the_towns_and_how_far_they_are() -> None:
    client = client_with(NearbyCities("K", around_caldonazzo()))
    response = client.get("/nearby-cities", params={"lat": 46.0036, "lon": 11.2647})
    assert response.status_code == 200
    places = response.json()["places"]
    # From the point itself, not from the middle of its square: there
    # Calceranica is the nearer of the two villages.
    assert [p["label"].split(",")[0] for p in places] == [
        "Tenna",
        "Calceranica al Lago",
        "Levico Terme",
        "Pergine Valsugana",
        "Trento",
        "Borgo Valsugana",
    ]
    assert places[2] == {
        "label": "Levico Terme, Trentino – Alto Adige/Südtirol, Italy",
        "point": [46.0091259, 11.3017774],
        "away_m": 2929,
        "photo": None,
    }


def test_the_towns_centres_are_city_centres_for_the_kept_examples(
    tmp_path: Path,
) -> None:
    store = RouteStore(tmp_path / "routes", engine="engine-a")
    client = client_with(NearbyCities("K", around_caldonazzo()), store)
    client.get("/nearby-cities", params={"lat": 46.0036, "lon": 11.2647})
    centres = (tmp_path / "routes" / "city-centres.txt").read_text().split()
    assert cell((46.0091259, 11.3017774)) in centres
    assert len(centres) == 6


def test_without_a_key_or_an_answer_it_is_503() -> None:
    off = client_with(NearbyCities(None))
    response = off.get("/nearby-cities", params={"lat": 46.0, "lon": 11.26})
    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Nearby towns are off on this API."

    def broken(url: str) -> Any:
        raise OSError(url)

    failed = client_with(NearbyCities("SECRET", broken))
    response = failed.get("/nearby-cities", params={"lat": 46.0, "lon": 11.26})
    assert response.status_code == 503
    assert "SECRET" not in response.text


def test_a_point_off_the_earth_is_refused() -> None:
    client = client_with(NearbyCities("K", around_caldonazzo()))
    assert client.get("/nearby-cities", params={"lat": 91, "lon": 0}).status_code == 422
    assert client.get("/nearby-cities").status_code == 422


def test_a_town_s_wikidata_item_as_geoapify_gives_it() -> None:
    levico = place("Levico Terme", 46.0091259, 11.3017774, 7915)
    levico["properties"]["wiki_and_media"] = {"wikidata": "Q100"}
    borgo = place("Borgo Valsugana", 46.0533463, 11.4566004, 6945)
    borgo["properties"]["datasource"]["raw"]["wikidata"] = "Q200"
    # Named twice: the item of the second, the point of the first.
    tenna = place("Tenna", 46.0156, 11.2640, 850)
    tenna_again = place("Tenna", 46.0200, 11.2700, 850)
    tenna_again["properties"]["wiki_and_media"] = {"wikidata": "Q300"}
    odd = place("Vela", 46.0823, 11.1017, 963)
    odd["properties"]["wiki_and_media"] = {"wikidata": "not an item"}
    towns = parse_towns({"features": [levico, borgo, tenna, tenna_again, odd]})
    assert [(t.label.split(",")[0], t.item) for t in towns] == [
        ("Levico Terme", "Q100"),
        ("Borgo Valsugana", "Q200"),
        ("Tenna", "Q300"),
        ("Vela", None),
    ]
    assert towns[2].point == (46.0156, 11.2640)


def test_the_endpoint_gives_the_photos_of_the_towns_that_have_one() -> None:
    levico = place("Levico Terme", 46.0091259, 11.3017774, 7915)
    levico["properties"]["wiki_and_media"] = {"wikidata": "Q100"}
    tenna = place("Tenna", 46.0156, 11.2640, 850)
    tenna["properties"]["wiki_and_media"] = {"wikidata": "Q300"}
    service = Service(
        {
            (CITIES, FAR_RADIUS_M): [TRENTO, BOLZANO],
            (TOWNS, NEAR_RADIUS_M): [levico, PERGINE, BORGO],
            (VILLAGES, NEAR_RADIUS_M): [CALDONAZZO_VILLAGE, CALCERANICA, tenna],
        }
    )
    asked: list[list[str]] = []

    class Photos(CityPhotos):
        def photos(self, items: Iterable[str]) -> dict[str, CityPhotoBody]:
            asked.append(list(items))
            credit = "© A · CC BY 4.0"
            return {"Q100": CityPhotoBody(url="/city-photos/Q100.jpg", credit=credit)}

    client = client_with(NearbyCities("K", service, photos=Photos(None)))
    response = client.get("/nearby-cities", params={"lat": 46.0036, "lon": 11.2647})
    places = {p["label"].split(",")[0]: p["photo"] for p in response.json()["places"]}
    assert places["Levico Terme"] == {
        "url": "/city-photos/Q100.jpg",
        "credit": "© A · CC BY 4.0",
    }
    # An item without a photo, and a town without an item.
    assert places["Tenna"] is None
    assert places["Pergine Valsugana"] is None
    # Only the items go to the photos, never the point.
    assert sorted(asked[0]) == ["Q100", "Q300"]
