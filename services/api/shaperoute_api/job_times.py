"""How long each phase of a route job took: one line in the log for each
job (TASK-289, ADR-0250), so that the server's seconds can be read phase by
phase before choosing how it computes more routes an hour (TASK-276).

The line is `key=value` pairs, seconds with two decimals, `-` for what the
job does not know (a route on the water has no start's plan, a failed one no
nearby starts):

- `total`: the job, from its thread taking it to its answer.
- `crop`, `loads`, `download`: the graphs the job loaded, how many, and of
  those the ones that downloaded their zone first. Without a download a
  load reads the zone when it is not in memory and crops it
  (graphs.ZoneGraphs.load).
- `start`, `traces`, `converged`, `far`: the plan from the user's start
  (route_engine.nearby_starts), the traces of its search and of the one
  farther away, whether its search converged, whether it looked farther
  away (ADR-0040). The farther search's own crop is in `start` too.
- `wait`: what the nearby starts add to the start's plan (ADR-0071): the
  graph pickled and their processes started before it, the wait for them
  after it, and the choice between the plans. The planner's seconds less
  the first crop and the start's plan.
- `nearby`: each nearby start's plan, in its own process, `-` for one that
  gave no answer in time; `none` when there were none. `chosen`: the start
  whose route was kept, 0 for the user's own.
- `directions`: the directions of the route and of its alternatives.

Seconds and counts only: where the user is never goes in the log (TASK-091,
ADR-0092).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from route_engine.nearby_starts import NearbyPlan
from route_engine.optimizer import Plan


@dataclass
class JobTimes:
    """A job's seconds, phase by phase, as they come."""

    loads: int = 0
    crop_s: float = 0.0
    download_s: float = 0.0
    first_load_s: float = 0.0
    planner_s: float | None = None
    directions_s: float | None = None
    nearby: NearbyPlan | None = None

    def loaded(self, seconds: float, downloaded: bool) -> None:
        if self.loads == 0:
            self.first_load_s = seconds
        self.loads += 1
        if downloaded:
            self.download_s += seconds
        else:
            self.crop_s += seconds


@runtime_checkable
class NotesNearby(Protocol):
    """A job's graph source that keeps the job's times (jobs._Reporting)."""

    def note_nearby(self, nearby: NearbyPlan) -> None: ...


def noted(source: object, nearby: NearbyPlan) -> Plan:
    """`nearby`'s plan, once `source` has kept how it went, if it keeps a
    job's times: the planner returns the plan alone."""
    if isinstance(source, NotesNearby):
        source.note_nearby(nearby)
    return nearby.plan


def line(times: JobTimes, total_s: float) -> str:
    """The job's times for the log, in the order of the module's notes."""
    nearby = times.nearby
    start = nearby.tried[0] if nearby is not None and nearby.tried else None
    plan = None if start is None else start.plan
    search = None if plan is None else plan.search
    traces = converged = far = wait = "-"
    if plan is not None and search is not None:
        counted = len(search.attempts)
        if plan.far is not None and plan.far is not search:
            counted += len(plan.far.attempts)
        traces = str(counted)
        converged = _yes(search.converged)
        far = _yes(plan.far is not None)
    if nearby is not None and start is not None and times.planner_s is not None:
        rest = times.planner_s - times.first_load_s - (start.seconds or 0.0)
        wait = _seconds(max(0.0, rest))
    pairs = [
        ("total", _seconds(total_s)),
        ("crop", _seconds(times.crop_s)),
        ("loads", str(times.loads)),
        ("download", _seconds(times.download_s)),
        ("start", "-" if start is None else _seconds(start.seconds)),
        ("traces", traces),
        ("converged", converged),
        ("far", far),
        ("wait", wait),
        ("nearby", "-" if nearby is None else _each(nearby)),
        ("chosen", "-" if nearby is None else str(nearby.chosen)),
        ("directions", _seconds(times.directions_s)),
    ]
    return " ".join(f"{key}={value}" for key, value in pairs)


def _each(nearby: NearbyPlan) -> str:
    return ",".join(_seconds(t.seconds) for t in nearby.tried[1:]) or "none"


def _seconds(value: float | None) -> str:
    if value is None or not math.isfinite(value):
        return "-"
    return f"{value:.2f}"


def _yes(value: bool) -> str:
    return "yes" if value else "no"
