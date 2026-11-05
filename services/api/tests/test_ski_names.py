"""The lifts taken and the pistes skied in a day, by name (TASK-375 part D):
made-up lifts and pistes in metres around a point of the Dolomites, and
tracks along them with a fix every 20 m, a few metres off as GPS is.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from pathlib import Path

from route_engine.geo import LatLon, local_to_latlon

from shaperoute_api.ski_extract import Kind, SkiLine, write_tiles
from shaperoute_api.ski_names import (
    NOTHING,
    PISTE_MIN_M,
    SkiNames,
    Used,
    ski_names,
    ski_names_from,
)

ORIGIN: LatLon = (46.55, 11.75)
XY = tuple[float, float]


def line(
    ident: int,
    kind: Kind,
    kind_type: str,
    name: str | None,
    xy: Sequence[XY],
    area: bool = False,
) -> SkiLine:
    points = tuple(local_to_latlon(ORIGIN, x, y) for x, y in xy)
    return SkiLine(ident, kind, kind_type, name, points, area)


# A chairlift 1 km up to the north, and a red piste back down to its bottom
# by the west.
CHAIR = line(1, "lift", "chair_lift", "Seggiovia Col Raiser", [(0, 0), (0, 1000)])
ROSSA_XY: list[XY] = [(0, 1000), (-300, 700), (-300, 300), (0, 0)]
ROSSA = line(2, "piste", "intermediate", "Pista Rossa", ROSSA_XY)


def track(
    *legs: Sequence[XY], step_m: float = 20.0, off_m: float = 5.0
) -> list[LatLon]:
    """Fixes every `step_m` along each leg's polyline, `off_m` to one side
    and then the other."""
    out: list[LatLon] = []
    for leg in legs:
        for (x0, y0), (x1, y1) in zip(leg, leg[1:], strict=False):
            length = math.hypot(x1 - x0, y1 - y0)
            nx, ny = (y0 - y1) / length, (x1 - x0) / length
            for k in range(max(1, round(length / step_m))):
                t = k * step_m / length
                side = off_m if len(out) % 2 else -off_m
                x = x0 + (x1 - x0) * t + nx * side
                y = y0 + (y1 - y0) * t + ny * side
                out.append(local_to_latlon(ORIGIN, x, y))
        out.append(local_to_latlon(ORIGIN, *leg[-1]))
    return out


UP: list[XY] = [(0, 0), (0, 1000)]


def chair(times: int) -> Used:
    return Used("lift", "Seggiovia Col Raiser", "chair_lift", times)


def rossa(times: int) -> Used:
    return Used("piste", "Pista Rossa", "intermediate", times)


def test_two_rides_and_two_descents():
    day = track(UP, ROSSA_XY, UP, ROSSA_XY)
    assert ski_names(day, [CHAIR, ROSSA]) == SkiNames(
        lifts=(chair(2),), pistes=(rossa(2),)
    )


def test_skiing_down_under_the_chairlift_is_no_ride():
    day = track([(0, 1000), (0, 0)])
    assert ski_names(day, [CHAIR]).lifts == ()


def test_a_ride_then_down_beside_the_lift_then_another_are_two_rides():
    beside: list[XY] = [(0, 1000), (12, 900), (12, 100), (0, 0)]
    day = track(UP, beside, UP)
    assert ski_names(day, [CHAIR]).lifts == (chair(2),)


def test_walking_beside_a_few_metres_of_a_lift_is_no_ride():
    day = track([(0, 0), (0, 300)])
    assert ski_names(day, [CHAIR]).lifts == ()


def test_of_two_lifts_side_by_side_the_nearer_has_the_ride():
    baby = line(3, "lift", "drag_lift", "Skilift Baby", [(18, 0), (18, 1000)])
    day = track([(2, 0), (2, 1000)], off_m=2.0)
    assert ski_names(day, [baby, CHAIR]).lifts == (chair(1),)


def test_a_lift_without_a_name_keeps_its_type():
    drag = line(4, "lift", "drag_lift", None, [(500, 0), (500, 400)])
    day = track([(500, 0), (500, 400)])
    assert ski_names(day, [drag]).lifts == (Used("lift", None, "drag_lift", 1),)


def test_a_lift_with_a_middle_station_is_one_ride():
    low = line(5, "lift", "gondola", "Ciampinoi", [(0, 0), (0, 600)])
    high = line(6, "lift", "gondola", "Ciampinoi", [(0, 600), (0, 1200)])
    day = track([(0, 0), (0, 1200)])
    assert ski_names(day, [low, high]).lifts == (
        Used("lift", "Ciampinoi", "gondola", 1),
    )


def test_a_few_metres_of_a_piste_do_not_count():
    short: list[XY] = [(-300, 700), (-300, 600)]
    assert PISTE_MIN_M > 100
    assert ski_names(track(short), [ROSSA]).pistes == ()


def test_a_gps_jump_does_not_cut_a_descent_in_two():
    day = track(ROSSA_XY)
    middle = len(day) // 2
    for k in (middle, middle + 1):
        lat, lon = day[k]
        day[k] = (lat, lon + 80 / 76_500)
    assert ski_names(day, [ROSSA]).pistes == (rossa(1),)


def test_a_piste_without_a_name_is_not_counted():
    nameless = line(7, "piste", "easy", None, ROSSA_XY)
    assert ski_names(track(ROSSA_XY), [nameless]).pistes == ()


def test_a_piste_of_many_ways_is_one_name():
    first = line(8, "piste", "advanced", "Gran Risa", ROSSA_XY[:2])
    second = line(9, "piste", "advanced", "Gran Risa", ROSSA_XY[1:])
    names = ski_names(track(ROSSA_XY), [first, second])
    assert names.pistes == (Used("piste", "Gran Risa", "advanced", 1),)


def test_a_piste_mapped_as_an_area():
    field = line(
        10,
        "piste",
        "novice",
        "Campo scuola",
        [(-500, 0), (-300, 0), (-300, 200), (-500, 200), (-500, 0)],
        area=True,
    )
    zigzag: list[XY] = [(-480, 190), (-320, 140), (-480, 90), (-320, 40)]
    assert ski_names(track(zigzag), [field]).pistes == (
        Used("piste", "Campo scuola", "novice", 1),
    )


def test_the_order_of_the_day():
    gondola = line(11, "lift", "gondola", "Ciampinoi", [(-300, 300), (-300, 1300)])
    day = track([(-300, 300), (-300, 1300)], [(-300, 1300), (0, 1000)], ROSSA_XY, UP)
    names = ski_names(day, [CHAIR, gondola, ROSSA])
    assert [used.name for used in names.lifts] == ["Ciampinoi", "Seggiovia Col Raiser"]


def test_nothing_without_lines_or_track():
    assert ski_names(track(UP), []) == NOTHING
    assert ski_names([ORIGIN], [CHAIR]) == NOTHING
    assert ski_names([], [CHAIR]) == NOTHING


def test_from_the_tiles(tmp_path: Path):
    write_tiles([CHAIR, ROSSA], tmp_path)
    day = track(UP, ROSSA_XY)
    assert ski_names_from(day, tmp_path) == ski_names(day, [CHAIR, ROSSA])
    assert ski_names_from(day, tmp_path / "empty") == NOTHING
