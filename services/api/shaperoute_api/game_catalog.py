"""The shapes of the game (TASK-296, ADR-0255, docs/GIOCO.md §5.3).

In the API's code, so changing a shape or what it asks costs a deploy of
the API and no update of the app: GET /game/catalog serves it whole. Each
outline is in the drawing's coordinates, from 0 to 1 with y downwards as on
a screen, never geographic. The game's shapes are collectables: they lock
nothing in «Draw».

The outlines of star, heart, circle, moon, sun, lightning, arrow and crown
are the engine's (route_engine/shapes/); triangle, square, hexagon and
diamond are regular polygons drawn here.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

from route_engine.shapes import OUTLINES, SHAPES
from route_engine.shapes.outline import read_outline

from shaperoute_api.game_rules import DistanceGoal, Goal, PaceGoal

# Points of an engine outline, equally spaced along it: enough for a card.
OUTLINE_POINTS = 96
LANGUAGES = ("en", "de", "it", "es", "fr")

Point = tuple[float, float]


@dataclass(frozen=True)
class GameShape:
    id: str
    # The name, in each language of the app.
    names: dict[str, str]
    goal: Goal
    # Closed: the last point is the first.
    outline: tuple[Point, ...]


def _on_card(points: Sequence[Point]) -> tuple[Point, ...]:
    """From the engine's square [-1, 1]², y upwards, to [0, 1]², y down."""
    return tuple((round((x + 1) / 2, 4), round((1 - y) / 2, 4)) for x, y in points)


def _engine(name: str) -> tuple[Point, ...]:
    shape = SHAPES.get(name) or read_outline(OUTLINES / f"{name}.json")
    return _on_card(shape(OUTLINE_POINTS))


def _polygon(sides: int, turn_deg: float = 90.0) -> tuple[Point, ...]:
    """A regular polygon inside the square, its first corner at `turn_deg`
    (90: at the top)."""
    corners = [
        (
            math.cos(math.radians(turn_deg + 360 * k / sides)),
            math.sin(math.radians(turn_deg + 360 * k / sides)),
        )
        for k in range(sides)
    ]
    return _on_card([*corners, corners[0]])


def _diamond() -> tuple[Point, ...]:
    corners = [(0.0, 1.0), (0.62, 0.0), (0.0, -1.0), (-0.62, 0.0)]
    return _on_card([*corners, corners[0]])


def _names(en: str, de: str, it: str, es: str, fr: str) -> dict[str, str]:
    return dict(zip(LANGUAGES, (en, de, it, es, fr), strict=True))


CATALOG: tuple[GameShape, ...] = (
    GameShape(
        "triangle",
        _names("Triangle", "Dreieck", "Triangolo", "Triángulo", "Triangle"),
        DistanceGoal(5_000),
        _polygon(3),
    ),
    GameShape(
        "square",
        _names("Square", "Quadrat", "Quadrato", "Cuadrado", "Carré"),
        DistanceGoal(10_000),
        _polygon(4, 45.0),
    ),
    GameShape(
        "hexagon",
        _names("Hexagon", "Sechseck", "Esagono", "Hexágono", "Hexagone"),
        DistanceGoal(20_000),
        _polygon(6),
    ),
    GameShape(
        "circle",
        _names("Circle", "Kreis", "Cerchio", "Círculo", "Cercle"),
        DistanceGoal(42_000),
        _engine("circle"),
    ),
    GameShape(
        "star",
        _names("Star", "Stern", "Stella", "Estrella", "Étoile"),
        DistanceGoal(100_000),
        _engine("star"),
    ),
    GameShape(
        "heart",
        _names("Heart", "Herz", "Cuore", "Corazón", "Cœur"),
        DistanceGoal(250_000),
        _engine("heart"),
    ),
    GameShape(
        "moon",
        _names("Moon", "Mond", "Luna", "Luna", "Lune"),
        DistanceGoal(500_000),
        _engine("moon"),
    ),
    GameShape(
        "sun",
        _names("Sun", "Sonne", "Sole", "Sol", "Soleil"),
        DistanceGoal(1_000_000),
        _engine("sun"),
    ),
    GameShape(
        "lightning",
        _names("Lightning", "Blitz", "Fulmine", "Rayo", "Éclair"),
        PaceGoal(1_000, 300),
        _engine("lightning"),
    ),
    GameShape(
        "diamond",
        _names("Diamond", "Raute", "Diamante", "Diamante", "Losange"),
        PaceGoal(5_000, 330),
        _diamond(),
    ),
    GameShape(
        "arrow",
        _names("Arrow", "Pfeil", "Freccia", "Flecha", "Flèche"),
        PaceGoal(10_000, 360),
        _engine("arrow"),
    ),
    GameShape(
        "crown",
        _names("Crown", "Krone", "Corona", "Corona", "Couronne"),
        PaceGoal(21_097, 360),
        _engine("crown"),
    ),
)

BY_ID: dict[str, GameShape] = {shape.id: shape for shape in CATALOG}
