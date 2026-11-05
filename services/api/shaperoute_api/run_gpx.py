"""A saved run as a GPX file with its times (TASK-187, ADR-0156,
docs/GPX.md).

Not the route's GPX, which the engine writes (export_gpx.py): that is a
line to follow, without times. This is where the runner was and when, as
`runs` keeps it: the file another service reads as an activity done. It is
written when it is sent and kept nowhere.

A pause closes a track segment and the next point opens another, as GPX
wants for a receiver switched off: what the runner did in a pause is not of
the run, so the points taken inside one are left out.

A walk's track says so, `<type>walking</type>` after its name (TASK-371,
ADR-0315), so Strava and the watches take it as a walk; the route's GPX of a
walk gets it too, from `with_type`. The other sports' files are as before,
byte for byte (`gpx_type`).
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from shaperoute_api.sports import API_SPORTS

GPX_NAMESPACE = "http://www.topografix.com/GPX/1/1"
CREATOR = "MuW"
# 7 decimals of a degree are about 1 cm, as in the route's GPX.
COORDINATE_DECIMALS = 7

Fix = tuple[float, float, float]
"""(lat, lon, seconds since the first point)."""
Span = tuple[float, float]
"""A pause, (from, to), on the clock of the fixes."""

# The activities whose track says its sport in `<type>`: the walk only, its
# GPX otherwise a run's (TASK-371); each sport says it (TASK-376).
GPX_TYPES = {sport.activity: sport.gpx_type for sport in API_SPORTS if sport.gpx_type}


def gpx_type(activity: str | None) -> str | None:
    """The `<type>` of a track of `activity`: None for every sport but the
    walk, whose files stay as they were."""
    return None if activity is None else GPX_TYPES.get(activity)


def segments(fixes: Sequence[Fix], pauses: Sequence[Span]) -> list[list[Fix]]:
    """The fixes cut where a pause falls between two of them, without those
    taken inside one. A pause that begins on a fix leaves it in what came
    before, as the API counts the metres (activities.py)."""
    cut: list[list[Fix]] = []
    last_s: float | None = None
    for fix in fixes:
        at_s = fix[2]
        if any(start < at_s < end for start, end in pauses):
            continue
        paused = last_s is not None and any(
            last_s <= start < at_s for start, _ in pauses
        )
        if last_s is None or paused:
            cut.append([])
        cut[-1].append(fix)
        last_s = at_s
    return cut


def _time(when: datetime) -> str:
    """UTC to the millisecond: two fixes of one second keep their order."""
    utc = when.astimezone(UTC)
    return f"{utc:%Y-%m-%dT%H:%M:%S}.{utc.microsecond // 1000:03d}Z"


def run_gpx(
    fixes: Sequence[Fix],
    pauses: Sequence[Span],
    started_at: datetime,
    name: str | None = None,
    activity: str | None = None,
) -> str:
    """The run as a GPX 1.1 document: one track, a segment for each stretch
    between two pauses, a time on every point, and the track's `<type>` for
    a walk (gpx_type). `started_at` is the time of the first fix and must
    be timezone-aware."""
    if started_at.tzinfo is None:
        raise ValueError("GPX time must be timezone-aware")

    ET.register_namespace("", GPX_NAMESPACE)
    ns = f"{{{GPX_NAMESPACE}}}"
    gpx = ET.Element(f"{ns}gpx", {"version": "1.1", "creator": CREATOR})
    metadata = ET.SubElement(gpx, f"{ns}metadata")
    if name is not None:
        ET.SubElement(metadata, f"{ns}name").text = name
    ET.SubElement(metadata, f"{ns}time").text = _time(started_at)

    trk = ET.SubElement(gpx, f"{ns}trk")
    if name is not None:
        ET.SubElement(trk, f"{ns}name").text = name
    kind = gpx_type(activity)
    if kind is not None:
        ET.SubElement(trk, f"{ns}type").text = kind
    for segment in segments(fixes, pauses):
        trkseg = ET.SubElement(trk, f"{ns}trkseg")
        for lat, lon, at_s in segment:
            trkpt = ET.SubElement(
                trkseg,
                f"{ns}trkpt",
                {
                    "lat": f"{lat:.{COORDINATE_DECIMALS}f}",
                    "lon": f"{lon:.{COORDINATE_DECIMALS}f}",
                },
            )
            ET.SubElement(trkpt, f"{ns}time").text = _time(
                started_at + timedelta(seconds=at_s)
            )

    ET.indent(gpx)
    body = ET.tostring(gpx, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{body}\n'


def with_type(gpx: str, activity: str) -> str:
    """The GPX document `gpx` (export_gpx.to_gpx) with the `<type>` of each
    track, after the track's name as GPX 1.1 orders them, for a walk
    (gpx_type); for every other activity `gpx` itself, unchanged."""
    kind = gpx_type(activity)
    if kind is None:
        return gpx
    ET.register_namespace("", GPX_NAMESPACE)
    ns = f"{{{GPX_NAMESPACE}}}"
    root = ET.fromstring(gpx)
    for trk in root.iter(f"{ns}trk"):
        named = trk.find(f"{ns}name") is not None
        element = ET.Element(f"{ns}type")
        element.text = kind
        trk.insert(1 if named else 0, element)
    ET.indent(root)
    body = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{body}\n'
