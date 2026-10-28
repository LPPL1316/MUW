"""Write many words in many cities and keep every result (TASK-311, ADR-0271).

Not a test: it plans each word with `plan_route` from a city's centre, as
tests/measure_words.py does, for every word, city, kilometres a letter and
style asked, and appends one JSON line per case to `--out`. A case already
in the file is not planned again, so a stopped run goes on where it was.
Each city runs in a process of its own, its cases from the longest down:
the first zone a city asks is the largest, and the others are cropped from
it in memory. A zone not in `--cache-dir` is downloaded from Overpass and
saved there only with `--download`; without, or when Overpass does not
answer, the case is skipped and not written: the next run plans it. Each
city writes its own `<city>.jsonl` in `--out`, a directory.

    python tests/measure_words_many.py --cache-dir /tmp/zones --download \\
        --out /tmp/words
    python tests/measure_words_many.py --summary /tmp/words

A case is good as in tests/measure_stop_earlier.py: distance on the roads
within DISTANCE_TOLERANCE of the target and similarity at least
SIMILARITY_THRESHOLD. Traces are the engine's cost unit, seconds depend on
the machine.
"""

from __future__ import annotations

import argparse
import json
import multiprocessing
import sys
import time
from collections import defaultdict
from collections.abc import Iterable, Sequence
from functools import lru_cache
from pathlib import Path
from typing import Any

# The engine this script sits in, not the one a venv may have installed
# from another checkout: the measure is of this code.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from route_engine.geo import LatLon  # noqa: E402
from route_engine.models import RouteRequest  # noqa: E402
from route_engine.network import (  # noqa: E402
    BBox,
    Graph,
    OsmnxSource,
    crop,
    largest_piece,
    read_graph,
)
from route_engine.optimizer import (  # noqa: E402
    DISTANCE_TOLERANCE,
    SIMILARITY_THRESHOLD,
    ShapeNotDrawableError,
    plan_route,
)
from route_engine.words import STYLES, compose  # noqa: E402

CITIES: dict[str, LatLon] = {
    "trento": (46.0671, 11.1214),
    "milano": (45.4642, 9.1900),
    "torino": (45.0703, 7.6869),
    "bologna": (44.4949, 11.3426),
    "roma": (41.9028, 12.4964),
}

# Fifty words anyone may write, from 2 to 8 letters, in the app's
# languages: no names of people, so any of them may be offered to others.
WORDS: tuple[str, ...] = (
    "OK", "GO", "HI",
    "RUN", "MUW", "SUN", "JOY", "YES", "WOW", "SKY", "ZEN",
    "CIAO", "LOVE", "HOLA", "MARE", "SOLE", "PACE", "LUNA", "VITA", "FREE",
    "HOPE", "BIKE", "KISS", "ROMA",
    "AMORE", "HELLO", "FORZA", "BRAVO", "SMILE", "HAPPY", "PEACE", "DREAM",
    "MERCI", "DANKE", "ITALY",
    "GRAZIE", "AUGURI", "ITALIA", "ESTATE", "FAMILY", "FRIEND",
    "BONJOUR", "RUNNING", "VIAGGIO", "FREEDOM", "SORRISO",
    "MARATONA", "FAMIGLIA", "BIRTHDAY", "SUNSHINE",
)  # fmt: skip

# Waits before asking Overpass again for a zone, in seconds.
DOWNLOAD_WAITS_S: tuple[int, ...] = (60, 120, 240, 480, 960)


class MemoZones:
    """Zones from the cache, each file read once and cropped in memory;
    with `download`, a zone no file covers is fetched and saved first."""

    def __init__(self, cache_dir: Path, download: bool) -> None:
        self.source = OsmnxSource(cache_dir)
        self.download = download

    @lru_cache(maxsize=4)  # noqa: B019 - one instance a process
    def graph(self, path: Path) -> Graph:
        return read_graph(path)

    def load(self, bbox: BBox) -> Graph:
        exact = self.source.cache_path(bbox)
        if exact.exists():
            return largest_piece(self.graph(exact))
        covering = self.source.covering_path(bbox)
        if covering is not None:
            return crop(self.graph(covering), bbox)
        if not self.download:
            raise LookupError("zone not in the cache")
        # Overpass at capacity answers 502 or an empty body: wait and ask
        # again, longer each time, then leave the case to the next run.
        for wait_s in DOWNLOAD_WAITS_S:
            try:
                return self.source.load(bbox)
            except Exception as exc:  # noqa: BLE001 - any failed download
                print(f"zone download failed ({exc!s:.80}), again in {wait_s} s")
                time.sleep(wait_s)
        raise LookupError("zone download failed")


def case_key(case: dict[str, Any]) -> str:
    return (
        f"{case['word']}|{case['city']}|{case['km_letter']}|{case['style']}"
        f"|{case.get('pen_up', False)}"
    )


def cases_of(
    words: Iterable[str],
    cities: Iterable[str],
    km_letters: Iterable[int],
    styles: Iterable[str],
    pen_up: bool = False,
) -> list[dict[str, Any]]:
    return [
        {
            "word": word,
            "city": city,
            "km_letter": km,
            "style": style,
            "pen_up": pen_up,
            "distance_m": len(word) * km * 1000,
        }
        for word in words
        for city in cities
        for km in km_letters
        for style in styles
    ]


