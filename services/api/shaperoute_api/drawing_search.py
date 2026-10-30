"""The search of the drawings, from the lens of «Feed» (TASK-344, ADR-0297,
docs/API.md, «Drawing search»).

GET /search/drawings finds, among the drawings the reader may see, those
whose words hold every word asked: the title, the description, the shape,
the word drawn, the planned route's title, the place and the author's
name. Capitals and accents do not count: «Citta» finds «Città». The app
also sends the shapes the words name in its language (`named`: «cuore»
names `heart`), and a drawing of one of them is found too.

Filters leave out what is not theirs: the shapes of a category, the
sports, the distance, the place, how complex the line is. Several values
of one filter add up; different filters all hold.

Who may see a drawing is the feed's question (drawings.shown_sql): never a
private run, not even its owner's, never across a block, the `followers`
ones only to those who follow. The order is the last published first, the
longest first or the one with the most reactions first; the pages follow a
cursor of that order, so the next page neither repeats nor skips one.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Query

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    AccountError,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.activities import EPOCH, MICROSECOND, RunActivity
from shaperoute_api.db import Database
from shaperoute_api.drawings import (
    LISTED_COLUMNS,
    AuthorBody,
    _details,
    _line,
    _seen,
    shown_sql,
)
from shaperoute_api.feed import FeedBody, FeedPostBody
from shaperoute_api.recommended import preview

PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
# Longer words, or a longer place, are no search: nothing holds them.
MAX_QUERY_LENGTH = 80
# At most this many words of `q`, shapes of `named` or of `shape`.
MAX_VALUES = 50

Sort = Literal["recent", "longest", "popular"]
Complexity = Literal["simple", "medium", "complex"]

# How complex a line is: its length over the diagonal of the rectangle it
# fits in, on its preview (at most 64 points, migration 0022). Below
# SIMPLE_BELOW it is simple, below MEDIUM_BELOW medium, complex above.
# Measured on the examples of «Feed»: a circle 3.0, a heart 3.0, a star
# 3.1-3.5, a horse 3.9-4.2, a dog's head 4.9, a snail 5.3.
SIMPLE_BELOW = 3.6
MEDIUM_BELOW = 4.5

# The letters with accents, under their plain ones: a word asked is folded
# to plain letters, then each letter stands for itself and its accented
# ones in the pattern the text is matched with (`pattern_of`). Lower case
# only: the text is lowered first. A pattern costs a tenth of folding every
# text with translate() (out/TASK-344).
_FOLDED = {
    "a": "àáâãäåāăą",
    "c": "çćč",
    "d": "ď",
    "e": "èéêëēėęě",
    "i": "ìíîïīį",
    "l": "ł",
    "n": "ñńň",
    "o": "òóôõöøōő",
    "r": "ř",
    "s": "śšş",
    "t": "ť",
    "u": "ùúûüūůűų",
    "y": "ýÿ",
    "z": "žźż",
}
FOLDED_FROM = "".join(_FOLDED.values())
FOLDED_TO = "".join(plain * len(marked) for plain, marked in _FOLDED.items())
_FOLD = str.maketrans(FOLDED_FROM, FOLDED_TO)

SHAPE_PATTERN = r"^[a-z0-9_]{1,40}$"
# Where a page ended: the order, the value it is in order of (microseconds
# of publication, metres, reactions) and the random id of the last one.
CURSOR_PATTERN = r"^(recent|longest|popular)-\d{1,17}-[0-9a-f]{32}$"

SORT_MISMATCH = "This cursor is of another order: start again without it."
DISTANCE_UPSIDE_DOWN = "min_m is more than max_m."
TOO_MANY = f"At most {MAX_VALUES} values for each filter."
NOT_A_SHAPE = "A shape is written as the catalogue writes it: heart, dog_head."


def folded(text: str) -> str:
    """`text` as the search compares it: lower case, without accents."""
    return text.lower().translate(_FOLD)


def pattern_of(word: str) -> str:
    """A regular expression of PostgreSQL that finds the folded `word` in a
    lowered text, each letter with or without its accents: «citta» finds
    «città». Every other character stands only for itself."""
    out: list[str] = []
    for char in word:
        if char in _FOLDED:
            out.append(f"[{char}{_FOLDED[char]}]")
        elif char.isascii() and not char.isalnum():
            out.append(f"\\{char}")
        else:
            out.append(char)
    return "".join(out)


def words_of(q: str) -> list[str] | None:
    """The words of `q`, folded; None when nothing can hold them (too
    long). Empty for no words: every drawing is found."""
    text = q.strip()
    if len(text) > MAX_QUERY_LENGTH:
        return None
    return [folded(word) for word in re.split(r"\s+", text) if word][:MAX_VALUES]


def complexity_of(length_m: float, diagonal_m: float) -> Complexity:
    """How complex a line is, from its length and its rectangle's diagonal,
    both on the plane of COMPLEXITY_SQL. A line with no width is simple."""
    if diagonal_m <= 0:
        return "simple"
    winding = length_m / diagonal_m
    if winding < SIMPLE_BELOW:
        return "simple"
    return "medium" if winding < MEDIUM_BELOW else "complex"


# The preview on a plane: longitudes shortened by the cosine of the
# latitude in the middle, so a degree is about as long both ways. Ratios
# need no metres, and a plane is ten times cheaper than geography.
_FLAT = (
    "ST_Scale(d.preview,"
    " cos(radians((ST_YMin(d.preview) + ST_YMax(d.preview)) / 2)), 1)"
)
# Its length over its rectangle's diagonal, computed once for each row.
_WINDING = (
    "SELECT ST_Length(flat) / NULLIF(sqrt(power(ST_XMax(flat) - ST_XMin(flat), 2)"
    " + power(ST_YMax(flat) - ST_YMin(flat), 2)), 0) AS winding"
    f" FROM (SELECT {_FLAT} AS flat) plane"
)
COMPLEXITY_SQL = (
    "(SELECT CASE WHEN winding IS NULL"
    f" OR winding < {SIMPLE_BELOW} THEN 'simple'"
    f" WHEN winding < {MEDIUM_BELOW} THEN 'medium' ELSE 'complex' END"
    f" FROM ({_WINDING}) line)"
)
# Every word a drawing is found by, in one text, folded.
WORDS_SQL = (
    "lower(concat_ws(' ', d.title, d.description, replace(r.shape, '_', ' '),"
    " r.word, r.title, r.place, u.username))"
)
FROM_SQL = "drawings d JOIN runs r ON r.id = d.run_id JOIN users u ON u.id = r.user_id"
REACTIONS_SQL = "(SELECT count(*) FROM reactions x WHERE x.drawing_id = d.id)"
# The value each order is in, a bigint for the cursor: the latest, longest
# or most liked first.
RANK_SQL: dict[Sort, str] = {
    # Microseconds of publication since 1970, as in the cursor of the feed.
    "recent": "(EXTRACT(EPOCH FROM d.published_at) * 1000000)::bigint",
    "longest": "r.distance_m::bigint",
    "popular": REACTIONS_SQL,
}
# What each order sorts by: the columns themselves where there are some,
# so the index of the published drawings (migration 0022) reads the latest
# first and stops at the page.
ORDER_SQL: dict[Sort, str] = {
    "recent": "d.published_at",
    "longest": "r.distance_m",
    "popular": REACTIONS_SQL,
}


@dataclass(frozen=True)
class Filters:
    """What a search asks besides its words; empty lists leave nothing out."""

    named: Sequence[str] = ()
    shapes: Sequence[str] = ()
    activities: Sequence[RunActivity] = ()
    min_m: int | None = None
    max_m: int | None = None
    place: str = ""
    complexities: Sequence[Complexity] = ()


def _cursor(sort: Sort, row: dict[str, Any]) -> str:
    return f"{sort}-{row['rank']}-{row['id'].hex}"


def _after_cursor(cursor: str) -> tuple[str, int, UUID]:
    sort, rank, drawing_id = cursor.split("-")
    return sort, int(rank), UUID(drawing_id)


def _where(words: Sequence[str], filters: Filters, values: dict[str, Any]) -> str:
    """The conditions of the words and of the filters, on the columns of
    the drawing `d`, its run `r` and its author `u`; their values go into
    `values`. Each expression is computed only when it is asked."""
    found: list[str] = []
    if words:
        values["words"] = [pattern_of(word) for word in words]
        every = f"{WORDS_SQL} ~ ALL (%(words)s)"
        if filters.named:
            values["named"] = list(filters.named)
            every = f"({every} OR r.shape = ANY (%(named)s))"
        found.append(every)
    if filters.shapes:
        values["shapes"] = list(filters.shapes)
        found.append("r.shape = ANY (%(shapes)s)")
    if filters.activities:
        values["activities"] = list(filters.activities)
        found.append("r.activity = ANY (%(activities)s)")
    if filters.min_m is not None:
        values["min_m"] = filters.min_m
        found.append("r.distance_m >= %(min_m)s")
    if filters.max_m is not None:
        values["max_m"] = filters.max_m
        found.append("r.distance_m <= %(max_m)s")
    place = folded(filters.place.strip())
    if place:
        values["place"] = pattern_of(place)
        found.append("lower(r.place) ~ %(place)s")
    if filters.complexities:
        values["complexities"] = list(filters.complexities)
        found.append(f"{COMPLEXITY_SQL} = ANY (%(complexities)s)")
    return " AND ".join(found) or "TRUE"


def search_sql(sort: Sort, where: str) -> str:
    """The query of a page: first the ids, from the light columns; then
    what is shown of those only. The preview of 10,000 drawings is not
    written out to keep twenty."""
    return (
        f"SELECT {LISTED_COLUMNS}, u.public_id, u.username, found.rank"
        f" FROM (SELECT d.id, {RANK_SQL[sort]} AS rank FROM {FROM_SQL}"
        # As the feed: never a private run, for the index too.
        " WHERE d.visibility <> 'only_me'"
        f" AND {shown_sql('%(viewer)s')} AND {where}"
        f" ORDER BY {ORDER_SQL[sort]} DESC, d.id DESC LIMIT %(limit)s) found"
        " JOIN drawings d ON d.id = found.id"
        " JOIN runs r ON r.id = d.run_id JOIN users u ON u.id = r.user_id"
        " ORDER BY found.rank DESC, d.id DESC"
    )


@dataclass
class DrawingSearch:
    """The search of the drawings in the database."""

    database: Database
    now: Callable[[], datetime]

    def page(
        self,
        viewer_id: int,
        q: str = "",
        filters: Filters | None = None,
        sort: Sort = "recent",
        limit: int = PAGE_SIZE,
        cursor: str | None = None,
    ) -> FeedBody:
        """A page of the drawings `viewer_id` may see that hold every word
        of `q` (or are of a shape in `filters.named`) and pass the filters,
        in the order `sort`."""
        filters = filters or Filters()
        words = words_of(q)
        if words is None or len(filters.place.strip()) > MAX_QUERY_LENGTH:
            return FeedBody(posts=[], next=None)
        values: dict[str, Any] = {"viewer": viewer_id, "limit": limit + 1}
        where = _where(words, filters, values)
        if cursor is not None:
            cursor_sort, rank, last = _after_cursor(cursor)
            if cursor_sort != sort:
                raise AccountError(422, "invalid_request", SORT_MISMATCH)
            at: Any = EPOCH + rank * MICROSECOND if sort == "recent" else rank
            values.update(at=at, last=last)
            where += f" AND ({ORDER_SQL[sort]}, d.id) < (%(at)s, %(last)s)"
        with self.database.connect() as conn:
            # Compiling the query costs more than running it on 10,000
            # drawings (out/TASK-344): for this transaction only.
            conn.execute("SET LOCAL jit = off")
            rows = conn.execute(search_sql(sort, where), values).fetchall()
            page, more = rows[:limit], len(rows) > limit
            details = _details(conn, [row["id"] for row in page])
        return FeedBody(
            posts=[
                FeedPostBody(
                    **_seen(row, details),
                    track_preview=preview(_line(row["track"])),
                    author=AuthorBody(
                        public_id=row["public_id"], username=row["username"]
                    ),
                )
                for row in page
            ],
            next=_cursor(sort, page[-1]) if more else None,
        )


def search_of(accounts: Annotated[Accounts, Depends(accounts_of)]) -> DrawingSearch:
    """In the database of the accounts, on the same clock."""
    return DrawingSearch(accounts.database, accounts.now)


ShapeList = Annotated[list[str] | None, Query()]


def _few(*lists: Sequence[Any] | None) -> None:
    if any(len(values or ()) > MAX_VALUES for values in lists):
        raise AccountError(422, "invalid_request", TOO_MANY)


def _shapes(values: Sequence[str] | None) -> Sequence[str]:
    """The shape ids asked, each as the catalogue writes one; 422 else."""
    for value in values or ():
        if not re.fullmatch(SHAPE_PATTERN, value):
            raise AccountError(422, "invalid_request", NOT_A_SHAPE)
    return values or ()


def drawing_search_routes() -> APIRouter:
    router = APIRouter(tags=["feed"], responses=ACCOUNT_ERRORS)

    @router.get("/search/drawings")
    def search_drawings(
        search: Annotated[DrawingSearch, Depends(search_of)],
        user: Annotated[UserBody, Depends(current_user)],
        q: str = "",
        named: ShapeList = None,
        shape: ShapeList = None,
        activity: Annotated[list[RunActivity] | None, Query()] = None,
        min_m: Annotated[int | None, Query(ge=0)] = None,
        max_m: Annotated[int | None, Query(ge=0)] = None,
        place: str = "",
        complexity: Annotated[list[Complexity] | None, Query()] = None,
        sort: Sort = "recent",
        limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = PAGE_SIZE,
        cursor: Annotated[str | None, Query(pattern=CURSOR_PATTERN)] = None,
    ) -> FeedBody:
        _few(named, shape, activity, complexity)
        if min_m is not None and max_m is not None and min_m > max_m:
            raise AccountError(422, "invalid_request", DISTANCE_UPSIDE_DOWN)
        filters = Filters(
            named=_shapes(named),
            shapes=_shapes(shape),
            activities=activity or (),
            min_m=min_m,
            max_m=max_m,
            place=place,
            complexities=complexity or (),
        )
        return search.page(user.id, q, filters, sort, limit, cursor)

    return router


def install_drawing_search(app: FastAPI) -> None:
    """The search of the drawings; after install_feed, whose bodies it
    answers with."""
    app.include_router(drawing_search_routes())
