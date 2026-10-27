"""A city's examples as the app asks them (TASK-316, ADR-0276).

When a city or a town is tapped in "Explore", the app asks its centre for
eight shapes of 5 km, then six words written with the pen up, each at 3 km a
letter (exampleRoutes.ts: DRAW_ORDER, EXAMPLE_WORDS, wordOrder). The API
keeps an answer only for the same request (route_store.py), so whatever
draws them ahead must ask exactly these. packages/shared-types/fixtures/
city-examples.json holds them, and a test here and one of the app read it.
"""

from __future__ import annotations

from typing import Any

from route_engine.words import LETTER_DISTANCE_M

from shaperoute_api.prefetch_zones import EXAMPLE_DISTANCE_M, EXAMPLE_SHAPES

# DRAW_ORDER: the circle, whose zone holds the others', then the first
# shapes' other two, then the shapes drawn after them (MORE_SHAPES).
SHAPES = (*EXAMPLE_SHAPES, "moon", "horse", "snail", "dog_head", "rabbit_head")
# EXAMPLE_WORDS, in the order of their cards.
WORDS = ("CIAO", "LOVE", "AMORE", "RUN", "HELLO", "MUW")
ACTIVITY = "running"


def word_order(words: tuple[str, ...] = WORDS) -> list[str]:
    """wordOrder: the longest first, the others as they come."""
    return sorted(words, key=len, reverse=True)


def shape_request(shape: str, start: list[float]) -> dict[str, Any]:
    return {
        "shape": shape,
        "distance_m": EXAMPLE_DISTANCE_M,
        "start": start,
        "activity": ACTIVITY,
    }


def word_request(word: str, start: list[float]) -> dict[str, Any]:
    return {
        "word": word,
        "style": "round",
        "pen_up": True,
        "distance_m": len(word) * LETTER_DISTANCE_M,
        "start": start,
        "activity": ACTIVITY,
    }


def requests(start: list[float]) -> list[dict[str, Any]]:
    """The bodies of POST /route-jobs a city's examples ask from `start`,
    in the app's order: the shapes, then the words."""
    return [shape_request(shape, start) for shape in SHAPES] + [
        word_request(word, start) for word in word_order()
    ]


def name_of(request: dict[str, Any]) -> str:
    """What a request draws: its shape, or its word."""
    return str(request.get("shape") or request["word"])
