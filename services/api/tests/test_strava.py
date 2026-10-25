"""Send to Strava against a Strava made here, in memory: no network
(TASK-187, ADR-0156). The athlete connects through the callback, a saved run
becomes one activity however many times it is sent, tokens renew themselves
and go when the access does, and nothing secret is answered or logged. The
database is a real PostgreSQL; the bodies are the examples of
packages/shared-types/fixtures."""

from __future__ import annotations

import base64
import itertools
import json
import logging
import threading
import time
import traceback
import urllib.parse
import xml.etree.ElementTree as ET
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from email import message_from_bytes
from pathlib import Path
from typing import Any

import psycopg
import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from psycopg.rows import dict_row
from route_engine.models import SUPPORTED_ACTIVITIES
from route_engine.network import FileSource

from shaperoute_api.access import OPEN_PATHS
from shaperoute_api.accounts import Accounts
from shaperoute_api.activities import PlaceNames
from shaperoute_api.app import create_app
from shaperoute_api.db import Database, DictConnection, migrations
from shaperoute_api.drawings import MAX_DESCRIPTION_LENGTH
from shaperoute_api.strava import (
    MAX_NAME,
    POLLS,
    SPORT_TYPES,
    StravaActivityBody,
    StravaConnectBody,
    StravaRuns,
    StravaSendBody,
    StravaStatusBody,
    activity_name,
    strava_description,
    typed_description,
    typed_name,
)
from shaperoute_api.strava_client import (
    ACTIVITIES_URL,
    AUTHORIZE_URL,
    CALLBACK_PATH,
    CLIENT_ID_VARIABLE,
    CLIENT_SECRET_VARIABLE,
    REVOKE_URL,
    TOKEN_URL,
    UPLOADS_URL,
    Call,
    Reply,
    Strava,
    Upload,
    outcome,
    retry_after_s,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
KEY = "7c2e91a4b05d3f68"
OTHER_KEY = "e5d0a83f19c7b246"
CLIENT_ID = "123456"
CLIENT_SECRET = "made-up-secret-of-the-tests"
DOMAIN = "api.example.com"
ADA = 7001
GRACE = 7002
GPX = "{http://www.topografix.com/GPX/1/1}"
GRANTED = "read,activity:write"
# Long enough for a slow CI; a sending that should have waited fails the test
# instead of hanging it.
WAIT_S = 10.0


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    """A clock the test moves by hand."""

    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 8, 30, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.t


def _answer(status: int, body: Any, **headers: str) -> Reply:
    return Reply(status, headers, json.dumps(body).encode())


class FakeStrava:
    """Strava as far as the API talks to it: the token endpoint, the
    revocation, the uploads. It checks what it is sent as Strava would, and
    remembers every call."""

    def __init__(self, wall: WallClock) -> None:
        self.wall = wall
        self.calls: list[Call] = []
        self.sleeps: list[float] = []
        self.down = False
        # Set to Strava's usage header, "200,1500": every call is one too many.
        self.usage: str | None = None
        # How many looks at an upload say "still being processed".
        self.slow_looks = 1
        # The next file cannot be read.
        self.unreadable = False
        self.athletes: dict[int, dict[str, Any]] = {
            ADA: {"id": ADA, "firstname": "Ada", "lastname": "Lovelace"},
            GRACE: {"id": GRACE, "firstname": "Grace", "lastname": "Hopper"},
        }
        self.codes: dict[str, int] = {}
        # An application Strava has not reviewed takes one athlete only.
        self.capacity: int | None = None
        self.access: dict[str, tuple[int, datetime]] = {}
        self.refresh: dict[str, int] = {}
        # Athletes who gave the access without the permission to upload.
        self.read_only: set[int] = set()
        self.uploads: dict[int, dict[str, Any]] = {}
        self.activities: dict[tuple[int, str], int] = {}
        # The text under each activity's name, as changed after its upload.
        self.descriptions: dict[int, str] = {}
        # Activities Strava does not let MuW change (only their athlete
        # sees them).
        self.locked: set[int] = set()
        self.files: list[dict[str, Any]] = []
        self._numbers = itertools.count(1)

    # What an athlete does on Strava's own pages.

    def approve(self, athlete: int = ADA) -> str:
        """The athlete taps "Authorize": the code the browser comes back with."""
        code = f"code-{next(self._numbers)}"
        self.codes[code] = athlete
        return code

    def remove_app(self, athlete: int = ADA) -> None:
        """The athlete takes the access away in Strava's settings."""
        self.access = {t: a for t, a in self.access.items() if a[0] != athlete}
        self.refresh = {t: a for t, a in self.refresh.items() if a != athlete}

    def secrets(self) -> list[str]:
        """Everything that must never be answered or logged."""
        return [CLIENT_SECRET, *self.access, *self.refresh, *self.codes]

    def made(self, method: str, url: str) -> list[Call]:
        return [c for c in self.calls if c.method == method and c.url.startswith(url)]

    # Strava's side of the wire.

    def __call__(self, call: Call) -> Reply:
        self.calls.append(call)
        if self.down:
            raise OSError(f"no answer from {call.url} with {call.headers}")
        if self.usage is not None:
            return _answer(
                429,
                {"message": "Rate Limit Exceeded"},
                **{"x-ratelimit-limit": "200,2000", "x-ratelimit-usage": self.usage},
            )
        if call.method == "POST" and call.url == TOKEN_URL:
            return self._token(call)
        if call.method == "POST" and call.url == REVOKE_URL:
            return self._revoke(call)
        if call.method == "POST" and call.url == UPLOADS_URL:
            return self._upload(call)
        if call.method == "GET" and call.url.startswith(UPLOADS_URL + "/"):
            return self._look(call)
        if call.method == "PUT" and call.url.startswith(ACTIVITIES_URL + "/"):
            return self._describe(call)
        return _answer(404, {"message": "Record Not Found"})

    def _form(self, call: Call) -> dict[str, str]:
        assert call.headers["Content-Type"] == "application/x-www-form-urlencoded"
        assert call.body is not None
        return dict(urllib.parse.parse_qsl(call.body.decode()))

    def _issue(self, athlete: int) -> dict[str, Any]:
        number = next(self._numbers)
        access, refresh = f"access-{number}", f"refresh-{number}"
        expires = self.wall() + timedelta(hours=6)
        self.access[access] = (athlete, expires)
        # The refresh token changes with each renewal: the old one is dead.
        self.refresh = {t: a for t, a in self.refresh.items() if a != athlete}
        self.refresh[refresh] = athlete
        return {
            "token_type": "Bearer",
            "access_token": access,
            "refresh_token": refresh,
            "expires_at": int(expires.timestamp()),
            "expires_in": 21600,
        }

    def _token(self, call: Call) -> Reply:
        form = self._form(call)
        if (form["client_id"], form["client_secret"]) != (CLIENT_ID, CLIENT_SECRET):
            return _answer(401, {"message": "Authorization Error"})
        if form["grant_type"] == "authorization_code":
            athlete = self.codes.pop(form["code"], None)
            if athlete is None:
                return _answer(400, {"message": "Bad Request"})
            others = {a for a in self.refresh.values() if a != athlete}
            if self.capacity is not None and len(others) >= self.capacity:
                return _answer(
                    403,
                    {
                        "message": "Forbidden",
                        "errors": [
                            {
                                "resource": "Athlete",
                                "field": "access",
                                "code": "limit exceeded",
                            }
                        ],
                    },
                )
            return _answer(
                200, {**self._issue(athlete), "athlete": self.athletes[athlete]}
            )
        assert form["grant_type"] == "refresh_token"
        athlete = self.refresh.get(form["refresh_token"])
        if athlete is None:
            return _answer(400, {"message": "Bad Request"})
        return _answer(200, self._issue(athlete))

    def _revoke(self, call: Call) -> Reply:
        basic = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        if call.headers.get("Authorization") != f"Basic {basic}":
            return _answer(401, {"message": "Authorization Error"})
        athlete = self.refresh.get(self._form(call)["token"])
        if athlete is not None:
            self.remove_app(athlete)
        # 200 whether or not the token was found, as Strava says.
        return Reply(200, {}, b"")

    def _athlete(self, call: Call) -> int | None:
        token = call.headers.get("Authorization", "").removeprefix("Bearer ")
        known = self.access.get(token)
        if known is None or known[1] <= self.wall() or known[0] in self.read_only:
            return None
        return known[0]

    def _upload(self, call: Call) -> Reply:
        athlete = self._athlete(call)
        if athlete is None:
            return _answer(401, {"message": "Authorization Error"})
        assert call.body is not None
        header = b"Content-Type: " + call.headers["Content-Type"].encode()
        form: dict[str, Any] = {}
        for part in message_from_bytes(header + b"\r\n\r\n" + call.body).get_payload():
            name = part.get_param("name", header="content-disposition")
            content = part.get_payload(decode=True)
            if name == "file":
                form["file_name"], form["file_type"] = (
                    part.get_filename(),
                    part.get_content_type(),
                )
                form["file"] = content.decode()
            else:
                form[name] = content.decode()
        self.files.append(form)
        upload_id = 9000 + next(self._numbers)
        self.uploads[upload_id] = {
            "athlete": athlete,
            "external_id": form["external_id"],
            "looks": self.slow_looks,
            "unreadable": self.unreadable,
        }
        self.unreadable = False
        return _answer(201, self._state(upload_id))

    def _look(self, call: Call) -> Reply:
        athlete = self._athlete(call)
        if athlete is None:
            return _answer(401, {"message": "Authorization Error"})
        upload_id = int(call.url.rsplit("/", 1)[1])
        upload = self.uploads.get(upload_id)
        if upload is None or upload["athlete"] != athlete:
            return _answer(404, {"message": "Record Not Found"})
        if upload["looks"] > 0:
            upload["looks"] -= 1
        elif "activity_id" not in upload and "error" not in upload:
            self._read(upload)
        return _answer(200, self._state(upload_id))

    def _describe(self, call: Call) -> Reply:
        athlete = self._athlete(call)
        if athlete is None:
            return _answer(401, {"message": "Authorization Error"})
        activity_id = int(call.url.rsplit("/", 1)[1])
        if (athlete, activity_id) not in {
            (a, number) for (a, _), number in self.activities.items()
        }:
            return _answer(404, {"message": "Record Not Found"})
        if activity_id in self.locked:
            return _answer(403, {"message": "Forbidden"})
        self.descriptions[activity_id] = self._form(call)["description"]
        return _answer(200, {"id": activity_id})

    def _read(self, upload: dict[str, Any]) -> None:
        mine = (upload["athlete"], upload["external_id"])
        if upload["unreadable"]:
            upload["error"] = "Improperly formatted data."
        elif mine in self.activities:
            upload["error"] = (
                f"{upload['external_id']}.gpx duplicate of"
                f" <a href='/activities/{self.activities[mine]}'>Morning Run</a>"
            )
        else:
            upload["activity_id"] = self.activities[mine] = 1_000_000 + next(
                self._numbers
            )

    def _state(self, upload_id: int) -> dict[str, Any]:
        upload = self.uploads[upload_id]
        if "activity_id" in upload:
            status = "Your activity is ready."
        elif "error" in upload:
            status = "There was an error processing your activity."
        else:
            status = "Your activity is still being processed."
        return {
            "id": upload_id,
            "id_str": str(upload_id),
            "external_id": f"{upload['external_id']}.gpx",
            "error": upload.get("error"),
            "status": status,
            "activity_id": upload.get("activity_id"),
        }


class HeldStrava(FakeStrava):
    """The fake Strava holding the first call to one address, once armed,
    until the test lets it go: a sending caught halfway, at Strava."""

    def __init__(self, wall: WallClock) -> None:
        super().__init__(wall)
        self.held: tuple[str, str] | None = None
        self.arrived = threading.Event()
        self.go = threading.Event()

    def __call__(self, call: Call) -> Reply:
        if (call.method, call.url) == self.held and not self.arrived.is_set():
            self.arrived.set()
            assert self.go.wait(WAIT_S)
        return super().__call__(call)


@pytest.fixture
def wall() -> WallClock:
    return WallClock()


@pytest.fixture
def fake(wall: WallClock) -> FakeStrava:
    return FakeStrava(wall)


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture(autouse=True)
def blocks(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[str]]:
    """Every database block watched: none opens while the same thread holds
    another (TASK-293). From the API's pool such a block would hold one
    connection while it waits for a second. The test fails if one did,
    with where it was opened."""
    nested: list[str] = []
    held = threading.local()
    plain = Database.connect

    @contextmanager
    def connect(self: Database) -> Iterator[DictConnection]:
        depth: int = getattr(held, "depth", 0)
        if depth:
            stack = traceback.extract_stack(limit=8)[:-2]
            nested.append(" < ".join(f"{f.name}:{f.lineno}" for f in stack[::-1]))
        held.depth = depth + 1
        try:
            with plain(self) as conn:
                yield conn
        finally:
            held.depth = depth

    monkeypatch.setattr(Database, "connect", connect)
    yield nested
    assert nested == [], "a database block inside another: " + "; ".join(nested)


def api(
    database: Database,
    wall: WallClock,
    fake: FakeStrava | None,
    domain: str | None = DOMAIN,
) -> TestClient:
    strava = (
        None
        if fake is None
        else Strava(
            CLIENT_ID, CLIENT_SECRET, domain, send=fake, wait=fake.sleeps.append
        )
    )
    return TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            run_places=PlaceNames("test-key", fetch=lambda _: {"results": [TRENTO]}),
            strava=strava,
        )
    )


