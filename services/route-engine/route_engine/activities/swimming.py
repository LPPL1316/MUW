"""An open-water swim (TASK-323, ADR-0283)."""

from route_engine.activities.base import Activity

# 0.5-3 km, every lap and the legs from the shore; a shape of the catalogue
# or a drawing (the user's ask of 2026-10-29).
ACTIVITY = Activity("swimming", (500, 3_000), on_water=True, drawn_on_water=True)
