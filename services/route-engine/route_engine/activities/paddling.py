"""Paddling on a lake or the sea (TASK-191, ADR-0161, ADR-0164)."""

from route_engine.activities.base import Activity

# 1-5 km, the user's choice: within 1 km of the shore a shape fits up to
# about 3 km at sea and 5-6 on a lake, and beyond that the error says what
# fits.
ACTIVITY = Activity("paddling", (1_000, 5_000), on_water=True)
