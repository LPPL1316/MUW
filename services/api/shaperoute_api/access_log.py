"""No query string in uvicorn's access log (TASK-124, ADR-0096).

GET /places carries the user's position as ?lat=&lon= and the text typed:
uvicorn writes the whole URL of every request, so both would end up in the
API log, which holds no positions (ADR-0092). The access log keeps method,
path and status; what was asked stays out. The photo of a town near the
phone says where it is in the path itself: its line keeps only the folder
(TASK-363).
"""

from __future__ import annotations

import logging

ACCESS_LOGGER = "uvicorn.access"
# uvicorn's access record: (client, method, path with query, http, status).
PATH_ARG = 2
TOWN_PHOTOS = "/city-photos/"


class HideQueryString(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) > PATH_ARG:
            path = args[PATH_ARG]
            if isinstance(path, str):
                bare = path.split("?", 1)[0]
                if bare.startswith(TOWN_PHOTOS):
                    bare = TOWN_PHOTOS
                record.args = (*args[:PATH_ARG], bare, *args[PATH_ARG + 1 :])
        return True


def hide_query_strings(logger: logging.Logger | None = None) -> None:
    """Idempotent: one filter, however many times it is called."""
    target = logger or logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, HideQueryString) for f in target.filters):
        target.addFilter(HideQueryString())
