"""The routes MuW draws for the Feed (TASK-365, ADR-0310): routes, not runs.

GET /muw-routes lists them, each with a light preview of its line; GET
/muw-routes/{id} gives one whole. They are apart from GET /feed: an app
already published never asks for them and sees nothing new.

Every route is a file of catalog/muw_routes/, written from a draft the user
approved, and read once when the API starts: a draft is not in the repository,
so it cannot reach here, and taking a route away is taking its file away. A
file holds what MUW_ROUTE_FIELDS says and nothing else: a time, a pace or a
person in it is an error, because nobody ran these routes. The lines are the
route engine's.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast, get_args

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from route_engine.models import ACTIVITIES

from shaperoute_api.recommended import LatLon, preview, turn_of
from shaperoute_api.schemas import ErrorBody

log = logging.getLogger(__name__)

DEFAULT_DIR = Path("catalog/muw_routes")
ID_PATTERN = re.compile(r"^[a-z0-9_]{1,40}$")
# The languages of the app (apps/mobile/src/i18n/languages.ts): a title is
# shown as it is, so it comes in all of them.
LANGUAGES = frozenset({"en", "de", "it", "es", "fr"})
# What the ODbL asks of a line drawn on OpenStreetMap's roads.
ATTRIBUTION = "OpenStreetMap"
MUW_ROUTE_FIELDS = frozenset(
    {
        "id",
        "city",
        "activity",
        "titles",
        "route_m",
        "climb_m",
        "difficulty",
        "points",
        "on_foot",
        "license",
        "rotation_deg",
    }
)

Difficulty = Literal["easy", "moderate", "hard"]
Stretch = tuple[int, int]


class MuwRouteBody(BaseModel):
    """One route of the list: packages/shared-types/fixtures/muw-routes.json."""

    id: str
    city: str
    activity: str
    titles: dict[str, str]
    """The title in every language of the app."""
    route_m: int
    climb_m: int
    """An estimate from elevation tiles, not a measure: nobody rode it."""
    difficulty: Difficulty
    start: LatLon
    preview: list[LatLon]
    rotation_deg: float
    """As RouteResult.rotation_deg: the app draws it turned back."""


class MuwRoutesBody(BaseModel):
    routes: list[MuwRouteBody]


class MuwRouteDetailBody(BaseModel):
    """GET /muw-routes/{id}, packages/shared-types/fixtures/muw-route.json:
    the route whole, and what a file of catalog/muw_routes/ holds."""

    id: str
    city: str
    activity: str
    titles: dict[str, str]
    route_m: int
    climb_m: int
    difficulty: Difficulty
    points: list[LatLon]
    on_foot: list[Stretch]
    """[from, to] indices into `points` of each stretch with the bike on foot,
    as RouteResult.on_foot."""
    license: str
    rotation_deg: float


@dataclass(frozen=True)
class MuwRoute:
    id: str
    city: str
    activity: str
    titles: dict[str, str]
    route_m: int
    climb_m: int
    difficulty: Difficulty
    points: tuple[LatLon, ...]
    on_foot: tuple[Stretch, ...]
    license: str
    rotation_deg: float


def _point(raw: Any) -> LatLon:
    lat, lon = float(raw[0]), float(raw[1])
    if len(raw) != 2 or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError(f"not a point: {raw}")
    return lat, lon


def parse_route(body: dict[str, Any]) -> MuwRoute:
    """The route of one file; ValueError, KeyError or TypeError when it is not
    what the file must be."""
    if set(body) != MUW_ROUTE_FIELDS:
        raise ValueError(f"fields not as asked: {set(body) ^ MUW_ROUTE_FIELDS}")
    route_id = str(body["id"])
    if not ID_PATTERN.fullmatch(route_id):
        raise ValueError(f"not an id: {route_id}")
    if body["activity"] not in ACTIVITIES:
        raise ValueError(f"not an activity: {body['activity']}")
    titles = {str(k): str(v) for k, v in body["titles"].items()}
    if set(titles) != LANGUAGES or not all(titles.values()):
        raise ValueError("a title for every language")
    if body["difficulty"] not in get_args(Difficulty):
        raise ValueError(f"not a difficulty: {body['difficulty']}")
    if ATTRIBUTION not in str(body["license"]):
        raise ValueError("no OpenStreetMap attribution")
    route_m, climb_m = int(body["route_m"]), int(body["climb_m"])
    if route_m <= 0 or climb_m < 0:
        raise ValueError("a route has a length, and does not climb less than 0")
    points = tuple(_point(p) for p in body["points"])
    if len(points) < 2:
        raise ValueError("a line has two points")
    on_foot = tuple((int(a), int(b)) for a, b in body["on_foot"])
    if not all(0 <= a <= b < len(points) for a, b in on_foot):
        raise ValueError("on_foot outside the line")
    return MuwRoute(
        id=route_id,
        city=str(body["city"]),
        activity=str(body["activity"]),
        titles=titles,
        route_m=route_m,
        climb_m=climb_m,
        difficulty=cast(Difficulty, body["difficulty"]),
        points=points,
        on_foot=on_foot,
        license=str(body["license"]),
        rotation_deg=turn_of(body),
    )


class MuwRouteCatalog:
    def __init__(self, routes: Iterable[MuwRoute]) -> None:
        self.routes = {r.id: r for r in routes}

    @classmethod
    def from_dir(cls, directory: Path) -> MuwRouteCatalog:
        """Every file of `directory`, each named after its route's id; no
        directory is no routes, and a file that does not read is left out and
        said in the log."""
        routes: list[MuwRoute] = []
        for path in sorted(directory.glob("*.json")):
            try:
                route = parse_route(json.loads(path.read_text(encoding="utf-8")))
                if route.id != path.stem:
                    raise ValueError(f"the id is {route.id}")
                routes.append(route)
            except (OSError, ValueError, KeyError, TypeError) as exc:
                log.warning("MuW routes: %s left out (%s)", path.name, exc)
        return cls(routes)

    def __len__(self) -> int:
        return len(self.routes)

    def listed(self) -> list[MuwRouteBody]:
        """All of them, by id: the same order at every read."""
        return [
            MuwRouteBody(
                id=r.id,
                city=r.city,
                activity=r.activity,
                titles=r.titles,
                route_m=r.route_m,
                climb_m=r.climb_m,
                difficulty=r.difficulty,
                start=r.points[0],
                preview=preview(r.points),
                rotation_deg=r.rotation_deg,
            )
            for _, r in sorted(self.routes.items())
        ]

    def get(self, route_id: str) -> MuwRouteDetailBody | None:
        r = self.routes.get(route_id)
        if r is None:
            return None
        return MuwRouteDetailBody(
            id=r.id,
            city=r.city,
            activity=r.activity,
            titles=r.titles,
            route_m=r.route_m,
            climb_m=r.climb_m,
            difficulty=r.difficulty,
            points=list(r.points),
            on_foot=list(r.on_foot),
            license=r.license,
            rotation_deg=r.rotation_deg,
        )


def install_muw_routes(app: FastAPI, catalog: MuwRouteCatalog | None = None) -> None:
    """The two endpoints, on `catalog` or on the files of DEFAULT_DIR. Without
    a token: they say nothing about who asks."""
    routes = MuwRouteCatalog.from_dir(DEFAULT_DIR) if catalog is None else catalog

    @app.get("/muw-routes", tags=["muw-routes"])
    def list_muw_routes() -> MuwRoutesBody:
        return MuwRoutesBody(routes=routes.listed())

    @app.get(
        "/muw-routes/{route_id}",
        tags=["muw-routes"],
        responses={404: {"model": ErrorBody}},
    )
    def get_muw_route(route_id: str) -> MuwRouteDetailBody:
        route = routes.get(route_id)
        if route is None:
            raise HTTPException(404, "No MuW route with this id.")
        return route