def plan_case(case: dict[str, Any], zones: MemoZones) -> dict[str, Any]:
    """One word planned from its city's centre, and what came of it."""
    word = compose(case["word"], style=case["style"])
    request = RouteRequest(
        start=CITIES[case["city"]],
        distance_m=case["distance_m"],
        word=word.text,
        pen_up=case.get("pen_up", False),
    )
    began = time.perf_counter()
    row = dict(case)
    try:
        plan = plan_route(request, zones, style=case["style"])
    except LookupError as exc:
        return row | {"outcome": "skipped", "reason": str(exc)}
    except ShapeNotDrawableError as exc:
        return row | {
            "outcome": "no route",
            "reason": str(exc),
            "seconds": round(time.perf_counter() - began, 1),
        }
    result = plan.result
    ratio = result.distance_m / case["distance_m"]
    good = (
        abs(ratio - 1) <= DISTANCE_TOLERANCE
        and result.similarity >= SIMILARITY_THRESHOLD
    )
    search = plan.search
    best = search.best if search is not None else None
    return row | {
        "outcome": "good" if good else "poor",
        "similarity": round(result.similarity, 3),
        "ratio": round(ratio, 3),
        "route_m": round(result.distance_m),
        "letter_height_m": (
            round(best.scale_m * word.height) if best is not None else None
        ),
        "rotation_deg": (round(best.rotation_deg % 360) if best is not None else None),
        "start_moved_m": round(best.offset_m) if best is not None else None,
        "traces": len(search.attempts) if search is not None else None,
        "seconds": round(time.perf_counter() - began, 1),
        "warnings": list(result.warnings),
        "points": [[round(lat, 6), round(lon, 6)] for lat, lon in result.points],
    }


def run_city(
    city: str, cases: Sequence[dict[str, Any]], cache_dir: Path, download: bool,
    out: Path,
) -> int:  # fmt: skip
    """A city's cases from the longest down, each line appended at once
    to the city's own file."""
    zones = MemoZones(cache_dir, download)
    done = 0
    for case in sorted(cases, key=lambda c: -c["distance_m"]):
        row = plan_case(case, zones)
        if row["outcome"] != "skipped":
            line = json.dumps(row, ensure_ascii=False)
            with (out / f"{city}.jsonl").open("a", encoding="utf-8") as file:
                file.write(line + "\n")
            done += 1
        print(
            f"{city:<8} {case['word']:<9} {case['km_letter']}km {case['style']:<5}"
            f" {row['outcome']:<8} {row.get('similarity', '')!s:>5}"
            f" {row.get('ratio', '')!s:>5} {row.get('seconds', '')!s:>5}s",
            flush=True,
        )
    return done


def read_rows(out: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for path in sorted(out.glob("*.jsonl"))
        for line in path.read_text(encoding="utf-8").splitlines()
        if line
    ]


def summary(rows: Sequence[dict[str, Any]]) -> str:
    """Good cases by kilometres a letter and style, by letters, by city."""
    planned = [r for r in rows if r["outcome"] != "skipped"]
    lines = [f"{len(planned)} cases planned, {len(rows) - len(planned)} skipped"]

    def table(title: str, key: Any) -> None:
        groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for row in planned:
            groups[key(row)].append(row)
        lines.append("")
        lines.append(title)
        for name in sorted(groups):
            group = groups[name]
            good = sum(r["outcome"] == "good" for r in group)
            sims = sorted(r.get("similarity", 0.0) for r in group)
            median = sims[len(sims) // 2]
            secs = sum(r.get("seconds", 0.0) for r in group) / len(group)
            lines.append(
                f"  {name!s:<22} {good:>4}/{len(group):<4} good"
                f" ({good / len(group):>4.0%}), median similarity {median:.2f},"
                f" {secs:.0f} s a case"
            )

    table("km a letter, style", lambda r: (r["km_letter"], r["style"]))
    table("letters, km a letter", lambda r: (len(r["word"]), r["km_letter"]))
    table("city, km a letter", lambda r: (r["city"], r["km_letter"]))
    table("city, style", lambda r: (r["city"], r["style"]))
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--cache-dir", type=Path, default=Path("../../data/cache"))
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--words", default=",".join(WORDS))
    parser.add_argument("--cities", default=",".join(CITIES))
    parser.add_argument("--km-letter", default="3,4", help="kilometres a letter")
    parser.add_argument("--styles", default=",".join(sorted(STYLES)))
    parser.add_argument(
        "--pen-up", action="store_true", help="each letter alone (TASK-197)"
    )
    parser.add_argument("--out", type=Path, default=Path("words"), help="a directory")
    parser.add_argument("--summary", type=Path, help="only summarise this directory")
    args = parser.parse_args(argv)
    if args.summary is not None:
        print(summary(read_rows(args.summary)))
        return 0

    cases = cases_of(
        args.words.split(","),
        args.cities.split(","),
        [int(km) for km in args.km_letter.split(",")],
        args.styles.split(","),
        args.pen_up,
    )
    args.out.mkdir(parents=True, exist_ok=True)
    seen = {case_key(r) for r in read_rows(args.out) if r["outcome"] != "skipped"}
    by_city: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for case in cases:
        if case_key(case) not in seen:
            by_city[case["city"]].append(case)
    print(f"{sum(map(len, by_city.values()))} cases to plan of {len(cases)}")
    with multiprocessing.get_context("spawn").Pool(len(by_city) or 1) as pool:
        pool.starmap(
            run_city,
            [
                (city, todo, args.cache_dir, args.download, args.out)
                for city, todo in by_city.items()
            ],
        )
    print(summary(read_rows(args.out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
