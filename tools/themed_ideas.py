"""Plan the ideas of «Ask for a route» in «Explore»: themed routes in big
European cities, ready to open without waiting.

Usage (from the repository root, with the API and the route-engine
installed, and GEOAPIFY_API_KEY in the environment):

    python tools/themed_ideas.py --cache-dir out/explore-ideas/cache

Each idea is a request as the app sends it from «Ask for a route», the
category, the shape and the distance in words («Famous Places star 8 km»),
from the centre of a city found by the API's own city search. The API's
themed jobs read the words with their tables (no AI), find the places of the
theme with Geoapify and plan the shape through them with the route engine:
nothing here invents a coordinate. The answers go to
``apps/mobile/src/explore/themedIdeas.json``, in the shape of the result of
GET /themed-route-jobs/{id}, so the app shows an idea as a route it asked
for. After a run, format the file as the rest of the app:

    npx prettier --write apps/mobile/src/explore/themedIdeas.json

The ideas kept are the ones whose route reads well when looked at: the
engine's similarity says little about it (TASK-290). ``--only`` plans some
again; the others are kept from the file as they are. When the public
Overpass is full, ``--overpass-url`` downloads the streets from another one:
only the boxes around the cities go there.

The API is imported only to plan: the rest, and the tests, run with the
route-engine's tools alone, like CI's tools job.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sample_feed import simplified

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "apps" / "mobile" / "src" / "explore" / "themedIdeas.json"

# As the previews of the API (recommended.py): about one metre.
COORD_DECIMALS = 5
# The line of a card, as the drawings of «Feed» (sample_feed.py): the app
# draws every stretch of a card as one view.
PREVIEW_POINTS = 120


@dataclass(frozen=True)
class Idea:
    city: str
    """The city's name, as the API's city search finds it and the app shows
    it."""
    category: str
    """A category of «Ask for a route» (apps/mobile/src/explore/presets.ts),
    in the words the API's tables read."""
    shape: str
    """A shape the API reads in words (themes.SHAPE_WORDS)."""
    km: int

    @property
    def id(self) -> str:
        words = (self.city, self.category, self.shape)
        return "-".join(w.lower().replace(" ", "-") for w in words)

    @property
    def text(self) -> str:
        """The request, as «Make it near me» sends it again from the start."""
        return f"{self.category} {self.shape} {self.km} km"


# The four categories the user chose for the ideas (2026-10-29), in eight big
# cities of Europe, with simple shapes; in the order of the row.
IDEAS: tuple[Idea, ...] = (
    Idea("Rome", "Famous Places", "star", 8),
    Idea("Paris", "Best Views", "heart", 8),
    Idea("London", "Famous Places", "heart", 8),
    Idea("Barcelona", "Photography", "star", 8),
    Idea("Amsterdam", "Hidden Gems", "heart", 6),
    Idea("Lisbon", "Best Views", "circle", 6),
    Idea("Prague", "Famous Places", "circle", 6),
    Idea("Berlin", "Hidden Gems", "star", 8),
    Idea("Rome", "Photography", "heart", 6),
    Idea("Paris", "Famous Places", "star", 10),
    Idea("London", "Best Views", "moon", 8),
    Idea("Barcelona", "Hidden Gems", "moon", 6),
)


def rounded(point: Sequence[float]) -> list[float]:
    return [round(point[0], COORD_DECIMALS), round(point[1], COORD_DECIMALS)]


def entry(idea: Idea, result: dict[str, Any]) -> dict[str, Any]:
    """One idea of the file: its words, the line of its card, and the API's
    result with its points rounded and the city named as the idea names it."""
    kept = dict(result)
    kept["points"] = [rounded(p) for p in result["points"]]
    line = [(p[0], p[1]) for p in kept["points"]]
    kept["centre"] = rounded(result["centre"])
    kept["distance_m"] = round(result["distance_m"])
    kept["similarity"] = round(result["similarity"], 3)
    kept["city"] = idea.city
    kept["stops"] = [
        {**stop, "point": rounded(stop["point"])} for stop in result["stops"]
    ]
    return {
        "id": idea.id,
        "city": idea.city,
        "category": idea.category,
        "text": idea.text,
        "preview": [list(p) for p in simplified(line, PREVIEW_POINTS)],
        "result": kept,
    }


