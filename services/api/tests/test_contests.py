"""The first contest (TASK-299, ADR-0260, docs/CONCORSI.md): who takes
part and what counts, the order, GET /contests/current with and without a
token, the commands, the close that proclaims once, the badge that outlives
the run. One test for each rule of CONCORSI.md §3–§6."""

from __future__ import annotations

import io
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_push import FAST_HASHER, PHONE, FakeExpo, push_on, put_token

from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.contests import (
    NO_CONTEST,
    SHOWN_AFTER_CLOSE,
    STANDINGS,
    ContestBody,
    Contests,
    main,
)
from shaperoute_api.db import Database, migrations
from shaperoute_api.expo_push import Expo
from shaperoute_api.push import TEXTS, Pusher, PushEvent, text_of

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"

# The first contest: two weeks, said in UTC here.
STARTS = datetime(2026, 11, 2, 0, 0, tzinfo=UTC)
ENDS = datetime(2026, 11, 15, 23, 59, 59, tzinfo=UTC)
DURING = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)
AFTER = ENDS + timedelta(hours=1)
MINUTE = timedelta(minutes=1)
WON = "You won the MuW contest! Your post got the most reactions."
Headers = dict[str, str]


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """The API's clock, moved by hand: publications, reactions and the
    close happen when the test says."""

    def __init__(self) -> None:
        self.t = DURING

    def __call__(self) -> datetime:
        return self.t


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def pusher(database: Database, expo: FakeExpo) -> Pusher:
    """Sends at once, in the test's thread."""
    return Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )


@pytest.fixture
def client(database: Database, pusher: Pusher, wall: WallClock) -> TestClient:
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    app = create_app(
        FileSource(Path("unused.graphml")),
        accounts=accounts,
        run_places=PlaceNames(None),
    )
    app.state.pusher = pusher
    return TestClient(app)


