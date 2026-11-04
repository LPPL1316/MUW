"""GET /muw-routes and /muw-routes/{id} (TASK-365, ADR-0310). The bodies the
app reads are packages/shared-types/fixtures/muw-routes.json and muw-route.json,
and a file of catalog/muw_routes/ is the second one."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.app import create_app
from shaperoute_api.feed import FeedPostBody
from shaperoute_api.muw_routes import (
    MUW_ROUTE_FIELDS,
    MuwRouteCatalog,
    parse_route,
)

HERE = Path(__file__).parent
CONTRACT = HERE.parents[2] / "packages" / "shared-types" / "fixtures"


def contract(name: str) -> dict[str, Any]:
    body: dict[str, Any] = json.loads((CONTRACT / name).read_text(encoding="utf-8"))
    return body


def route_file() -> dict[str, Any]:
    return contract("muw-route.json")


@pytest.fixture
def api() -> TestClient:
    catalog = MuwRouteCatalog([parse_route(route_file())])
    return TestClient(create_app(FileSource(HERE), muw_routes=catalog))


def test_the_list_is_the_shared_contract(api: TestClient) -> None:
    answer = api.get("/muw-routes")
    assert answer.status_code == 200
    assert answer.json() == contract("muw-routes.json")


def test_a_route_is_the_shared_contract(api: TestClient) -> None:
    answer = api.get("/muw-routes/star")
    assert answer.status_code == 200
    assert answer.json() == route_file()


def test_a_route_that_is_not_there(api: TestClient) -> None:
    assert api.get("/muw-routes/moon").status_code == 404


def test_no_directory_is_no_routes(tmp_path: Path) -> None:
    catalog = MuwRouteCatalog.from_dir(tmp_path / "not-there")
    assert len(catalog) == 0
    answer = TestClient(create_app(FileSource(HERE), muw_routes=catalog))
    assert answer.get("/muw-routes").json() == {"routes": []}


def test_an_empty_catalog_given_is_not_replaced(tmp_path: Path) -> None:
    catalog = MuwRouteCatalog([])
    client = TestClient(create_app(FileSource(HERE), muw_routes=catalog))
    assert client.get("/muw-routes").json() == {"routes": []}


@pytest.mark.parametrize(
    "extra",
    ["started_at", "duration_s", "pace", "calories", "username", "author", "date"],
)
def test_a_file_saying_someone_rode_it_is_refused(extra: str) -> None:
    with pytest.raises(ValueError):
        parse_route({**route_file(), extra: "anything"})


@pytest.mark.parametrize("field", sorted(MUW_ROUTE_FIELDS))
def test_a_file_missing_a_field_is_refused(field: str) -> None:
    body = route_file()
    del body[field]
    with pytest.raises(ValueError):
        parse_route(body)


@pytest.mark.parametrize(
    "change",
    [
        {"license": "Routes by MuW"},
        {"activity": "flying"},
        {"difficulty": "extreme"},
        {"id": "Not An Id"},
        {"route_m": 0},
        {"climb_m": -1},
        {"titles": {"en": "Star"}},
        {"titles": {"en": "", "de": "x", "it": "x", "es": "x", "fr": "x"}},
        {"points": [[46.0, 11.0]]},
        {"points": [[146.0, 11.0], [46.0, 11.0]]},
        {"on_foot": [[0, 99]]},
    ],
)
def test_a_file_that_is_wrong_is_refused(change: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        parse_route({**route_file(), **change})


def test_a_wrong_file_is_left_out_and_the_others_kept(tmp_path: Path) -> None:
    good = route_file()
    (tmp_path / "star.json").write_text(json.dumps(good), encoding="utf-8")
    (tmp_path / "broken.json").write_text("{", encoding="utf-8")
    other = {**good, "id": "moon"}
    (tmp_path / "named_wrong.json").write_text(json.dumps(other), encoding="utf-8")
    assert list(MuwRouteCatalog.from_dir(tmp_path).routes) == ["star"]


def test_the_list_is_in_the_order_of_the_ids() -> None:
    routes = [parse_route({**route_file(), "id": name}) for name in ("b", "c", "a")]
    assert [r.id for r in MuwRouteCatalog(routes).listed()] == ["a", "b", "c"]


def test_the_feed_of_a_published_app_has_nothing_new() -> None:
    """GET /feed knows nothing of these routes: no field tells them apart."""
    fields = set(FeedPostBody.model_fields)
    assert "kind" not in fields
    assert not fields & {"titles", "difficulty", "climb_m"}


def test_every_file_of_the_repository_reads() -> None:
    """catalog/muw_routes/ holds only routes the user approved: each must read,
    or the API would leave it out without a word."""
    directory = HERE.parents[2] / "catalog" / "muw_routes"
    files = sorted(p.stem for p in directory.glob("*.json"))
    assert list(MuwRouteCatalog.from_dir(directory).routes) == files


def test_a_file_of_before_the_figures_is_kept_with_none() -> None:
    body = route_file()
    for field in ("shape", "word", "style", "outline"):
        del body[field]
    route = parse_route(body)
    assert (route.shape, route.word, route.outline) == (None, None, None)


def test_a_word_and_an_outline_read() -> None:
    word = parse_route({**route_file(), "shape": None, "word": "go"})
    assert (word.word, word.style) == ("GO", "round")
    square = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]
    drawn = parse_route({**route_file(), "shape": "boot", "outline": square})
    assert drawn.outline is not None and len(drawn.outline) == 5


@pytest.mark.parametrize(
    "change",
    [
        {"shape": "star", "word": "GO"},
        {"shape": None, "word": None, "outline": [[0, 0]] * 5},
        {"shape": None, "word": "G0"},
        {"shape": None, "word": "GO", "style": "italic"},
        {"shape": None, "word": "GO", "outline": [[0, 0]] * 5},
        {"style": "round"},
        {"outline": [[0, 0], [1, 1]]},
        {"outline": [[0, 0], [9, 0], [1, 1], [0, 0]]},
    ],
)
def test_a_figure_that_is_wrong_is_refused(change: dict[str, Any]) -> None:
    with pytest.raises(ValueError):
        parse_route({**route_file(), **change})