TRENTO = {"city": "Trento", "country": "Italy"}


@pytest.fixture
def client(database: Database, wall: WallClock, fake: FakeStrava) -> TestClient:
    return api(database, wall, fake)


def signed_up(client: TestClient, **changes: Any) -> dict[str, str]:
    """A new account, as the header its requests carry."""
    body = {**_load("sign-up-request.json"), **changes}
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def other(client: TestClient) -> dict[str, str]:
    return signed_up(client, email="other@example.com", username="other_runner")


def state_of(url: str) -> str:
    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["state"][0]


def asked(client: TestClient, headers: dict[str, str]) -> str:
    """The state of a connection just asked for."""
    answer = client.post("/me/strava/connect", headers=headers)
    assert answer.status_code == 200
    return state_of(answer.json()["url"])


def back(client: TestClient, **query: str) -> Any:
    """The browser coming back from Strava: no key, no token."""
    return client.get(CALLBACK_PATH, params=query)


def connected(
    client: TestClient, fake: FakeStrava, headers: dict[str, str], athlete: int = ADA
) -> None:
    answer = back(
        client, state=asked(client, headers), code=fake.approve(athlete), scope=GRANTED
    )
    assert answer.status_code == 200
    assert "Strava is connected." in answer.text


def saved(client: TestClient, headers: dict[str, str], key: str = KEY, **changes: Any):
    body = {**_load("activity-request.json"), **changes}
    answer = client.put(f"/me/activities/{key}", json=body, headers=headers)
    assert answer.status_code == 201
    return answer


