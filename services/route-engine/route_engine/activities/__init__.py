"""The register of the activities the engine draws (TASK-376, ADR-0320).

One module each; a new activity is a new module and one line here, in the
order of the contract (packages/shared-types mirrors it, ADR-0028).
models.py and network.py read their tables from it.
"""

from __future__ import annotations

from route_engine.activities import cycling, paddling, running, swimming
from route_engine.activities.base import Activity

ENGINE_ACTIVITIES: tuple[Activity, ...] = (
    running.ACTIVITY,
    cycling.ACTIVITY,
    paddling.ACTIVITY,
    swimming.ACTIVITY,
)