def signed_up(client: TestClient, name: str) -> Headers:
    body = {
        **_load("sign-up-request.json"),
        "email": f"{name}@example.com",
        "username": name,
    }
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201, answer.text
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def me(client: TestClient, headers: Headers) -> dict[str, Any]:
    answer = client.get("/me", headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def public_id(client: TestClient, headers: Headers) -> str:
    return str(me(client, headers)["public_id"])


def key(n: int) -> str:
    return f"{n:016x}"


def posted(
    client: TestClient,
    headers: Headers,
    n: int = 1,
    title: str | None = "Sunday star",
    visibility: str = "everyone",
) -> str:
    """The example run saved as the run `n` of the account and given a
    drawing for `visibility`, published now: the drawing's id."""
    run = _load("activity-request.json")
    answer = client.put(f"/me/activities/{key(n)}", json=run, headers=headers)
    assert answer.status_code == 201, answer.text
    answer = client.put(
        f"/me/activities/{key(n)}/drawing",
        json={"title": title, "visibility": visibility},
        headers=headers,
    )
    assert answer.status_code == 200, answer.text
    return str(answer.json()["id"])


def react(
    client: TestClient, headers: Headers, drawing_id: str, kind: str = "fire"
) -> None:
    body: dict[str, Any] = {"kind": kind}
    if kind == "super_like":
        body["comment"] = "What a heart!"
    answer = client.put(f"/drawings/{drawing_id}/reaction", json=body, headers=headers)
    assert answer.status_code == 200, answer.text


def block(client: TestClient, who: Headers, whom: Headers) -> None:
    answer = client.put(f"/users/{public_id(client, whom)}/block", headers=who)
    assert answer.status_code == 204, answer.text


def opened(database: Database, wall: WallClock) -> UUID:
    """The first contest, open: its id."""
    return Contests(database, wall).open(STARTS, ENDS).id


def contest(client: TestClient, headers: Headers | None = None) -> dict[str, Any]:
    answer = client.get("/contests/current", headers=headers)
    assert answer.status_code == 200, answer.text
    return dict(answer.json())


def top(client: TestClient, headers: Headers | None = None) -> list[tuple[Any, ...]]:
    """(rank, title, reactions) of the first posts."""
    return [
        (entry["rank"], entry["drawing"]["title"], entry["reactions"])
        for entry in contest(client, headers)["top"]
    ]


def row(database: Database) -> dict[str, Any]:
    """The one contest as the table has it."""
    with database.connect() as conn:
        rows = conn.execute(
            "SELECT winner_drawing_id, winner_user_id, closed_at FROM contests"
        ).fetchall()
    assert len(rows) == 1
    return dict(rows[0])


def closed(
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    *more: str,
) -> tuple[int, str]:
    """`python -m shaperoute_api.contests close …`: the exit code and what
    it printed."""
    out = io.StringIO()
    code = main(["close", *more], database=database, pusher=pusher, now=wall, out=out)
    return code, out.getvalue()


# --- The contract and the rules, without a database ---


def test_the_examples_are_the_bodies() -> None:
    example = _load("contest.json")
    assert set(example) == set(ContestBody.model_fields)
    body = ContestBody.model_validate(example)
    assert [entry.rank for entry in body.top] == [1, 2, 3]
    assert body.closed_at is None and body.winner is None
    assert body.mine is not None and body.mine.rank > len(body.top)
    # In the order of CONCORSI.md §4: the reactions go down.
    reactions = [entry.reactions for entry in body.top]
    assert reactions == sorted(reactions, reverse=True)
    after = ContestBody.model_validate(_load("contest-closed.json"))
    assert after.closed_at is not None and after.mine is None
    assert after.winner is not None and after.winner.drawing is not None
    assert after.winner.drawing.id == after.top[0].drawing.id
    assert after.winner.reactions == after.top[0].reactions
    # Only the posts for everyone take part.
    for entry in body.top + after.top:
        assert entry.drawing.visibility == "everyone"


def test_the_push_text_names_no_one_and_is_in_the_five_languages() -> None:
    event = PushEvent("contest_won", 1, 1, drawing_id=uuid4())
    assert text_of(event, "ada", "en") == WON
    assert (
        text_of(event, "ada", "it")
        == "Hai vinto il concorso MuW! Il tuo post ha avuto più reazioni di tutti."
    )
    assert set(TEXTS["contest_won"]) == {"en", "de", "it", "es", "fr"}
    assert "{" not in "".join(TEXTS["contest_won"].values())


def test_the_migration_comes_after_the_hidden_content() -> None:
    names = [path.name for path in migrations()]
    (contests,) = [name for name in names if name.endswith("_contests.sql")]
    assert names.index(contests) > names.index("0024_hidden_content.sql")


def test_without_a_database_the_contest_is_unavailable() -> None:
    app = create_app(FileSource(Path("unused.graphml")))
    answer = TestClient(app).get("/contests/current")
    assert answer.status_code == 503
    assert answer.json()["error"]["code"] == "accounts_unavailable"


# --- The endpoint ---


def test_without_a_contest_there_is_no_contest(client: TestClient) -> None:
    answer = client.get("/contests/current")
    assert answer.status_code == 404
    error = answer.json()["error"]
    assert (error["code"], error["message"]) == ("no_contest", NO_CONTEST)


def test_the_open_contest_with_the_first_three_for_anyone_and_mine_with_a_token(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal, dan = (
        signed_up(client, name) for name in ("ada", "bea", "cal", "dan")
    )
    contest_id = opened(database, wall)
    first = posted(client, ada, 1, "First")
    second = posted(client, bea, 2, "Second")
    third = posted(client, cal, 3, "Third")
    fourth = posted(client, dan, 4, "Fourth")
    for who in (bea, cal, dan):
        react(client, who, first)
    for who in (ada, cal):
        react(client, who, second)
    react(client, ada, third)

    # Without a token: the dates, the first three with their author and
    # the preview of the track, no `mine`.
    seen = contest(client)
    assert seen["id"] == str(contest_id)
    assert datetime.fromisoformat(seen["starts_at"]) == STARTS
    assert datetime.fromisoformat(seen["ends_at"]) == ENDS
    assert seen["closed_at"] is None and seen["winner"] is None
    assert "mine" not in seen
    assert top(client) == [(1, "First", 3), (2, "Second", 2), (3, "Third", 1)]
    leader = seen["top"][0]["drawing"]
    assert leader["id"] == first and leader["author"]["username"] == "ada"
    assert len(leader["track_preview"]) > 1 and "track" not in leader
    assert seen["top"][1]["drawing"]["id"] == second
    assert seen["top"][2]["drawing"]["id"] == third
    # With a token: the same, and the best post of who asks.
    mine = contest(client, dan)
    assert top(client, dan) == top(client)
    assert mine["mine"] == {"drawing_id": fourth, "rank": 4, "reactions": 0}
    assert contest(client, ada)["mine"] == {
        "drawing_id": first,
        "rank": 1,
        "reactions": 3,
    }
    # A token without a post that takes part: null.
    assert contest(client, signed_up(client, "eve"))["mine"] is None
    # A token of no session: 401, as everywhere.
    answer = client.get(
        "/contests/current", headers={"Authorization": "Bearer not-a-token"}
    )
    assert answer.status_code == 401


def test_the_best_post_of_who_asks_is_its_own_best(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    opened(database, wall)
    weaker = posted(client, ada, 1, "Weaker")
    wall.t += MINUTE
    stronger = posted(client, ada, 2, "Stronger")
    wall.t += MINUTE
    other = posted(client, bea, 3, "Other")
    react(client, bea, stronger)
    react(client, ada, other)
    assert top(client) == [(1, "Stronger", 1), (2, "Other", 1), (3, "Weaker", 0)]
    assert contest(client, ada)["mine"] == {
        "drawing_id": stronger,
        "rank": 1,
        "reactions": 1,
    }
    assert weaker != stronger


# --- What counts (CONCORSI.md §3) ---


def test_the_own_reaction_does_not_count(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    opened(database, wall)
    mine = posted(client, ada, 1, "Mine")
    other = posted(client, bea, 2, "Other")
    react(client, ada, mine)
    react(client, ada, other)
    assert top(client) == [(1, "Other", 1), (2, "Mine", 0)]


def test_a_reaction_across_a_block_does_not_count(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal = (signed_up(client, name) for name in ("ada", "bea", "cal"))
    opened(database, wall)
    post = posted(client, ada, 1, "Post")
    react(client, bea, post)
    react(client, cal, post)
    assert top(client) == [(1, "Post", 2)]
    # The author blocks one: its reaction counts no more.
    block(client, ada, bea)
    assert top(client) == [(1, "Post", 1)]
    # The other blocks the author: neither.
    block(client, cal, ada)
    assert top(client) == [(1, "Post", 0)]


def test_a_drawing_for_the_followers_or_only_me_does_not_take_part(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada = signed_up(client, "ada")
    opened(database, wall)
    posted(client, ada, 1, "Followers", visibility="followers")
    posted(client, ada, 2, "Only me", visibility="only_me")
    everyone = posted(client, ada, 3, "Everyone")
    assert top(client) == [(1, "Everyone", 0)]
    assert contest(client, ada)["mine"]["drawing_id"] == everyone


def test_a_drawing_published_before_or_after_the_period_does_not_take_part(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada = signed_up(client, "ada")
    opened(database, wall)
    wall.t = STARTS - timedelta(seconds=1)
    posted(client, ada, 1, "Before")
    wall.t = STARTS
    posted(client, ada, 2, "At the start")
    wall.t = ENDS
    posted(client, ada, 3, "At the end")
    wall.t = ENDS + timedelta(seconds=1)
    posted(client, ada, 4, "After")
    wall.t = DURING
    assert top(client) == [(1, "At the start", 0), (2, "At the end", 0)]


def test_a_reaction_after_the_end_does_not_count(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal = (signed_up(client, name) for name in ("ada", "bea", "cal"))
    opened(database, wall)
    post = posted(client, ada, 1, "Post")
    react(client, bea, post)
    wall.t = AFTER
    react(client, cal, post)
    assert top(client) == [(1, "Post", 1)]
    # Changed after the end, a reaction counts no more (§3, point 4).
    react(client, bea, post, "clap")
    assert top(client) == [(1, "Post", 0)]


def test_a_hidden_drawing_or_account_does_not_take_part_nor_count(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal = (signed_up(client, name) for name in ("ada", "bea", "cal"))
    opened(database, wall)
    adas = posted(client, ada, 1, "Ada's")
    posted(client, bea, 2, "Bea's")
    cals = posted(client, cal, 3, "Cal's")
    react(client, bea, cals)
    assert top(client) == [(1, "Cal's", 1), (2, "Ada's", 0), (3, "Bea's", 0)]
    # Hidden from a report's email (TASK-291): out of the contest.
    with database.connect() as conn:
        conn.execute(
            "UPDATE drawings SET hidden_at = %s WHERE id = %s", (wall.t, UUID(adas))
        )
    assert top(client) == [(1, "Cal's", 1), (2, "Bea's", 0)]
    # A hidden account: its post is out, and its reactions count no more.
    with database.connect() as conn:
        conn.execute(
            "UPDATE users SET hidden_at = %s WHERE id = %s",
            (wall.t, me(client, bea)["id"]),
        )
    assert top(client) == [(1, "Cal's", 0)]


# --- The order (CONCORSI.md §4) ---


def test_a_tie_goes_to_more_muw_hearts_then_to_the_post_published_first(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal, dan = (
        signed_up(client, name) for name in ("ada", "bea", "cal", "dan")
    )
    opened(database, wall)
    older = posted(client, ada, 1, "Older")
    wall.t += MINUTE
    newer = posted(client, bea, 2, "Newer")
    # Two reactions each; the newer has a MuW heart.
    react(client, cal, older)
    react(client, dan, older)
    react(client, cal, newer, "super_like")
    react(client, dan, newer)
    assert top(client) == [(1, "Newer", 2), (2, "Older", 2)]
    # Hearts even: the post published first.
    react(client, cal, older, "super_like")
    assert top(client) == [(1, "Older", 2), (2, "Newer", 2)]


def test_top_leaves_out_a_post_across_a_block_with_who_asks(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    ada, bea, cal, dan = (
        signed_up(client, name) for name in ("ada", "bea", "cal", "dan")
    )
    opened(database, wall)
    a = posted(client, ada, 1, "A")
    wall.t += MINUTE
    b = posted(client, bea, 2, "B")
    wall.t += MINUTE
    c = posted(client, cal, 3, "C")
    wall.t += MINUTE
    d = posted(client, dan, 4, "D")
    for who in (bea, cal):
        react(client, who, a)
    for who in (ada, cal):
        react(client, who, b)
    react(client, ada, c)
    assert top(client) == [(1, "A", 2), (2, "B", 2), (3, "C", 1)]
    # Dan blocks Ada: Dan does not see A, and B and C keep their places.
    block(client, dan, ada)
    assert top(client, dan) == [(2, "B", 2), (3, "C", 1)]
    assert contest(client, dan)["mine"] == {"drawing_id": d, "rank": 4, "reactions": 0}
    # The others, and whoever has no token, see the three.
    assert top(client, bea) == top(client) == [(1, "A", 2), (2, "B", 2), (3, "C", 1)]
    assert {a, b, c} == {entry["drawing"]["id"] for entry in contest(client)["top"]}


# --- The commands (CONCORSI.md §5–§6, §11) ---


def test_close_proclaims_once_and_sends_one_push(
    client: TestClient,
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    expo: FakeExpo,
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    put_token(client, ada, PHONE, language="it")
    push_on(client, ada)
    contest_id = opened(database, wall)
    post = posted(client, ada, 1, "Winner")
    react(client, bea, post)
    wall.t = AFTER

    code, said = closed(database, wall, pusher)
    assert code == 0
    assert said == (
        f"contests: closed {contest_id}; the winner is ada with 1 reaction(s),"
        f" drawing {post}; the winner is told with a push\n"
    )
    ada_id = me(client, ada)["id"]
    assert row(database) == {
        "winner_drawing_id": UUID(post),
        "winner_user_id": ada_id,
        "closed_at": AFTER,
    }
    # Bea's reaction was told before; the contest once, in the phone's
    # language, with the post to open.
    won = [m for m in expo.sent if m["data"]["kind"] == "contest_won"]
    assert [(m["to"], m["body"], m["data"]) for m in won] == [
        (
            PHONE,
            "Hai vinto il concorso MuW! Il tuo post ha avuto più reazioni di tutti.",
            {"kind": "contest_won", "drawing_id": post},
        )
    ]
    sent = len(expo.sent)
    # Again: nothing is written, nothing is sent, and it says so.
    code, said = closed(database, wall, pusher)
    assert (code, said) == (1, "contests: no contest is open: nothing to close\n")
    assert row(database)["closed_at"] == AFTER and len(expo.sent) == sent
    # Closed, the contest is answered with its winner; the badge is there.
    seen = contest(client)
    assert datetime.fromisoformat(seen["closed_at"]) == AFTER
    assert seen["winner"]["reactions"] == 1
    assert seen["winner"]["drawing"]["id"] == post
    assert seen["top"][0]["drawing"]["id"] == post
    profile = client.get(f"/users/{public_id(client, ada)}", headers=bea)
    assert profile.json()["contest_wins"] == 1
    assert me(client, ada)["contest_wins"] == 1
    assert me(client, bea)["contest_wins"] == 0


def test_close_before_the_end_is_refused(
    client: TestClient,
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    capsys: pytest.CaptureFixture[str],
) -> None:
    ada = signed_up(client, "ada")
    contest_id = opened(database, wall)
    posted(client, ada, 1, "Early")
    code, said = closed(database, wall, pusher)
    assert (code, said) == (2, "")
    assert "close it after" in capsys.readouterr().err
    assert row(database)["closed_at"] is None
    assert contest(client)["id"] == str(contest_id)


def test_close_without_participants_closes_without_a_winner_nor_a_push(
    client: TestClient,
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    expo: FakeExpo,
) -> None:
    contest_id = opened(database, wall)
    wall.t = AFTER
    code, said = closed(database, wall, pusher)
    assert (code, said) == (0, f"contests: closed {contest_id} without a winner\n")
    assert row(database) == {
        "winner_drawing_id": None,
        "winner_user_id": None,
        "closed_at": AFTER,
    }
    assert expo.sent == []
    seen = contest(client)
    assert seen["top"] == [] and seen["winner"] == {"reactions": 0, "drawing": None}


def test_close_exclude_leaves_a_post_out(
    client: TestClient, database: Database, wall: WallClock, pusher: Pusher
) -> None:
    ada, bea, cal = (signed_up(client, name) for name in ("ada", "bea", "cal"))
    opened(database, wall)
    trick = posted(client, ada, 1, "Trick")
    fair = posted(client, bea, 2, "Fair")
    for who in (bea, cal):
        react(client, who, trick)
    react(client, cal, fair)
    wall.t = AFTER
    code, said = closed(database, wall, pusher, "--exclude", trick)
    assert code == 0 and "the winner is bea" in said
    assert row(database)["winner_drawing_id"] == UUID(fair)
    # Left out, not deleted nor hidden: the post is still there, first in
    # `top`; it just did not win.
    seen = contest(client)
    assert top(client) == [(1, "Trick", 2), (2, "Fair", 1)]
    assert seen["winner"]["drawing"]["id"] == fair


def test_dry_run_writes_nothing(
    client: TestClient,
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    expo: FakeExpo,
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    contest_id = opened(database, wall)
    post = posted(client, ada, 1, "Post")
    react(client, bea, post)
    wall.t = AFTER
    code, said = closed(database, wall, pusher, "--dry-run")
    assert (code, said) == (
        0,
        f"contests: would close {contest_id}; the winner is ada with 1 reaction(s),"
        f" drawing {post}\n",
    )
    assert row(database) == {
        "winner_drawing_id": None,
        "winner_user_id": None,
        "closed_at": None,
    }
    assert expo.sent == [] and contest(client)["closed_at"] is None


def test_open_refuses_a_second_open_contest_and_a_period_that_ends_first(
    database: Database,
    wall: WallClock,
    pusher: Pusher,
    capsys: pytest.CaptureFixture[str],
) -> None:
    def opening(start: str, end: str) -> tuple[int, str]:
        out = io.StringIO()
        code = main(
            ["open", "--from", start, "--to", end],
            database=database,
            pusher=pusher,
            now=wall,
            out=out,
        )
        return code, out.getvalue()

    code, said = opening("2026-11-02T00:00+01:00", "2026-11-15T23:59:59+01:00")
    assert code == 0
    assert said.startswith("contests: opened ")
    # As the database keeps them: in UTC.
    assert said.endswith(
        " from 2026-11-01T23:00:00+00:00 to 2026-11-15T22:59:59+00:00\n"
    )
    # A second one while the first is open.
    assert opening("2026-12-01T00:00+01:00", "2026-12-15T00:00+01:00") == (2, "")
    assert "open already" in capsys.readouterr().err
    # One that ends when it starts, or before.
    assert opening("2026-12-02T00:00+01:00", "2026-12-02T00:00+01:00") == (2, "")
    assert "must end after" in capsys.readouterr().err
    # A moment without its offset is not taken.
    with pytest.raises(SystemExit):
        opening("2026-12-02T00:00", "2026-12-15T00:00")
    with database.connect() as conn:
        assert conn.execute("SELECT count(*) AS n FROM contests").fetchone()["n"] == 1


def test_standings_prints_the_first_ten_with_the_reactions_of_young_accounts(
    client: TestClient, database: Database, wall: WallClock, pusher: Pusher
) -> None:
    def standings() -> tuple[int, list[str]]:
        out = io.StringIO()
        code = main(["standings"], database=database, pusher=pusher, now=wall, out=out)
        return code, out.getvalue().splitlines()

    # Nothing open: it says so.
    assert standings() == (1, ["contests: no contest is open"])
    # Two accounts from before the contest, two born during it.
    wall.t = STARTS - timedelta(days=1)
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    wall.t = DURING
    cal, dan = signed_up(client, "cal"), signed_up(client, "dan")
    opened(database, wall)
    star = posted(client, ada, 1, "Sunday star")
    untitled = posted(client, bea, 2, None)
    react(client, bea, star, "super_like")
    react(client, cal, star)
    react(client, dan, star)
    react(client, ada, untitled)
    code, lines = standings()
    assert code == 0
    assert lines == [
        f"contests: the first {STANDINGS}",
        f" 1. ada  «Sunday star»  3 reaction(s), 2 from accounts younger than"
        f" the contest, 1 MuW heart(s)  {star}",
        f" 2. bea  (no title)  1 reaction(s), 0 from accounts younger than"
        f" the contest, 0 MuW heart(s)  {untitled}",
    ]
    # Twelve posts: ten lines.
    for n in range(3, 13):
        posted(client, cal, n, f"Post {n}")
    code, lines = standings()
    assert code == 0 and len(lines) == 1 + STANDINGS
    assert lines[1].startswith(" 1. ada") and lines[-1].startswith("10. cal")


def test_eight_days_after_the_close_there_is_no_contest(
    client: TestClient, database: Database, wall: WallClock, pusher: Pusher
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    opened(database, wall)
    react(client, bea, posted(client, ada, 1, "Post"))
    wall.t = AFTER
    assert closed(database, wall, pusher)[0] == 0
    # Within the week of the winner's post: still answered, closed.
    wall.t = AFTER + SHOWN_AFTER_CLOSE - MINUTE
    assert contest(client)["winner"]["reactions"] == 1
    # Then no more; the badge stays.
    wall.t = AFTER + timedelta(days=8)
    answer = client.get("/contests/current", headers=bea)
    assert answer.status_code == 404
    assert answer.json()["error"]["code"] == "no_contest"
    assert me(client, ada)["contest_wins"] == 1
    # A new contest opened in the meantime is the one answered, open.
    Contests(database, wall).open(wall.t, wall.t + timedelta(days=14))
    wall.t = AFTER + timedelta(days=1)
    seen = contest(client)
    assert seen["closed_at"] is None and seen["winner"] is None


def test_the_deleted_winning_run_leaves_the_badge(
    client: TestClient, database: Database, wall: WallClock, pusher: Pusher
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    opened(database, wall)
    react(client, bea, posted(client, ada, 1, "Post"))
    wall.t = AFTER
    assert closed(database, wall, pusher)[0] == 0
    answer = client.delete(f"/me/activities/{key(1)}", headers=ada)
    assert answer.status_code == 204, answer.text
    assert row(database)["winner_drawing_id"] is None
    assert row(database)["winner_user_id"] == me(client, ada)["id"]
    seen = contest(client)
    assert seen["top"] == [] and seen["winner"] == {"reactions": 0, "drawing": None}
    profile = client.get(f"/users/{public_id(client, ada)}", headers=bea)
    assert profile.json()["contest_wins"] == 1
    assert me(client, ada)["contest_wins"] == 1


def test_the_deleted_account_leaves_the_contest_without_a_winner(
    client: TestClient, database: Database, wall: WallClock, pusher: Pusher
) -> None:
    ada, bea = signed_up(client, "ada"), signed_up(client, "bea")
    opened(database, wall)
    react(client, bea, posted(client, ada, 1, "Post"))
    wall.t = AFTER
    assert closed(database, wall, pusher)[0] == 0
    assert client.delete("/me", headers=ada).status_code == 204
    assert row(database) == {
        "winner_drawing_id": None,
        "winner_user_id": None,
        "closed_at": AFTER,
    }
    seen = contest(client, bea)
    assert seen["winner"] == {"reactions": 0, "drawing": None}
    assert seen["top"] == [] and seen["mine"] is None
