"""A city's examples drawn before anyone asks for them (ADR-0136).

The API keeps a city's examples once drawn (route_store.py): the first phone
in a city waits, the next do not. This command is that first phone, for a
list of cities: it asks a running API what the app asks when a city is
tapped, the city by name and then a circle, a heart and a star of 5 km from
its centre, one at a time, and waits for each. The circle goes first, as in
the app: its zone holds the other two (ADR-0144). With --all also the
shapes and the words the app asks after those three (city_examples.py,
TASK-316): the whole of what a phone finds ready when it taps the city.

    python -m shaperoute_api.draw_examples --api http://127.0.0.1:8000 Rovereto
    python -m shaperoute_api.draw_examples --api https://... --preset italy

With --around, the towns a phone near that city is shown in "Explore"
and those it prepares as it opens (TASK-316, ADR-0276): the towns of GET
/nearby-cities around the city, then the towns around each of them, each
drawn from the point /nearby-cities gives it (for a village it is not the
one of /cities, TASK-236), at most --towns of them.

    python -m shaperoute_api.draw_examples --api ... --all --around Trento

Run again, it goes through the cities already kept in a moment. The API's
key, when it asks for one, comes from SHAPEROUTE_API_KEY. A city whose zone
is not on the API's disk is downloaded by it, as for a phone: see
prefetch_zones.py for the zones of many cities at once.

With --water it is also the first phone on the water (TASK-246 part B): for
each point of the app's lists of lakes and beaches (water_spots.py) the
eight «Paddle» shapes a phone asks from it, at the point's distance, the
shapes in pieces with the pen up, as the app asks them. A point whose water
is not on the API's disk is skipped after its first shape, as the phone
does. --water-name only the points of a lake or beach.

    python -m shaperoute_api.draw_examples --api http://127.0.0.1:8000 --water
    python -m shaperoute_api.draw_examples --api ... --water-name "Lago di Levico"

With --swim the same points are swum (TASK-323 C4): the eight shapes as the
app's «Explore» asks them with «Open water swim» (SWIM_EXAMPLES), 1 km from
each point, the laps the engine chooses. Within 150 m of the shore a shape
may not fit at a point: that is the engine's answer, not a failure.

    python -m shaperoute_api.draw_examples --api ... --swim
    python -m shaperoute_api.draw_examples --api ... --swim --water-name Riccione
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any

from shaperoute_api.access import KEY_HEADER, KEY_VARIABLE
from shaperoute_api.city_examples import name_of
from shaperoute_api.city_examples import requests as every_example
from shaperoute_api.paddle_examples import ACTIVITY as WATER_ACTIVITY
from shaperoute_api.paddle_examples import SHAPES as WATER_SHAPES
from shaperoute_api.paddle_examples import apart_on_water
from shaperoute_api.prefetch_zones import EXAMPLE_DISTANCE_M, EXAMPLE_SHAPES, PRESETS
from shaperoute_api.route_store import cell
from shaperoute_api.water_spots import WaterSpot, read_spots

# Method, path and body in; status and JSON body out.
Call = Callable[[str, str, dict[str, Any] | None], tuple[int, Any]]

# The app's SWIM_EXAMPLES (src/swim/swimExamples.ts): 1 km, swum.
SWIM_ACTIVITY = "swimming"
SWIM_DISTANCE_M = 1000

# The app's DRAW_ORDER on the water: the first shapes, then the others.
WATER_ORDER = (
    *EXAMPLE_SHAPES,
    *(shape for shape in WATER_SHAPES if shape not in EXAMPLE_SHAPES),
)

POLL_S = 2.0
# A zone to download and three plans: the app waits as long (routes.ts).
MAX_WAIT_S = 300.0
# 429 too_many_requests (access.py): the API says how long, at most this.
MAX_RETRY_S = 90.0
# The city search that did not answer (503, the service failed; 5xx from in
# front of the API) is asked again, a moment later, as many times more
# (TASK-288): a city it did not answer for is not one it did not find.
CITY_SEARCH_RETRIES = 3
CITY_SEARCH_WAIT_S = 10.0
# --around: as many towns, the nearest rings first (the app prepares 18).
AROUND_TOWNS = 20


@dataclass
class Drawn:
    """What became of one city."""

    city: str
    label: str | None = None  # None: the city search did not find it
    # The city search's status when it did not answer, every time: "http_503".
    unanswered: str | None = None
    # For each shape: "kept" (already there), "drawn", or the error's code.
    shapes: dict[str, str] = field(default_factory=dict)
    seconds: float = 0.0
    # What counts as done for a shape: a swim's shape that does not fit
    # within 150 m of the shore is an answer too (draw_swim).
    answers: frozenset[str] = frozenset({"kept", "drawn"})

    @property
    def ready(self) -> bool:
        return self.label is not None and all(
            said in self.answers for said in self.shapes.values()
        )

    def line(self) -> str:
        if self.unanswered is not None:
            return f"{self.city}: the city search did not answer ({self.unanswered})"
        if self.label is None:
            return f"{self.city}: not found by the city search"
        shapes = ", ".join(f"{shape} {said}" for shape, said in self.shapes.items())
        return f"{self.label}: {shapes} ({self.seconds:.0f} s)"


def http_call(api: str, key: str | None, timeout_s: float = 30.0) -> Call:
    headers = {"Content-Type": "application/json"}
    if key:
        headers[KEY_HEADER] = key

    def call(method: str, path: str, body: dict[str, Any] | None) -> tuple[int, Any]:
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            api.rstrip("/") + path, data=data, method=method, headers=headers
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout_s) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as exc:
            try:
                answer = json.loads(exc.read())
            except ValueError:
                answer = None
            if exc.code == 429:
                answer = {"retry_after_s": exc.headers.get("Retry-After")}
            return exc.code, answer

    return call


def _ask_city_search(
    path: str, call: Call, sleep: Callable[[float], None]
) -> tuple[int, Any]:
    """GET `path` of the city search, again while it does not answer."""
    status, found = call("GET", path, None)
    for _ in range(CITY_SEARCH_RETRIES):
        if status < 500:
            break
        sleep(CITY_SEARCH_WAIT_S)
        status, found = call("GET", path, None)
    return status, found


def draw_city(
    city: str,
    call: Call,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    every: bool = False,
) -> Drawn:
    """A city found by name, its first three shapes; with `every`, all its
    examples (city_examples.py)."""
    began = clock()
    drawn = Drawn(city)
    status, found = _ask_city_search(
        f"/cities?q={urllib.parse.quote(city)}", call, sleep
    )
    if status >= 500:
        drawn.unanswered = f"http_{status}"
        drawn.seconds = clock() - began
        return drawn
    places = found.get("places") if status == 200 and isinstance(found, dict) else None
    if not places:
        return drawn
    drawn.label = places[0]["label"]
    _draw_examples(drawn, places[0]["point"], call, sleep, clock, every)
    drawn.seconds = clock() - began
    return drawn


def draw_town(
    label: str,
    point: list[float],
    call: Call,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    every: bool = False,
) -> Drawn:
    """A town of /nearby-cities from its own point, as a phone asks it."""
    began = clock()
    drawn = Drawn(label, label=label)
    _draw_examples(drawn, point, call, sleep, clock, every)
    drawn.seconds = clock() - began
    return drawn


def _draw_examples(
    drawn: Drawn,
    point: list[float],
    call: Call,
    sleep: Callable[[float], None],
    clock: Callable[[], float],
    every: bool,
) -> None:
    asked_all = (
        every_example(list(point))
        if every
        else [
            {
                "shape": shape,
                "distance_m": EXAMPLE_DISTANCE_M,
                "start": point,
                "activity": "running",
            }
            for shape in EXAMPLE_SHAPES
        ]
    )
    for asked in asked_all:
        name = name_of(asked)
        drawn.shapes[name] = _draw(asked, call, sleep, clock)
        if drawn.shapes[name] == "map_data_unavailable":
            break  # the other shapes would end the same (exampleRoutes.ts)


def towns_around(
    city: str,
    call: Call,
    most: int = AROUND_TOWNS,
    sleep: Callable[[float], None] = time.sleep,
) -> list[tuple[str, list[float]]] | None:
    """The towns of /nearby-cities around `city`, then around each of them,
    one a square of 10 m, the nearest rings first: (label, point). None when
    the city search does not find the city or does not answer."""
    status, found = _ask_city_search(
        f"/cities?q={urllib.parse.quote(city)}", call, sleep
    )
    places = found.get("places") if status == 200 and isinstance(found, dict) else None
    if not places:
        return None
    towns: list[tuple[str, list[float]]] = []
    seen = {cell(tuple(places[0]["point"]))}  # the city itself: by name

    def near(point: list[float]) -> list[tuple[str, list[float]]]:
        lat, lon = point
        status, body = _ask_city_search(
            f"/nearby-cities?lat={lat}&lon={lon}", call, sleep
        )
        found = body.get("places") if status == 200 and isinstance(body, dict) else None
        return [(p["label"], list(p["point"])) for p in found or []]

    ring = near(places[0]["point"])
    while ring and len(towns) < most:
        added = []
        for label, point in ring:
            if cell(tuple(point)) not in seen and len(towns) < most:
                seen.add(cell(tuple(point)))
                towns.append((label, point))
                added.append(point)
        ring = [town for point in added for town in near(point)]
    return towns


def draw_spot(
    spot: WaterSpot,
    call: Call,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> Drawn:
    """The eight shapes of a point on the water, as a phone asks them
    (aheadExamples.ts): from the point, at its distance, on the water."""
    drawn = Drawn(spot.name, label=f"{spot.name} ({cell(spot.point)})")
    return _on_water(drawn, spot, WATER_ACTIVITY, spot.distance_m, call, sleep, clock)


def draw_swim(
    spot: WaterSpot,
    call: Call,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> Drawn:
    """The eight shapes of a point swum, as «Explore» asks them with «Open
    water swim» (TASK-323 C4): from the point, SWIM_DISTANCE_M, the laps the
    engine chooses. A shape that does not fit there is answered."""
    drawn = Drawn(
        spot.name,
        label=f"{spot.name} swum ({cell(spot.point)})",
        answers=frozenset({"kept", "drawn", "shape_not_drawable"}),
    )
    return _on_water(drawn, spot, SWIM_ACTIVITY, SWIM_DISTANCE_M, call, sleep, clock)


def _on_water(
    drawn: Drawn,
    spot: WaterSpot,
    activity: str,
    distance_m: int,
    call: Call,
    sleep: Callable[[float], None],
    clock: Callable[[], float],
) -> Drawn:
    began = clock()
    for shape in WATER_ORDER:
        asked: dict[str, Any] = {
            "shape": shape,
            "distance_m": distance_m,
            "start": list(spot.point),
            "activity": activity,
        }
        if apart_on_water(shape):
            asked["pen_up"] = True
        drawn.shapes[shape] = _draw(asked, call, sleep, clock)
        if drawn.shapes[shape] == "map_data_unavailable":
            break  # no water of this point on the API's disk: the next point
    drawn.seconds = clock() - began
    return drawn


def water_spots(names: Sequence[str] = ()) -> list[WaterSpot]:
    """The points of the lists, one a square of 10 m, only those named
    `names` when there are some."""
    wanted = {name.casefold() for name in names}
    seen: set[str] = set()
    spots: list[WaterSpot] = []
    for spot in read_spots():
        if wanted and spot.name.casefold() not in wanted:
            continue
        if cell(spot.point) not in seen:
            seen.add(cell(spot.point))
            spots.append(spot)
    return spots


def _draw(
    asked: dict[str, Any],
    call: Call,
    sleep: Callable[[float], None],
    clock: Callable[[], float],
) -> str:
    status, job = call("POST", "/route-jobs", asked)
    if status == 429:
        # One POST after the other, a city already kept takes no time.
        try:
            wait = float(job["retry_after_s"])
        except (KeyError, TypeError, ValueError):
            wait = MAX_RETRY_S
        sleep(min(wait, MAX_RETRY_S))
        status, job = call("POST", "/route-jobs", asked)
    if status != 202 or not isinstance(job, dict):
        return _code(job) or f"http_{status}"
    if job["status"] == "done":
        return "kept"
    deadline = clock() + MAX_WAIT_S
    while job["status"] not in ("done", "failed"):
        if clock() >= deadline:
            call("DELETE", f"/route-jobs/{job['job_id']}", None)
            return "timeout"
        sleep(POLL_S)
        status, answer = call("GET", f"/route-jobs/{job['job_id']}", None)
        if status != 200 or not isinstance(answer, dict):
            return _code(answer) or f"http_{status}"
        job = answer
    return "drawn" if job["status"] == "done" else (_code(job) or "failed")


def _code(body: Any) -> str | None:
    error = body.get("error") if isinstance(body, dict) else None
    code = error.get("code") if isinstance(error, dict) else None
    return code if isinstance(code, str) else None


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m shaperoute_api.draw_examples",
        description="Draw the examples of cities before anyone asks for them.",
    )
    parser.add_argument("cities", nargs="*", help="city names, as typed in the app")
    parser.add_argument("--preset", choices=sorted(PRESETS), action="append")
    parser.add_argument("--api", required=True, help="where the API answers")
    parser.add_argument(
        "--all",
        action="store_true",
        help="every example the app asks a city for, not only the first three",
    )
    parser.add_argument(
        "--around",
        action="append",
        default=[],
        metavar="CITY",
        help="also the towns near this city and near those (repeat)",
    )
    parser.add_argument(
        "--towns",
        type=int,
        default=AROUND_TOWNS,
        help=f"towns for each --around (default {AROUND_TOWNS})",
    )
    parser.add_argument(
        "--water",
        action="store_true",
        help="also the Paddle shapes of every point of the lakes and beaches",
    )
    parser.add_argument(
        "--water-name",
        action="append",
        default=[],
        help=(
            "only the points of this lake or beach (repeat); implies --water "
            "unless --swim"
        ),
    )
    parser.add_argument(
        "--swim",
        action="store_true",
        help="the Open water swim shapes of the points of the lakes and beaches",
    )
    args = parser.parse_args(argv)
    cities = list(args.cities)
    for preset in args.preset or []:
        cities += [c for c in PRESETS[preset] if c not in cities]
    paddled = args.water or (bool(args.water_name) and not args.swim)
    spots = water_spots(args.water_name) if paddled else []
    swims = water_spots(args.water_name) if args.swim else []
    if not cities and not spots and not swims and not args.around:
        parser.error("name some cities, a --preset, --around, --water or --swim")
    call = http_call(args.api, os.environ.get(KEY_VARIABLE, "").strip() or None)
    # Without --all, draw_city is called as it always was.
    every: dict[str, bool] = {"every": True} if args.all else {}
    towns: list[tuple[str, list[float]]] = []
    for city in args.around:
        try:
            around = towns_around(city, call, args.towns)
        except OSError as exc:
            print(f"{city}: the API did not answer ({type(exc).__name__})")
            return 1
        if around is None:
            print(f"{city}: no towns around it (not found, or no answer)")
            continue
        known = {cell(tuple(point)) for _, point in towns}
        towns += [(label, p) for label, p in around if cell(tuple(p)) not in known]
    ready = {"cities": 0, "points on the water": 0, "points swum": 0}
    jobs: list[tuple[str, str, Callable[[], Drawn]]] = (
        [
            ("cities", city, lambda city=city: draw_city(city, call, **every))
            for city in cities
        ]
        + [
            (
                "cities",
                label,
                lambda label=label, point=point: draw_town(label, point, call, **every),
            )
            for label, point in towns
        ]
        + [
            ("points on the water", spot.name, lambda spot=spot: draw_spot(spot, call))
            for spot in spots
        ]
        + [
            ("points swum", spot.name, lambda spot=spot: draw_swim(spot, call))
            for spot in swims
        ]
    )
    for kind, name, job in jobs:
        try:
            drawn = job()
        except OSError as exc:
            # The API is not there: no place after this one would do better.
            print(f"{name}: the API did not answer ({type(exc).__name__})")
            return 1
        print(drawn.line(), flush=True)
        ready[kind] += drawn.ready
    if cities or towns:
        asked = len(cities) + len(towns)
        print(f"{ready['cities']} of {asked} cities have their examples")
    if spots:
        print(
            f"{ready['points on the water']} of {len(spots)} points on the water "
            "have their shapes"
        )
    if swims:
        print(f"{ready['points swum']} of {len(swims)} points have their swims")
    return 0 if sum(ready.values()) == len(jobs) else 1


if __name__ == "__main__":
    raise SystemExit(main())