def ideas_file(
    ideas: Sequence[Idea],
    plan: Callable[[Idea], dict[str, Any]],
    kept: dict[str, dict[str, Any]],
    only: set[str] | None = None,
    log: Callable[[str], None] = print,
) -> dict[str, Any]:
    """The file's content: every idea planned, or kept from the file when
    `only` names others (an empty `only` plans none). An idea that fails is
    left out, and said."""
    out: list[dict[str, Any]] = []
    for idea in ideas:
        if only is not None and idea.id not in only and idea.id in kept:
            # Written again: a change of the file's form reaches it too.
            out.append(entry(idea, kept[idea.id]["result"]))
            continue
        started = time.monotonic()
        try:
            result = plan(idea)
        except Exception as exc:  # the engine's, the places': said, not fatal
            log(f"{idea.id}: failed ({exc})")
            continue
        passed = sum(1 for s in result["stops"] if s["passed"])
        log(
            f"{idea.id}: {result['distance_m'] / 1000:.1f} km, "
            f"similarity {result['similarity']:.2f}, passes {passed} "
            f"of {len(result['stops'])} ({time.monotonic() - started:.0f} s)"
        )
        out.append(entry(idea, result))
    return {"ideas": out}


def read_kept(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    body = json.loads(path.read_text(encoding="utf-8"))
    return {idea["id"]: idea for idea in body.get("ideas", [])}


def api_planner(
    cache_dir: Path, overpass_url: str | None = None
) -> Callable[[Idea], dict[str, Any]]:
    """Plans an idea as POST /themed-route-jobs does: the API's own jobs,
    the tables without the AI, the zones in `cache_dir`, downloaded from
    `overpass_url` when given (another public Overpass, when the usual one
    is full)."""
    if overpass_url is not None:
        import osmnx

        osmnx.settings.overpass_url = overpass_url
    from shaperoute_api.activity_graphs import ActivityGraphs
    from shaperoute_api.cities import CitySearch
    from shaperoute_api.themed import StopFinder, ThemedJobs, ThemedRequestBody

    key = os.environ.get("GEOAPIFY_API_KEY") or None
    if key is None:
        raise SystemExit("GEOAPIFY_API_KEY is needed: the places and the cities.")
    cities = CitySearch(key)
    jobs = ThemedJobs(
        ActivityGraphs.from_cache(cache_dir).for_activity("running"),
        StopFinder(key),
        cities=cities,
        run_inline=True,
    )

    def plan(idea: Idea) -> dict[str, Any]:
        found = cities.search(idea.city)
        if not found:
            raise RuntimeError(f"no city {idea.city!r}")
        body = ThemedRequestBody(
            text=idea.text, centre=found[0].point, city=found[0].label
        )
        result = jobs.result_of(body)
        if result.shape != idea.shape:
            raise RuntimeError(f"read as {result.shape}, not {idea.shape}")
        return result.model_dump(mode="json")

    return plan


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--only", nargs="*", help="ids of the ideas to plan again")
    parser.add_argument(
        "--overpass-url", help="another Overpass API, e.g. when the usual is full"
    )
    args = parser.parse_args(argv)
    kept = read_kept(args.out)
    only = None if args.only is None else set(args.only)
    planner = api_planner(args.cache_dir, args.overpass_url)
    body = ideas_file(IDEAS, planner, kept, only)
    args.out.write_text(
        json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{len(body['ideas'])} of {len(IDEAS)} ideas in {args.out}")
    return 0 if len(body["ideas"]) == len(IDEAS) else 1


if __name__ == "__main__":
    sys.exit(main())