def rows(database: Database, query: str) -> list[dict[str, Any]]:
    with psycopg.connect(database.url, row_factory=dict_row) as conn:
        return conn.execute(query).fetchall()


def status(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    answer = client.get("/me/strava", headers=headers)
    assert answer.status_code == 200
    return answer.json()


def message(answer: Any) -> str:
    return str(answer.json()["error"]["message"])


RUNS = "SELECT strava_status, strava_upload_id FROM runs"


def until(condition: Callable[[], bool]) -> None:
    deadline = time.monotonic() + WAIT_S
    while not condition():
        assert time.monotonic() < deadline, "waited too long"
        time.sleep(0.02)


def waiting_for_a_lock(database: Database) -> bool:
    """Some transaction of this test's database waits for a row another
    holds."""
    return bool(
        rows(
            database,
            "SELECT 1 FROM pg_stat_activity WHERE datname = current_database()"
            " AND wait_event_type = 'Lock'",
        )
    )


def at_once(
    fake: HeldStrava,
    database: Database,
    first: Callable[[], Any],
    then: Callable[[], Any],
) -> list[Any]:
    """`first` until Strava holds it, then `then` until it waits for a lock;
    then Strava lets the first go. Both answers."""
    with ThreadPoolExecutor(2) as pool:
        try:
            ahead = pool.submit(first)
            assert fake.arrived.wait(WAIT_S)
            behind = pool.submit(then)
            until(lambda: waiting_for_a_lock(database))
        finally:
            fake.go.set()
        return [ahead.result(WAIT_S), behind.result(WAIT_S)]


# --- The migration and the contract ---


def test_the_migration_comes_after_the_runs() -> None:
    names = [path.name for path in migrations()]
    assert names.index("0004_strava.sql") > names.index("0003_runs.sql")


def test_the_examples_are_the_bodies() -> None:
    for name, model in (
        ("strava-status.json", StravaStatusBody),
        ("strava-connect.json", StravaConnectBody),
        ("strava-activity.json", StravaActivityBody),
        ("strava-send-post.json", StravaSendBody),
    ):
        example = _load(name)
        assert set(example) == set(model.model_fields)
        assert model.model_validate(example).model_dump() == example
    # The body of an app before TASK-208: the name alone; before TASK-231,
    # no post.
    before = _load("strava-send.json")
    assert set(before) == set(StravaSendBody.model_fields) - {"description", "post"}
    StravaSendBody.model_validate(before)
    described = _load("strava-send-description.json")
    assert set(described) == set(StravaSendBody.model_fields) - {"post"}
    StravaSendBody.model_validate(described)
    url = _load("strava-connect.json")["url"]
    assert url.startswith(AUTHORIZE_URL + "?")


def test_the_callback_needs_no_api_key() -> None:
    assert CALLBACK_PATH in OPEN_PATHS


# --- Strava off ---


def test_without_the_two_variables_strava_is_off(
    database: Database, wall: WallClock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv(CLIENT_ID_VARIABLE, raising=False)
    monkeypatch.delenv(CLIENT_SECRET_VARIABLE, raising=False)
    client = api(database, wall, None)
    headers = signed_up(client)
    saved(client, headers)

    assert status(client, headers) == {
        "available": False,
        "connected": False,
        "athlete": None,
    }
    for answer in (
        client.post("/me/strava/connect", headers=headers),
        client.get(f"/me/activities/{KEY}/strava", headers=headers),
        client.post(f"/me/activities/{KEY}/strava", headers=headers),
    ):
        assert answer.status_code == 503
        assert answer.json()["error"]["code"] == "http_error"
    assert back(client, state="x", code="y", scope=GRANTED).status_code == 503
    assert client.delete("/me/strava", headers=headers).status_code == 204
    # The rest is as before.
    assert client.get(f"/me/activities/{KEY}", headers=headers).status_code == 200
    assert client.delete("/me", headers=headers).status_code == 204


def test_one_variable_alone_is_off() -> None:
    assert Strava.from_env({CLIENT_ID_VARIABLE: CLIENT_ID}) is None
    assert Strava.from_env({CLIENT_SECRET_VARIABLE: CLIENT_SECRET}) is None
    assert Strava.from_env({}) is None
    on = Strava.from_env(
        {
            CLIENT_ID_VARIABLE: f" {CLIENT_ID} ",
            CLIENT_SECRET_VARIABLE: CLIENT_SECRET,
            "SHAPEROUTE_DOMAIN": DOMAIN,
        }
    )
    assert on is not None
    assert (on.client_id, on.client_secret, on.domain) == (
        CLIENT_ID,
        CLIENT_SECRET,
        DOMAIN,
    )
    assert CLIENT_SECRET not in repr(on)


def test_strava_needs_an_account(client: TestClient) -> None:
    for answer in (
        client.get("/me/strava"),
        client.post("/me/strava/connect"),
        client.delete("/me/strava"),
        client.get(f"/me/activities/{KEY}/strava"),
        client.post(f"/me/activities/{KEY}/strava"),
    ):
        assert answer.status_code == 401
        assert answer.json()["error"]["code"] == "not_signed_in"


# --- Connecting ---


def test_connect_gives_stravas_page_for_this_server(client: TestClient) -> None:
    headers = signed_up(client)
    url = client.post("/me/strava/connect", headers=headers).json()["url"]

    assert url.startswith(AUTHORIZE_URL + "?")
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    state = query.pop("state")[0]
    assert len(state) >= 32
    assert query == {
        "client_id": [CLIENT_ID],
        "redirect_uri": [f"https://{DOMAIN}/strava/callback"],
        "response_type": ["code"],
        "approval_prompt": ["auto"],
        "scope": ["activity:write"],
    }
    assert CLIENT_SECRET not in url
    assert status(client, headers)["connected"] is False


def test_without_a_domain_the_browser_comes_back_where_the_app_asked(
    database: Database, wall: WallClock, fake: FakeStrava
) -> None:
    client = api(database, wall, fake, domain=None)
    url = client.post("/me/strava/connect", headers=signed_up(client)).json()["url"]
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    assert query["redirect_uri"] == ["http://testserver/strava/callback"]


def test_the_callback_connects_the_athlete(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    answer = back(
        client, state=asked(client, headers), code=fake.approve(), scope=GRANTED
    )

    assert answer.status_code == 200
    assert answer.headers["content-type"].startswith("text/html")
    assert answer.headers["cache-control"] == "no-store"
    assert "Strava is connected." in answer.text
    assert "Go back to MuW." in answer.text
    assert status(client, headers) == _load("strava-status.json")
    [kept] = rows(database, "SELECT * FROM strava_accounts")
    assert kept["athlete_id"] == ADA
    assert fake.access[kept["access_token"]][0] == ADA
    assert fake.refresh[kept["refresh_token"]] == ADA
    assert kept["expires_at"] == fake.wall() + timedelta(hours=6)
    assert rows(database, "SELECT * FROM strava_states") == []


def test_the_callback_passes_where_the_api_wants_a_key(
    database: Database,
    wall: WallClock,
    fake: FakeStrava,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SHAPEROUTE_API_KEY", "k" * 32)
    client = api(database, wall, fake)
    assert client.get("/me/strava").json()["error"]["code"] == "unauthorized"
    client.headers["X-API-Key"] = "k" * 32
    headers = signed_up(client)
    state = asked(client, headers)
    del client.headers["X-API-Key"]

    answer = back(client, state=state, code=fake.approve(), scope=GRANTED)
    assert answer.status_code == 200
    assert "Strava is connected." in answer.text


def test_a_state_works_once(client: TestClient, fake: FakeStrava) -> None:
    headers = signed_up(client)
    state = asked(client, headers)
    assert back(client, state=state, code=fake.approve(), scope=GRANTED).is_success
    client.delete("/me/strava", headers=headers)

    again = back(client, state=state, code=fake.approve(), scope=GRANTED)
    assert again.status_code == 400
    assert "This link has expired." in again.text
    assert status(client, headers)["connected"] is False


def test_a_state_dies_after_ten_minutes(
    client: TestClient, fake: FakeStrava, wall: WallClock
) -> None:
    headers = signed_up(client)
    state = asked(client, headers)
    wall.t += timedelta(minutes=10)

    late = back(client, state=state, code=fake.approve(), scope=GRANTED)
    assert late.status_code == 400
    assert status(client, headers)["connected"] is False
    assert fake.made("POST", TOKEN_URL) == []


def test_an_unknown_state_connects_nothing(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    asked(client, headers)
    for query in (
        {"state": "made-up", "code": fake.approve(), "scope": GRANTED},
        {"state": "x" * 5000, "code": fake.approve(), "scope": GRANTED},
        {"code": fake.approve(), "scope": GRANTED},
        {},
    ):
        assert back(client, **query).status_code == 400
    assert status(client, headers)["connected"] is False
    assert fake.made("POST", TOKEN_URL) == []


def test_a_new_connect_ends_the_state_before_it(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    first = asked(client, headers)
    second = asked(client, headers)

    assert (
        back(client, state=first, code=fake.approve(), scope=GRANTED).status_code == 400
    )
    assert back(client, state=second, code=fake.approve(), scope=GRANTED).is_success
    assert status(client, headers)["connected"] is True


def test_a_state_connects_only_the_account_that_asked(
    client: TestClient, fake: FakeStrava
) -> None:
    mine, theirs = signed_up(client), other(client)
    state = asked(client, theirs)
    asked(client, mine)

    assert back(client, state=state, code=fake.approve(), scope=GRANTED).is_success
    assert status(client, theirs)["connected"] is True
    assert status(client, mine)["connected"] is False


def test_saying_no_on_strava_connects_nothing(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    answer = back(client, state=asked(client, headers), error="access_denied")

    assert answer.status_code == 200
    assert "Strava is not connected." in answer.text
    assert status(client, headers)["connected"] is False
    assert fake.calls == []


def test_without_the_permission_to_upload_nothing_is_kept(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    answer = back(
        client, state=asked(client, headers), code=fake.approve(), scope="read"
    )

    assert answer.status_code == 200
    assert "permission to upload" in answer.text
    assert status(client, headers)["connected"] is False
    assert rows(database, "SELECT * FROM strava_accounts") == []
    # No token was even asked for.
    assert fake.calls == []


def test_a_code_strava_does_not_know_connects_nothing(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    answer = back(client, state=asked(client, headers), code="made-up", scope=GRANTED)
    assert answer.status_code == 400
    assert status(client, headers)["connected"] is False


def test_strava_silent_at_the_callback_connects_nothing(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    state = asked(client, headers)
    fake.down = True

    answer = back(client, state=state, code=fake.approve(), scope=GRANTED)
    assert answer.status_code == 502
    assert "Strava did not answer." in answer.text
    assert status(client, headers)["connected"] is False


def test_a_second_athlete_on_an_app_not_reviewed_is_told_why(
    client: TestClient, fake: FakeStrava
) -> None:
    fake.capacity = 1
    mine, theirs = signed_up(client), other(client)
    connected(client, fake, mine, ADA)

    answer = back(
        client, state=asked(client, theirs), code=fake.approve(GRACE), scope=GRANTED
    )
    assert answer.status_code == 403
    assert "takes only its owner" in answer.text
    assert status(client, theirs)["connected"] is False
    assert status(client, mine)["athlete"] == "Ada Lovelace"


def test_an_athlete_is_of_the_last_account_that_connected(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    mine, theirs = signed_up(client), other(client)
    connected(client, fake, mine)
    connected(client, fake, theirs)

    assert status(client, mine)["connected"] is False
    assert status(client, theirs)["athlete"] == "Ada Lovelace"
    [kept] = rows(database, "SELECT * FROM strava_accounts")
    # The tokens kept are the ones Strava takes now.
    assert kept["refresh_token"] in fake.refresh
    assert fake.made("POST", REVOKE_URL) == []


def test_connecting_another_athlete_lets_the_first_go(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers, ADA)
    connected(client, fake, headers, GRACE)

    assert status(client, headers)["athlete"] == "Grace Hopper"
    assert set(fake.refresh.values()) == {GRACE}
    assert len(fake.made("POST", REVOKE_URL)) == 1


# --- Sending a run ---


def test_a_run_becomes_an_activity(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    before = client.get(f"/me/activities/{KEY}/strava", headers=headers)
    assert before.json() == {"status": "not_sent", "url": None}

    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert answer.status_code == 200
    activity_id = fake.activities[(ADA, KEY)]
    assert answer.json() == {
        "status": "sent",
        "url": f"https://www.strava.com/activities/{activity_id}",
    }
    assert set(answer.json()) == set(_load("strava-activity.json"))
    after = client.get(f"/me/activities/{KEY}/strava", headers=headers)
    assert after.json() == answer.json()
    [run] = rows(database, "SELECT * FROM runs")
    assert run["strava_status"] == "sent"
    assert run["strava_activity_id"] == activity_id
    # Strava was given a second between two looks, as it asks.
    assert fake.sleeps == [1.0, 1.0]


def test_what_strava_receives_is_the_run_with_its_times(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    client.post(f"/me/activities/{KEY}/strava", headers=headers)

    [form] = fake.files
    gpx = form.pop("file")
    assert form == {
        "data_type": "gpx",
        "sport_type": "Run",
        "external_id": KEY,
        "name": "Star in Trento",
        "description": "Drawn with MuW",
        "file_name": f"{KEY}.gpx",
        "file_type": "application/gpx+xml",
    }
    root = ET.fromstring(gpx)
    assert root.get("creator") == "MuW"
    # The example pauses after its second fix: two segments.
    segments = root.findall(f"{GPX}trk/{GPX}trkseg")
    assert [len(segment) for segment in segments] == [2, 3]
    points = root.findall(f".//{GPX}trkpt")
    assert (points[0].get("lat"), points[0].get("lon")) == ("46.0671000", "11.1214000")
    times = [point.findtext(f"{GPX}time") for point in points]
    # 1790000000000 ms and a fix every five minutes.
    assert times == [
        "2026-09-21T14:13:20.000Z",
        "2026-09-21T14:18:20.000Z",
        "2026-09-21T14:23:20.000Z",
        "2026-09-21T14:28:20.000Z",
        "2026-09-21T14:33:20.000Z",
    ]


def test_a_run_without_a_route_has_stravas_own_name(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers, points=None, similarity=None, shape=None)
    assert client.post(f"/me/activities/{KEY}/strava", headers=headers).is_success

    [form] = fake.files
    assert "name" not in form
    # It drew nothing: MuW only recorded it (the user's choice).
    assert form["description"] == "Recorded with MuW"


def test_the_name_typed_in_the_app_is_the_activitys(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    answer = client.post(
        f"/me/activities/{KEY}/strava",
        json={"name": "  Sunday\nheart  run "},
        headers=headers,
    )

    assert answer.status_code == 200
    [form] = fake.files
    assert form["name"] == "Sunday heart run"
    assert form["description"] == "Drawn with MuW"
    # The file has the same name as the activity.
    root = ET.fromstring(form["file"])
    assert root.findtext(f"{GPX}metadata/{GPX}name") == "Sunday heart run"


def test_an_empty_name_is_sgravas_own(client: TestClient, fake: FakeStrava) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    answer = client.post(
        f"/me/activities/{KEY}/strava", json={"name": "   "}, headers=headers
    )

    assert answer.status_code == 200
    [form] = fake.files
    assert form["name"] == "Star in Trento"


def test_a_name_typed_for_a_free_run_is_sent(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers, points=None, similarity=None, shape=None)
    client.post(
        f"/me/activities/{KEY}/strava", json={"name": "Lunch run"}, headers=headers
    )

    [form] = fake.files
    assert form["name"] == "Lunch run"


def test_the_name_counts_only_for_the_first_upload(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    path = f"/me/activities/{KEY}/strava"
    first = client.post(path, json={"name": "First"}, headers=headers)

    second = client.post(path, json={"name": "Second"}, headers=headers)

    assert second.json() == first.json()
    [form] = fake.files
    assert form["name"] == "First"


def test_the_description_and_the_activity_go_to_strava(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers, activity="cycling")
    body = _load("strava-send-description.json")
    client.post(f"/me/activities/{KEY}/strava", json=body, headers=headers)

    [form] = fake.files
    assert form["sport_type"] == "Ride"
    assert form["name"] == body["name"]
    # The runner's words, then MuW's line.
    assert form["description"] == body["description"] + "\n\nDrawn with MuW"


def test_without_a_typed_description_strava_gets_the_drawings(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers, key=KEY, points=None, similarity=None, shape=None)
    saved(client, headers, key=OTHER_KEY, activity="paddling")
    kept = client.put(
        f"/me/activities/{KEY}/drawing",
        json={
            "visibility": "only_me",
            "description": "Legs heavy.",
            "activity": "paddling",
        },
        headers=headers,
    )
    assert kept.status_code == 200
    client.post(f"/me/activities/{KEY}/strava", json={"name": ""}, headers=headers)
    client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers)

    freehand, drawn = fake.files
    assert freehand["description"] == "Legs heavy.\n\nRecorded with MuW"
    assert freehand["sport_type"] == drawn["sport_type"] == "StandUpPaddling"
    # No words anywhere: MuW's line alone, as before TASK-208.
    assert drawn["description"] == "Drawn with MuW"


def test_every_activity_has_a_strava_sport() -> None:
    assert set(SPORT_TYPES) == set(SUPPORTED_ACTIVITIES)


def test_a_typed_description_keeps_its_lines_and_is_cut_not_refused() -> None:
    assert typed_description(None) is None
    assert typed_description(" \n\t ") is None
    assert typed_description("  Legs heavy. \r\n Round heart.\n") == (
        "Legs heavy.\nRound heart."
    )
    long = typed_description("x" * (MAX_DESCRIPTION_LENGTH + 20))
    assert long == "x" * MAX_DESCRIPTION_LENGTH
    assert strava_description(None, drawn=False) == "Recorded with MuW"
    assert strava_description("Fun.", drawn=True) == "Fun.\n\nDrawn with MuW"
    # The post's text on top (TASK-231).
    assert strava_description("Fun.", drawn=True, post="🔥 5.20 km") == (
        "🔥 5.20 km\n\nFun.\n\nDrawn with MuW"
    )
    assert strava_description(None, drawn=False, post="🔥") == (
        "🔥\n\nRecorded with MuW"
    )


def test_the_post_goes_over_the_runners_words(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    body = _load("strava-send-post.json")
    client.post(f"/me/activities/{KEY}/strava", json=body, headers=headers)

    [form] = fake.files
    assert form["name"] == body["name"]
    assert form["description"] == (
        f"{body['post']}\n\n{body['description']}\n\nDrawn with MuW"
    )


def test_a_post_changes_the_text_of_a_run_already_on_strava(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    kept = client.put(
        f"/me/activities/{KEY}/drawing",
        json={"visibility": "only_me", "description": "Legs heavy."},
        headers=headers,
    )
    assert kept.status_code == 200
    first = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    [form] = fake.files
    assert form["description"] == "Legs heavy.\n\nDrawn with MuW"

    again = client.post(
        f"/me/activities/{KEY}/strava",
        json={"name": "Not this", "post": " 🔥❤️ 5.20 km · Score 87 "},
        headers=headers,
    )

    assert again.status_code == 200
    assert again.json() == first.json()
    # No second upload: the same activity, its text changed, its name not.
    assert len(fake.files) == 1
    [activity_id] = fake.activities.values()
    [put] = fake.made("PUT", ACTIVITIES_URL)
    assert put.url == f"{ACTIVITIES_URL}/{activity_id}"
    assert fake.descriptions[activity_id] == (
        "🔥❤️ 5.20 km · Score 87\n\nLegs heavy.\n\nDrawn with MuW"
    )
    # Without a post a run already sent is answered as it is.
    client.post(f"/me/activities/{KEY}/strava", json={"post": " "}, headers=headers)
    client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert len(fake.made("PUT", ACTIVITIES_URL)) == 1


def test_an_activity_strava_will_not_let_change_is_said(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    first = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    [activity_id] = fake.activities.values()
    fake.locked.add(activity_id)

    refused = client.post(
        f"/me/activities/{KEY}/strava", json={"post": "🔥"}, headers=headers
    )

    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "invalid_request"
    assert message(refused) == (
        "Strava did not let MuW change this activity: change its text on Strava."
    )
    assert activity_id not in fake.descriptions
    # Deleted on Strava: the same. The run stays sent, as it was.
    fake.locked.clear()
    fake.activities.clear()
    gone = client.post(
        f"/me/activities/{KEY}/strava", json={"post": "🔥"}, headers=headers
    )
    assert gone.status_code == 422
    still = client.get(f"/me/activities/{KEY}/strava", headers=headers)
    assert still.json() == first.json()


def test_a_typed_name_is_one_line_and_not_too_long() -> None:
    assert typed_name(None) is None
    assert typed_name("") is None
    assert typed_name(" \t\n ") is None
    assert typed_name("Heart\r\nin  Trento") == "Heart in Trento"
    assert typed_name("x" * (MAX_NAME + 20)) == "x" * MAX_NAME
    # Cut where a space was: no space left at its end.
    assert typed_name("a" * (MAX_NAME - 1) + " b") == "a" * (MAX_NAME - 1)


def test_a_run_sent_twice_is_one_activity(client: TestClient, fake: FakeStrava) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    first = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    calls = len(fake.calls)

    second = client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert second.status_code == 200
    assert second.json() == first.json()
    # Strava was not even asked.
    assert len(fake.calls) == calls
    assert len(fake.activities) == 1


def test_a_run_strava_has_already_is_sent_without_an_error(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    first = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    # The server forgot (a copy of the database put back): Strava did not.
    with psycopg.connect(database.url) as conn:
        conn.execute(
            "UPDATE runs SET strava_status = NULL, strava_upload_id = NULL,"
            " strava_activity_id = NULL"
        )

    again = client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert again.status_code == 200
    assert again.json() == first.json()
    assert len(fake.activities) == 1


def test_a_slow_strava_is_followed_by_the_next_call(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.slow_looks = POLLS + 2

    first = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert first.status_code == 202
    assert first.json() == {"status": "processing", "url": None}
    assert len(fake.sleeps) == POLLS
    shown = client.get(f"/me/activities/{KEY}/strava", headers=headers)
    assert shown.json() == {"status": "processing", "url": None}

    second = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert second.status_code == 200
    assert second.json()["status"] == "sent"
    # One file went, however long Strava took.
    assert len(fake.files) == 1


def test_a_run_strava_cannot_read_is_said_and_may_be_sent_again(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.unreadable = True

    refused = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert refused.status_code == 422
    assert message(refused) == "Strava could not read this run."
    shown = client.get(f"/me/activities/{KEY}/strava", headers=headers)
    assert shown.json()["status"] == "not_sent"

    again = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert again.json()["status"] == "sent"
    assert len(fake.files) == 2


def test_only_the_owner_sends_a_run(client: TestClient, fake: FakeStrava) -> None:
    mine, theirs = signed_up(client), other(client)
    connected(client, fake, theirs)
    saved(client, mine)

    for answer in (
        client.post(f"/me/activities/{KEY}/strava", headers=theirs),
        client.get(f"/me/activities/{KEY}/strava", headers=theirs),
        client.post(f"/me/activities/{OTHER_KEY}/strava", headers=mine),
    ):
        assert answer.status_code == 404
    assert (
        client.post("/me/activities/NOT-A-KEY/strava", headers=mine).status_code == 422
    )
    assert fake.files == []


def test_sending_needs_a_connected_athlete(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    saved(client, headers)
    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert answer.status_code == 409
    assert message(answer) == "Strava is not connected: connect it first."
    assert fake.calls == []


# --- The tokens ---


def test_an_expired_token_renews_itself(
    client: TestClient, fake: FakeStrava, database: Database, wall: WallClock
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    [before] = rows(database, "SELECT * FROM strava_accounts")
    wall.t += timedelta(hours=7)

    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert answer.status_code == 200
    assert answer.json()["status"] == "sent"
    [after] = rows(database, "SELECT * FROM strava_accounts")
    assert after["access_token"] != before["access_token"]
    # Strava changed the refresh token too: the new one is kept.
    assert after["refresh_token"] in fake.refresh
    assert after["expires_at"] == wall() + timedelta(hours=6)
    # Exchanged once, renewed once.
    assert len(fake.made("POST", TOKEN_URL)) == 2


def test_a_token_about_to_expire_is_renewed_before_it_is_used(
    client: TestClient, fake: FakeStrava, wall: WallClock
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    wall.t += timedelta(hours=5, minutes=58)

    assert client.post(f"/me/activities/{KEY}/strava", headers=headers).is_success
    assert len(fake.made("POST", TOKEN_URL)) == 2


def test_access_taken_away_on_strava_asks_to_connect_again(
    client: TestClient, fake: FakeStrava, database: Database, wall: WallClock
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.remove_app()

    # The token is good by the clock: Strava refuses it all the same.
    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert answer.status_code == 409
    assert message(answer) == "Strava is not connected: connect it first."
    assert status(client, headers) == {
        "available": True,
        "connected": False,
        "athlete": None,
    }
    assert rows(database, "SELECT * FROM strava_accounts") == []
    # Connecting again works, and the run goes.
    connected(client, fake, headers)
    assert client.post(f"/me/activities/{KEY}/strava", headers=headers).is_success


def test_an_expired_token_of_an_access_taken_away_asks_to_connect_again(
    client: TestClient, fake: FakeStrava, database: Database, wall: WallClock
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.remove_app()
    wall.t += timedelta(hours=7)

    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert answer.status_code == 409
    assert rows(database, "SELECT * FROM strava_accounts") == []
    assert fake.files == []


def test_a_token_that_may_not_upload_asks_to_connect_again(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.read_only.add(ADA)

    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert answer.status_code == 409
    assert rows(database, "SELECT * FROM strava_accounts") == []
    assert len(fake.made("POST", REVOKE_URL)) == 1


def test_a_wrong_client_secret_disconnects_nobody(
    database: Database, wall: WallClock, fake: FakeStrava
) -> None:
    good = api(database, wall, fake)
    headers = signed_up(good)
    connected(good, fake, headers)
    saved(good, headers)
    wall.t += timedelta(hours=7)
    wrong = TestClient(
        create_app(
            FileSource(Path("unused.graphml")),
            accounts=Accounts(database, now=wall, hasher=FAST_HASHER),
            strava=Strava(CLIENT_ID, "not-the-secret", DOMAIN, send=fake),
        )
    )

    answer = wrong.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert answer.status_code == 502
    assert len(rows(database, "SELECT * FROM strava_accounts")) == 1


# --- One block at a time (TASK-293) ---


def test_the_watch_sees_a_block_inside_another(
    database: Database, blocks: list[str]
) -> None:
    def block() -> None:
        with database.connect():
            pass

    block()
    block()
    # Another thread's block is not inside this one's.
    with database.connect():
        with ThreadPoolExecutor(1) as pool:
            pool.submit(block).result()
    assert blocks == []

    with database.connect():
        with database.connect():
            pass
    assert len(blocks) == 1
    assert "test_the_watch_sees_a_block_inside_another" in blocks[0]
    blocks.clear()


def test_a_run_sent_twice_at_once_is_uploaded_once(
    database: Database, wall: WallClock
) -> None:
    """One sending of a run at a time: the second waits for the run while
    the first is at Strava, then finds what the first did."""
    fake = HeldStrava(wall)
    client = api(database, wall, fake)
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.held = ("POST", UPLOADS_URL)

    def send() -> Any:
        return client.post(f"/me/activities/{KEY}/strava", headers=headers)

    answers = at_once(fake, database, send, send)

    assert [answer.status_code for answer in answers] == [200, 200]
    assert answers[0].json() == answers[1].json()
    assert answers[0].json()["status"] == "sent"
    assert len(fake.files) == 1
    [run] = rows(database, RUNS)
    assert run["strava_status"] == "sent"


@pytest.mark.parametrize("looks", [1, POLLS + 1], ids=["sent", "processing"])
def test_a_sending_between_the_first_look_and_the_lock_is_found(
    database: Database,
    wall: WallClock,
    fake: FakeStrava,
    monkeypatch: pytest.MonkeyPatch,
    looks: int,
) -> None:
    """The first sending reads the run with no lock, then locks it: a second
    one that slips in between and uploads the run is found under the lock,
    whether Strava has read the file by then or not. Strava gets one file."""
    client = api(database, wall, fake)
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.slow_looks = looks
    arrived, go = threading.Event(), threading.Event()
    locked = StravaRuns._send_with

    def held(runs: StravaRuns, *args: Any) -> StravaActivityBody:
        # Only the first sending stops, after its first look, before the lock.
        if not arrived.is_set():
            arrived.set()
            assert go.wait(WAIT_S)
        return locked(runs, *args)

    monkeypatch.setattr(StravaRuns, "_send_with", held)

    def send() -> Any:
        return client.post(f"/me/activities/{KEY}/strava", headers=headers)

    with ThreadPoolExecutor(1) as pool:
        try:
            first = pool.submit(send)
            assert arrived.wait(WAIT_S)
            assert [run["strava_status"] for run in rows(database, RUNS)] == [None]
            second = send()
        finally:
            go.set()
        first_answer = first.result(WAIT_S)

    assert second.json()["status"] == ("sent" if looks == 1 else "processing")
    assert first_answer.status_code == 200
    assert first_answer.json()["status"] == "sent"
    assert len(fake.files) == 1
    [run] = rows(database, RUNS)
    assert run["strava_status"] == "sent"


def test_two_runs_sent_at_once_renew_an_expired_token_once(
    database: Database, wall: WallClock
) -> None:
    """One renewal at a time: the second sending waits for the token while
    the first renews it, then takes the new one."""
    fake = HeldStrava(wall)
    client = api(database, wall, fake)
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    saved(client, headers, OTHER_KEY)
    wall.t += timedelta(hours=7)
    fake.held = ("POST", TOKEN_URL)

    answers = at_once(
        fake,
        database,
        lambda: client.post(f"/me/activities/{KEY}/strava", headers=headers),
        lambda: client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers),
    )

    assert [answer.json()["status"] for answer in answers] == ["sent", "sent"]
    # Exchanged once, renewed once.
    assert len(fake.made("POST", TOKEN_URL)) == 2
    assert len(fake.files) == 2


# --- Strava's troubles ---


def test_stravas_limit_is_said_with_when_to_try_again(
    client: TestClient, fake: FakeStrava, wall: WallClock
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    wall.t = datetime(2026, 10, 2, 8, 37, 30, tzinfo=UTC)

    fake.usage = "201,1500"
    quarter = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert quarter.status_code == 429
    assert quarter.json()["error"]["code"] == "too_many_requests"
    # Strava counts again at 08:45.
    assert quarter.headers["retry-after"] == "450"

    fake.usage = "150,2000"
    day = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert day.status_code == 429
    # And for the day at midnight UTC.
    assert day.headers["retry-after"] == str(15 * 3600 + 22 * 60 + 30)

    fake.usage = None
    assert client.post(f"/me/activities/{KEY}/strava", headers=headers).is_success
    assert len(fake.activities) == 1


def test_strava_silent_is_said_and_nothing_is_lost(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)

    fake.down = True
    answer = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert answer.status_code == 502
    assert message(answer) == "Strava did not answer: try again in a while."
    assert len(rows(database, "SELECT * FROM strava_accounts")) == 1

    fake.down = False
    assert client.post(f"/me/activities/{KEY}/strava", headers=headers).is_success


def test_an_upload_strava_lost_starts_over(
    client: TestClient, fake: FakeStrava
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    fake.slow_looks = POLLS + 2
    assert (
        client.post(f"/me/activities/{KEY}/strava", headers=headers).status_code == 202
    )
    fake.uploads.clear()
    fake.slow_looks = 1

    lost = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert lost.status_code == 502
    again = client.post(f"/me/activities/{KEY}/strava", headers=headers)
    assert again.json()["status"] == "sent"


def test_retry_after_counts_to_the_quarter_and_to_midnight() -> None:
    at = datetime(2026, 10, 2, 23, 59, 59, 500_000, tzinfo=UTC)
    assert retry_after_s(at, daily=False) == 1
    assert retry_after_s(at, daily=True) == 1
    assert retry_after_s(datetime(2026, 10, 2, 9, 0, tzinfo=UTC), daily=False) == 900


def test_what_became_of_an_upload() -> None:
    processing = "Your activity is still being processed."
    failed = "There was an error processing your activity."
    assert outcome(Upload(5, None, None, processing)) == ("processing", 0)
    assert outcome(Upload(5, 77, None, "Your activity is ready.")) == ("sent", 77)
    assert outcome(Upload(5, None, "a.gpx duplicate of activity 42", failed)) == (
        "sent",
        42,
    )
    # Strava has it and does not say where: sent all the same.
    assert outcome(Upload(5, None, "duplicate", failed)) == ("sent", 0)
    assert outcome(Upload(5, None, "Improperly formatted data.", failed)) == (
        "refused",
        0,
    )
    deleted = "The created activity has been deleted."
    assert outcome(Upload(5, None, None, deleted)) == ("refused", 0)
    assert outcome(Upload(None, None, None, "")) == ("refused", 0)


def test_the_name_says_what_was_drawn_and_where() -> None:
    def run(**fields: Any) -> dict[str, Any]:
        return {"shape": None, "word": None, "title": None, "place": None, **fields}

    assert activity_name(run(shape="heart", place="Trento")) == "Heart in Trento"
    assert activity_name(run(shape="christmas_tree")) == "Christmas tree"
    assert activity_name(run(word="CIAO", style="block", place="Levico Terme")) == (
        "CIAO in Levico Terme"
    )
    assert activity_name(run(title="Castles", place="Trento")) == "Castles in Trento"
    assert activity_name(run(place="Trento")) is None


# --- Disconnecting ---


def test_disconnect_revokes_on_strava_and_leaves_no_token(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    asked(client, headers)

    assert client.delete("/me/strava", headers=headers).status_code == 204

    assert fake.access == {} and fake.refresh == {}
    assert rows(database, "SELECT * FROM strava_accounts") == []
    assert rows(database, "SELECT * FROM strava_states") == []
    assert status(client, headers)["connected"] is False
    # Twice is the same.
    assert client.delete("/me/strava", headers=headers).status_code == 204
    assert len(fake.made("POST", REVOKE_URL)) == 1


def test_disconnect_leaves_no_token_even_when_strava_is_silent(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    fake.down = True

    assert client.delete("/me/strava", headers=headers).status_code == 204
    assert rows(database, "SELECT * FROM strava_accounts") == []


def test_deleting_the_account_revokes_on_strava_and_leaves_no_token(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    saved(client, headers)
    client.post(f"/me/activities/{KEY}/strava", headers=headers)

    assert client.delete("/me", headers=headers).status_code == 204

    assert fake.access == {} and fake.refresh == {}
    assert len(fake.made("POST", REVOKE_URL)) == 1
    for table in ("strava_accounts", "strava_states", "runs", "users"):
        assert rows(database, f"SELECT * FROM {table}") == []


def test_deleting_the_account_does_not_wait_for_strava(
    client: TestClient, fake: FakeStrava, database: Database
) -> None:
    headers = signed_up(client)
    connected(client, fake, headers)
    fake.down = True

    assert client.delete("/me", headers=headers).status_code == 204
    assert rows(database, "SELECT * FROM users") == []
    assert rows(database, "SELECT * FROM strava_accounts") == []


# --- Nothing secret gets out ---


def test_no_secret_is_answered_or_logged(
    client: TestClient,
    fake: FakeStrava,
    wall: WallClock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    headers = signed_up(client)
    saved(client, headers)
    state = asked(client, headers)
    answers = [
        back(client, state=state, code=fake.approve(), scope=GRANTED),
        client.get("/me/strava", headers=headers),
        client.post(f"/me/activities/{KEY}/strava", headers=headers),
        client.get(f"/me/activities/{KEY}/strava", headers=headers),
        client.get(f"/me/activities/{KEY}", headers=headers),
        client.get("/me", headers=headers),
    ]
    secrets = fake.secrets()
    # Renewed, refused, silent, limited: each failure has its own words.
    wall.t += timedelta(hours=7)
    saved(client, headers, key=OTHER_KEY)
    fake.unreadable = True
    answers.append(client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers))
    fake.down = True
    answers.append(client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers))
    answers.append(
        back(client, state=asked(client, headers), code=fake.approve(), scope=GRANTED)
    )
    fake.down = False
    fake.usage = "201,1500"
    answers.append(client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers))
    fake.usage = None
    secrets += fake.secrets()
    fake.remove_app()
    answers.append(client.post(f"/me/activities/{OTHER_KEY}/strava", headers=headers))
    answers.append(client.delete("/me/strava", headers=headers))

    assert [a.status_code for a in answers] == [
        200, 200, 200, 200, 200, 200, 422, 502, 502, 429, 409, 204,
    ]  # fmt: skip
    told = "\n".join(a.text + str(dict(a.headers)) for a in answers)
    # What the API logs; httpx is this test's own client, writing the
    # addresses it asked for.
    logged = [r for r in caplog.records if r.name != "httpx"]
    assert any(r.name == "shaperoute_api.strava" for r in logged)
    told += "\n".join(f"{r.getMessage()} {r.args} {r.exc_text}" for r in logged)
    assert len(secrets) >= 6
    for secret in [*secrets, state]:
        assert secret not in told
