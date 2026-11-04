"""What an activity of the register is (TASK-376, ADR-0320)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Activity:
    # Its name in the contract (packages/shared-types ACTIVITIES).
    name: str
    # Its target distances, [lowest, highest] in metres.
    distance_m: tuple[int, int]
    # The network of networks/ it is drawn on, by name; None on the water.
    network: str | None = None
    # Drawn on a lake or the sea, with no road network: where the shape fits
    # on the water it is the route (water_fit.py, ADR-0154).
    on_water: bool = False
    # On the water, also a drawn outline, an image's or one drawn by hand.
    drawn_on_water: bool = False
