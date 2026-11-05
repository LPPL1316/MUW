"""What an app can show (TASK-387, ADR-0328): the header X-MuW-Reads.

An app says in X-MuW-Reads the kinds it reads besides running, cycling and
paddling, separated by commas: `swimming`, `walking`, `skiing`, `xc_skiing`,
and `trackless` for a run or a drawing without a track (TASK-385). A request
without it comes from a build of before, which reads those three only, each
with its track. Every list of runs, drawings, routes or group runs leaves
out what the request does not read; a drawing or a group run it does not
read is not found, as one that is not there.

Names and values are read without case, the spaces around them and the
values this API does not know are left out: an app newer than the server
says kinds it has not learned yet. The SQL this module writes is made of the
fixed names below, never of the header's text.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Request

READS_HEADER = "X-MuW-Reads"
# What every app has always read (TASK-191 for paddling).
OLD_APP_ACTIVITIES: tuple[str, ...] = ("running", "cycling", "paddling")
# The activities added after them, each read only by the apps that say so.
NEWER_ACTIVITIES: tuple[str, ...] = ("swimming", "walking", "skiing", "xc_skiing")
TRACKLESS = "trackless"
KINDS: tuple[str, ...] = (*NEWER_ACTIVITIES, TRACKLESS)


@dataclass(frozen=True)
class Reads:
    """The activities an app shows, and whether it shows what has no track."""

    activities: tuple[str, ...]
    trackless: bool = False

    def shows(self, activity: Any, tracked: bool = True) -> bool:
        """True when the app shows an item of `activity`, with a track or
        not as `tracked` says."""
        return activity in self.activities and (tracked or self.trackless)

    def sql(self, activity: str, tracked: str | None = None) -> str:
        """An SQL condition: the column `activity` is one the app shows and,
        unless it reads what has no track, the condition `tracked` holds
        (as "r.track IS NOT NULL"); None for what always has a line."""
        listed = ", ".join(f"'{name}'" for name in self.activities)
        condition = f"{activity} IN ({listed})"
        if tracked is not None and not self.trackless:
            condition += f" AND {tracked}"
        return f"({condition})"


# The app of before the header.
OLD_APP = Reads(OLD_APP_ACTIVITIES)
# What the API itself sees: its commands, its pushes, its own tests.
EVERYTHING = Reads((*OLD_APP_ACTIVITIES, *NEWER_ACTIVITIES), trackless=True)


def reads_from(lines: Iterable[str]) -> Reads:
    """The Reads of the header's lines; none or only unknown values: OLD_APP."""
    values = {value.strip().lower() for line in lines for value in line.split(",")}
    said = values & set(KINDS)
    return Reads(
        (*OLD_APP_ACTIVITIES, *(a for a in NEWER_ACTIVITIES if a in said)),
        trackless=TRACKLESS in said,
    )


def reads_of(request: Request) -> Reads:
    """What the app of the request shows, from its header."""
    return reads_from(request.headers.getlist(READS_HEADER))


Shown = Annotated[Reads, Depends(reads_of)]
