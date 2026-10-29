"""Themed routes (TASK-129, ADR-0099): reading the words, the places, the
cities and the jobs. Geoapify's answers are fixtures (trimmed real ones);
the engine is a fake; no network."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from route_engine.models import RouteResult
from route_engine.network import FileSource
from route_engine.optimizer import Plan, ShapeNotDrawableError
from route_engine.stops import Stop, StopsPlan

from shaperoute_api.app import create_app
from shaperoute_api.cities import CitySearch, cities_url, city_label
from shaperoute_api.city_photos import CityPhotoBody, CityPhotos
from shaperoute_api.themed import (
    MAX_STOPS,
    StopFinder,
    ThemedJobs,
    ThemedRequestBody,
    parse_places,
    places_url,
    search_radius_m,
)
from shaperoute_api.themes import THEMES, read_request, read_with_ai

HERE = Path(__file__).parent
PLACES = json.loads(
    (HERE / "fixtures" / "geoapify-places-bologna.json").read_text("utf-8")
)
CITIES = json.loads(
    (HERE / "fixtures" / "geoapify-city-milano.json").read_text("utf-8")
)
MILAN = (45.4641943, 9.1896346)


@pytest.mark.parametrize(
    ("text", "theme", "shape", "km", "city"),
    [
        ("voglio un percorso romantico a Parigi", "romantic", None, 10, "Parigi"),
        ("giro gastronomico a Roma, 8 km", "food", None, 8, "Roma"),
        ("Tokyo food tour", "food", None, 10, None),
        ("luoghi famosi a New York!", "famous", None, 10, "New York"),
        ("un cuore romantico di 15 km a Torino", "romantic", "heart", 15, "Torino"),
        ("great views in San Francisco", "panoramic", None, 10, "San Francisco"),
        ("un tour dei musei a Firenze", "culture", None, 10, "Firenze"),
        ("ristoranti romantici a Napoli", "food", None, 10, "Napoli"),
        ("a great run, 50 km", None, None, 21, None),  # "great" is not "eat"
        ("una stella da 1 km", None, "star", 3, None),
    ],
)
def test_the_tables_read_theme_shape_distance_and_city(
    text: str, theme: str | None, shape: str | None, km: int, city: str | None
) -> None:
    got = read_request(text)
    assert (got.theme, got.shape, got.distance_m, got.city) == (
        theme,
        shape,
        km * 1000,
        city,
    )


def test_the_ai_only_for_words_the_tables_miss_and_only_a_known_theme() -> None:
    asked: list[str] = []

    def ai(text: str, themes: list[str]) -> str | None:
        asked.append(text)
        return {"un giro per innamorati": "romantic", "boh": "pirates"}.get(text)

    assert read_with_ai("luoghi famosi a Roma", ai).by == "table"
    assert asked == []
    loved = read_with_ai("un giro per innamorati", ai)
    assert (loved.theme, loved.by) == ("romantic", "ai")
    assert read_with_ai("boh", ai).theme is None


def test_places_named_once_notable_first() -> None:
    body: dict[str, Any] = {"features": [*PLACES["features"]]}
    famous = {
        "name": "Piazza Maggiore",
        "lat": 44.4938,
        "lon": 11.3430,
        "wiki_and_media": {"wikidata": "Q1"},
    }
    body["features"] = [
        *body["features"],
        {"properties": famous},
        {"properties": {**famous}},
        {"properties": {"lat": 1, "lon": 2}},
    ]
    stops = parse_places(body, notable_only=False)
    assert stops[0].name == "Piazza Maggiore"
    assert len({s.name for s in stops}) == len(stops) <= MAX_STOPS
    assert all(s.name for s in stops)
    # Notable only, but fewer than 3 notable: the others stay.
    assert len(parse_places(body, notable_only=True)) == len(stops)


def place(name: str, item: str | None = None, raw: bool = False) -> dict[str, Any]:
    props: dict[str, Any] = {"name": name, "lat": 41.9, "lon": 12.48}
    if item is not None and raw:
        props["datasource"] = {"raw": {"wikidata": item}}
    elif item is not None:
        props["wiki_and_media"] = {"wikidata": item}
    return {"properties": props}


def test_places_keep_their_wikidata_item() -> None:
    body = {
        "features": [
            place("Colosseo", "Q10285"),
            place("Pantheon", "Q99309", raw=True),
            place("Fontana", "not an item"),
            place("Vicolo"),
        ]
    }
    found = {s.name: s.wikidata for s in parse_places(body, notable_only=False)}
    assert found == {
        "Colosseo": "Q10285",
        "Pantheon": "Q99309",
        "Fontana": None,
        "Vicolo": None,
    }


def test_places_url_asks_named_places_of_the_theme_around_the_point() -> None:
    q = parse_qs(urlparse(places_url("K", THEMES["food"], (44.49, 11.34), 2500)).query)
    assert q["categories"] == ["catering.restaurant,catering.cafe"]
    assert q["conditions"] == ["named"]
    assert q["filter"] == ["circle:11.34,44.49,2500"]
    assert search_radius_m(10_000) == 2500
    assert search_radius_m(3_000) == 800


def test_the_city_is_its_centre_and_labelled() -> None:
    search = CitySearch("K", fetch=lambda url: CITIES)
    first = search.search("Milano")[0]
    assert (first.label, first.point) == ("Milan, Lombardy, Italy", MILAN)
    assert city_label({"name": "Paris", "country": "France"}) == "Paris, France"
    q = parse_qs(urlparse(cities_url("K", " Milano ")).query)
    assert (q["type"], q["text"]) == (["city"], ["Milano"])


def test_the_city_search_is_asked_once() -> None:
    calls: list[str] = []
    search = CitySearch("K", fetch=lambda url: calls.append(url) or CITIES)
    search.search("Milano")
    search.search("  milano ")
    assert len(calls) == 1


def fake_plan(passed: int) -> Any:
    def plan(
        shape: str, distance_m: int, centre: Any, stops: list[Stop], source: Any
    ) -> StopsPlan:
        result = RouteResult(
            points=[centre, centre], distance_m=distance_m, similarity=0.95, shape=shape
        )
        return StopsPlan(
            Plan(result=result, search=None), tuple(stops[:passed]), tried=4, drawn=3
        )

    return plan


def jobs(
    stops_body: Any = PLACES, plan: Any = None, photos: CityPhotos | None = None
) -> ThemedJobs:
    return ThemedJobs(
        FileSource(HERE),
        StopFinder("K", fetch=lambda url: stops_body),
        cities=CitySearch("K", fetch=lambda url: CITIES),
        plan=plan or fake_plan(2),
        run_inline=True,
        photos=photos,
    )


def test_a_themed_job_gives_the_route_and_every_place_found() -> None:
    job = jobs().submit(ThemedRequestBody(text="luoghi famosi a Milano"))
    body = job.as_body()
    assert body.status == "done" and body.result is not None
    r = body.result
    assert (r.theme, r.shape, r.city, r.centre) == (
        "famous",
        "star",
        "Milan, Lombardy, Italy",
        MILAN,
    )
    assert [s.passed for s in r.stops][:3] == [True, True, False]
    assert len(r.stops) == 6


class Wiki:
    """Wikidata and Commons, for an item with a free photo and one without;
    what they are asked, kept."""

    def __init__(self) -> None:
        self.urls: list[str] = []

    def get_json(self, url: str) -> Any:
        self.urls.append(url)
        query = parse_qs(urlparse(url).query)
        if query["action"] == ["wbgetclaims"]:
            if query["entity"] != ["Q10285"]:
                return {"claims": {}}
            image = {"mainsnak": {"datavalue": {"value": "Colosseo.jpg"}}}
            return {"claims": {"P18": [{**image, "rank": "normal"}]}}
        licence = {
            "Artist": {"value": "Diliff"},
            "LicenseShortName": {"value": "CC BY-SA 2.5"},
            "License": {"value": "cc-by-sa-2.5"},
        }
        info = {
            "thumburl": "https://upload.wikimedia.org/c.jpg",
            "extmetadata": licence,
        }
        return {
            "query": {
                "pages": {"1": {"title": "File:Colosseo.jpg", "imageinfo": [info]}}
            }
        }

    def entities(self) -> list[str]:
        asked = [parse_qs(urlparse(u).query) for u in self.urls]
        return sorted(q["entity"][0] for q in asked if "entity" in q)


def test_the_places_passed_by_have_their_photo() -> None:
    wiki = Wiki()
    photos = CityPhotos(None, wiki.get_json, lambda url: b"", wait_s=30.0)
    body = {
        "features": [
            place("Colosseo", "Q10285"),
            place("Pantheon", "Q99309"),
            place("Trevi", "Q186579"),
        ]
    }
    job = jobs(body, fake_plan(2), photos).submit(
        ThemedRequestBody(text="luoghi famosi", centre=(41.9, 12.48))
    )
    assert job.result is not None
    stops = {s.name: s for s in job.result.stops}
    assert stops["Colosseo"].photo == CityPhotoBody(
        url="/city-photos/Q10285.jpg", credit="© Diliff · CC BY-SA 2.5"
    )
    # Passed by, with an item but no image: its name alone.
    assert (stops["Pantheon"].wikidata, stops["Pantheon"].photo) == ("Q99309", None)
    # Not passed by: its item, and no photo, not even asked for.
    assert (stops["Trevi"].wikidata, stops["Trevi"].photo) == ("Q186579", None)
    assert wiki.entities() == ["Q10285", "Q99309"]
    # Wikimedia hears the items and the file, never where the city is.
    assert not any("41.9" in url or "12.48" in url for url in wiki.urls)


def test_without_the_photos_the_places_have_their_items_alone() -> None:
    body = {"features": [place("Colosseo", "Q10285"), place("Vicolo")]}
    job = jobs(body).submit(
        ThemedRequestBody(text="luoghi famosi", centre=(41.9, 12.48))
    )
    assert job.result is not None
    assert [(s.wikidata, s.photo) for s in job.result.stops] == [
        ("Q10285", None),
        (None, None),
    ]


@pytest.mark.parametrize(
    ("text", "body", "code"),
    [
        ("un giro qualsiasi a Milano", PLACES, "theme_unknown"),
        ("luoghi famosi", PLACES, "city_unknown"),
        ("luoghi famosi a Milano", {"features": []}, "no_places"),
    ],
)
def test_what_is_missing_is_said_not_invented(text: str, body: Any, code: str) -> None:
    job = jobs(body).submit(ThemedRequestBody(text=text))
    assert job.status == "failed" and job.error is not None
    assert job.error.code == code


def test_the_app_point_is_used_when_the_words_name_no_city() -> None:
    job = jobs().submit(
        ThemedRequestBody(text="ristoranti", centre=(44.49, 11.34), city="Bologna")
    )
    assert job.result is not None and (job.result.centre, job.result.city) == (
        (44.49, 11.34),
        "Bologna",
    )


def test_a_shape_not_drawable_is_the_engine_s_error() -> None:
    def plan(*_: Any) -> StopsPlan:
        raise ShapeNotDrawableError("no roads")

    job = jobs(plan=plan).submit(ThemedRequestBody(text="luoghi famosi a Milano"))
    assert job.error is not None and job.error.code == "shape_not_drawable"


def test_the_endpoints() -> None:
    themed = jobs()
    client = TestClient(
        create_app(
            FileSource(HERE),
            themed=themed,
            cities=CitySearch("K", fetch=lambda url: CITIES),
        )
    )
    answer = client.post("/themed-route-jobs", json={"text": "luoghi famosi a Milano"})
    assert answer.status_code == 202
    job_id = answer.json()["job_id"]
    got = client.get(f"/themed-route-jobs/{job_id}").json()
    assert got["status"] == "done" and got["result"]["shape"] == "star"
    assert client.get("/themed-route-jobs/nope").status_code == 404
    assert (
        client.get("/cities", params={"q": "Milano"}).json()["places"][0]["label"]
        == "Milan, Lombardy, Italy"
    )
    off = TestClient(create_app(FileSource(HERE)))
    assert off.post("/themed-route-jobs", json={"text": "x"}).status_code == 503
    assert off.get("/cities", params={"q": "Milano"}).status_code == 503


CONTRACT = HERE.parents[2] / "packages" / "shared-types" / "fixtures"


@pytest.mark.parametrize("name", ["themed-route-job-done", "themed-route-job-failed"])
def test_the_shared_fixtures_are_bodies_of_the_api(name: str) -> None:
    from shaperoute_api.themed import ThemedJobBody

    body = json.loads((CONTRACT / f"{name}.json").read_text("utf-8"))
    assert ThemedJobBody.model_validate(body).model_dump(mode="json") == body
