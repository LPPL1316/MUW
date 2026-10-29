"""The profile in a real PostgreSQL (TASK-116, ADR-0128): username and bio
changed by their owner, the profile the other members see, never with the
email, and the accounts made before the profile still working."""

from __future__ import annotations

import base64
import io
import json
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from PIL import Image
from route_engine.network import FileSource

from shaperoute_api.accounts import (
    USERNAME_TAKEN,
    AccountError,
    Accounts,
    SessionBody,
    UserBody,
    token_hash,
)
from shaperoute_api.app import create_app
from shaperoute_api.db import MIGRATIONS_DIR, Database, migrations
from shaperoute_api.profile_photos import square_jpeg
from shaperoute_api.profiles import (
    BIO_NOT_TEXT,
    BIO_TOO_LONG,
    MAX_BIO_LENGTH,
    NO_PROFILE,
    USERNAME_RULE,
    EditProfileRequestBody,
    PublicProfileBody,
    checked_bio,
    checked_username,
)

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"
# Cheap parameters: every test signs up.
FAST_HASHER = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
# The migration of the profile, whatever its number when merged.
(PROFILES,) = [path for path in migrations() if path.name.endswith("_profiles.sql")]
EMAIL = "runner@example.com"
OTHER_EMAIL = "other@example.com"


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class WallClock:
    def __init__(self) -> None:
        self.t = datetime(2026, 10, 2, 21, 0, tzinfo=UTC)

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


def api(database: Database, wall: WallClock) -> TestClient:
    accounts = Accounts(database, now=wall, hasher=FAST_HASHER)
    return TestClient(create_app(FileSource(Path("unused.graphml")), accounts=accounts))


@pytest.fixture
def client(database: Database, wall: WallClock) -> TestClient:
    return api(database, wall)


def signed_up(client: TestClient, **changes: Any) -> dict[str, str]:
    """A new account, as the header its requests carry."""
    body = {**_load("sign-up-request.json"), **changes}
    answer = client.post("/accounts", json=body)
    assert answer.status_code == 201
    return {"Authorization": f"Bearer {answer.json()['token']}"}


def other(client: TestClient) -> dict[str, str]:
    return signed_up(client, email=OTHER_EMAIL, username="other_runner")


def me(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    answer = client.get("/me", headers=headers)
    assert answer.status_code == 200
    return dict(answer.json())


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


def message(answer: Any) -> str:
    return str(answer.json()["error"]["message"])


def old_account(
    database: Database, wall: WallClock, n: int, email: str, username: str
) -> dict[str, str]:
    """An account and a phone's session, as the API of before TASK-116 kept
    them; the header that phone sends."""
    token = f"token-of-before-{n}"
    with database.connect() as conn:
        conn.execute(
            "WITH made AS (INSERT INTO users"
            " (email, password_hash, username, confirmed_16_at, created_at)"
            " VALUES (%s, %s, %s, %s, %s) RETURNING id)"
            " INSERT INTO sessions (token_hash, user_id, created_at, last_used_at)"
            " SELECT %s, id, %s, %s FROM made",
            (
                email,
                FAST_HASHER.hash("correct horse battery"),
                username,
                wall.t,
                wall.t,
                token_hash(token),
                wall.t,
                wall.t,
            ),
        )
    return {"Authorization": f"Bearer {token}"}


def a_photo() -> str:
    picture = Image.new("RGB", (300, 300), (30, 160, 60))
    out = io.BytesIO()
    picture.save(out, "PNG")
    return base64.b64encode(out.getvalue()).decode("ascii")


# --- The contract and the rules, without a database ---


def test_the_examples_of_shared_types_are_the_contract() -> None:
    request = _load("edit-profile-request.json")
    assert set(request) == set(EditProfileRequestBody.model_fields)
    body = EditProfileRequestBody.model_validate(request)
    assert body.username is not None and body.bio is not None
    assert checked_username(body.username) == request["username"]
    assert checked_bio(body.bio) == request["bio"]
    profile = _load("public-profile.json")
    assert set(profile) == set(PublicProfileBody.model_fields)
    seen = PublicProfileBody.model_validate(profile)
    # The id the others use is the one /me gives its owner.
    session = SessionBody.model_validate(_load("session.json"))
    assert seen.public_id == session.user.public_id
    assert session.user.bio == ""


def test_the_migration_comes_after_the_walks() -> None:
    names = [path.name for path in migrations()]
    assert names.index(PROFILES.name) > names.index("0006_pen_up_walks.sql")


@pytest.mark.parametrize(
    "username", ["ab", "a" * 21, "two words", "dash-ed", "ünïcode", "at@sign", ""]
)
def test_a_username_out_of_the_rule_is_refused_in_words(username: str) -> None:
    with pytest.raises(AccountError) as refused:
        checked_username(username)
    assert (refused.value.status, refused.value.code) == (422, "invalid_request")
    assert refused.value.message == USERNAME_RULE


def test_a_bio_is_kept_as_written_without_spaces_at_its_ends() -> None:
    assert checked_bio("  Hearts on Sundays. \r\nTrento\r10 km  ") == (
        "Hearts on Sundays. \nTrento\n10 km"
    )
    assert checked_bio("") == ""
    # Characters, not bytes: an emoji is one.
    assert checked_bio("🏃" * MAX_BIO_LENGTH) == "🏃" * MAX_BIO_LENGTH
    with pytest.raises(AccountError, match=BIO_TOO_LONG):
        checked_bio("a" * (MAX_BIO_LENGTH + 1))
    for control in ("\x00", "\t", "\x1b", "\x7f"):
        with pytest.raises(AccountError, match=BIO_NOT_TEXT):
            checked_bio(f"a{control}b")


# --- Who may ask ---


def test_both_endpoints_need_an_account(client: TestClient) -> None:
    for method, path, body in (
        ("PATCH", "/me", {"bio": "Hi"}),
        ("GET", "/users/8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13", None),
    ):
        answer = client.request(method, path, json=body)
        assert (answer.status_code, code(answer)) == (401, "not_signed_in")
        wrong = {"Authorization": "Bearer not-a-token"}
        answer = client.request(method, path, json=body, headers=wrong)
        assert (answer.status_code, code(answer)) == (401, "not_signed_in")


def test_without_a_database_the_profiles_are_unavailable() -> None:
    client = TestClient(create_app(FileSource(Path("unused.graphml"))))
    headers = {"Authorization": "Bearer any"}
    answer = client.patch("/me", json={"bio": "Hi"}, headers=headers)
    assert (answer.status_code, code(answer)) == (503, "accounts_unavailable")
    answer = client.get("/users/8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13", headers=headers)
    assert (answer.status_code, code(answer)) == (503, "accounts_unavailable")


# --- PATCH /me ---


def test_a_new_account_has_no_bio_and_an_id_of_its_own(client: TestClient) -> None:
    mine = me(client, signed_up(client))
    theirs = me(client, other(client))
    assert mine["bio"] == theirs["bio"] == ""
    assert UUID(mine["public_id"]) != UUID(theirs["public_id"])
    assert set(mine) == set(UserBody.model_fields)


def test_username_and_bio_change_and_stay_changed(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    headers = signed_up(client)
    before = me(client, headers)
    answer = client.patch(
        "/me", json=_load("edit-profile-request.json"), headers=headers
    )
    assert answer.status_code == 200
    edited = answer.json()
    assert edited["username"] == "Ada_runs"
    assert edited["bio"] == "Hearts on Sunday mornings.\nTrento, 10 km at a time."
    # Nothing else moves: not the email, not the id the others use.
    for kept in ("id", "email", "role", "created_at", "public_id"):
        assert edited[kept] == before[kept]
    assert me(client, headers) == edited
    # Signing in again, from another phone, finds them.
    signed_in = client.post(
        "/session", json={"email": EMAIL, "password": "correct horse battery"}
    )
    assert signed_in.status_code == 200
    assert signed_in.json()["user"] == edited
    # And so does an API started again on the same database.
    assert me(api(database, wall), headers) == edited


def test_only_what_is_sent_changes(client: TestClient) -> None:
    headers = signed_up(client)
    client.patch("/me", json={"username": "Ada_runs", "bio": "Hi"}, headers=headers)
    answer = client.patch("/me", json={"bio": "Hello"}, headers=headers)
    assert (answer.json()["username"], answer.json()["bio"]) == ("Ada_runs", "Hello")
    answer = client.patch("/me", json={"username": "ada.runs"}, headers=headers)
    assert (answer.json()["username"], answer.json()["bio"]) == ("ada.runs", "Hello")
    # Null is the same as left out; nothing sent changes nothing.
    answer = client.patch("/me", json={"username": None, "bio": None}, headers=headers)
    assert (answer.json()["username"], answer.json()["bio"]) == ("ada.runs", "Hello")
    assert client.patch("/me", json={}, headers=headers).json() == answer.json()
    # An empty bio takes it away.
    assert client.patch("/me", json={"bio": "  "}, headers=headers).json()["bio"] == ""


def test_a_username_taken_says_so_and_ones_own_in_another_case_is_free(
    client: TestClient,
) -> None:
    headers = signed_up(client)
    other(client)
    for taken in ("other_runner", "OTHER_RUNNER"):
        answer = client.patch("/me", json={"username": taken}, headers=headers)
        assert (answer.status_code, code(answer)) == (409, "username_taken")
        assert message(answer) == USERNAME_TAKEN
    assert me(client, headers)["username"] == "Runner_42"
    answer = client.patch("/me", json={"username": "RUNNER_42"}, headers=headers)
    assert answer.status_code == 200
    assert answer.json()["username"] == "RUNNER_42"
    # Taken back by nobody else: the name freed is free.
    answer = client.patch("/me", json={"username": "Runner_43"}, headers=headers)
    assert answer.status_code == 200
    third = signed_up(client, email="third@example.com", username="runner_42")
    assert me(client, third)["username"] == "runner_42"


@pytest.mark.parametrize(
    ("body", "said"),
    [
        ({"username": "ab"}, USERNAME_RULE),
        ({"username": "two words"}, USERNAME_RULE),
        ({"username": "a" * 21}, USERNAME_RULE),
        ({"bio": "a" * (MAX_BIO_LENGTH + 1)}, BIO_TOO_LONG),
        ({"bio": "a\x00b"}, BIO_NOT_TEXT),
        # A good bio does not save a bad username: nothing changes.
        ({"username": "x", "bio": "Fine"}, USERNAME_RULE),
    ],
)
def test_a_value_refused_is_told_in_words_and_nothing_changes(
    client: TestClient, body: dict[str, str], said: str
) -> None:
    headers = signed_up(client)
    before = me(client, headers)
    answer = client.patch("/me", json=body, headers=headers)
    assert (answer.status_code, code(answer)) == (422, "invalid_request")
    assert message(answer) == said
    assert me(client, headers) == before


@pytest.mark.parametrize(
    "body",
    [
        {"email": "new@example.com"},
        {"role": "admin"},
        {"public_id": "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13"},
        {"username": 42},
        {"bio": ["a"]},
    ],
)
def test_only_username_and_bio_can_be_changed(
    client: TestClient, body: dict[str, Any]
) -> None:
    headers = signed_up(client)
    before = me(client, headers)
    answer = client.patch("/me", json=body, headers=headers)
    assert (answer.status_code, code(answer)) == (422, "invalid_request")
    assert me(client, headers) == before


# --- GET /users/{public_id} ---


def test_another_member_sees_the_profile_and_never_the_email(
    client: TestClient,
) -> None:
    headers = signed_up(client)
    client.patch("/me", json=_load("edit-profile-request.json"), headers=headers)
    mine = me(client, headers)
    viewer = other(client)
    answer = client.get(f"/users/{mine['public_id']}", headers=viewer)
    assert answer.status_code == 200
    seen = answer.json()
    assert seen == {
        "public_id": mine["public_id"],
        "username": "Ada_runs",
        "bio": "Hearts on Sunday mornings.\nTrento, 10 km at a time.",
        "photo": None,
        "drawings": 0,
        # Nobody follows nor is followed yet (TASK-211).
        "followers": 0,
        "following": 0,
        "follow": "none",
        # No contest closed yet (TASK-299).
        "contest_wins": 0,
        # No run, no reaction yet (TASK-324).
        "distance_m": 0,
        "climb_m": 0,
        "reactions": 0,
        # No drawing, no badge yet (TASK-341).
        "badges": [],
    }
    # Not the email, nor anything of the account behind the profile.
    assert EMAIL not in answer.text
    assert "runner@" not in answer.text.lower()
    for hidden in ("email", "id", "role", "created_at", "password_hash"):
        assert hidden not in seen
    # The owner sees the same page the others do.
    assert client.get(f"/users/{mine['public_id']}", headers=headers).json() == seen


def test_the_picture_comes_with_the_profile(client: TestClient) -> None:
    headers = signed_up(client)
    put = client.put("/me/photo", json={"image": a_photo()}, headers=headers)
    assert put.status_code == 200
    public_id = me(client, headers)["public_id"]
    seen = client.get(f"/users/{public_id}", headers=other(client)).json()
    assert seen["photo"] == put.json()["image"]
    assert client.delete("/me/photo", headers=headers).status_code == 204
    seen = client.get(f"/users/{public_id}", headers=headers).json()
    assert seen["photo"] is None


def test_runs_kept_private_are_not_counted(
    client: TestClient, database: Database, wall: WallClock
) -> None:
    headers = signed_up(client)
    mine = me(client, headers)
    with database.connect() as conn:
        conn.execute(
            "INSERT INTO runs (user_id, key, track, started_at, distance_m,"
            " duration_s, created_at) VALUES (%s, 'run12345', ST_GeomFromText("
            "'LINESTRING M (11.1214 46.0671 0,11.1344 46.0671 300)', 4326),"
            " %s, 1001, 299, %s)",
            (mine["id"], wall.t, wall.t),
        )
    seen = client.get(f"/users/{mine['public_id']}", headers=other(client)).json()
    assert seen["drawings"] == 0


@pytest.mark.parametrize(
    "asked",
    [
        "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13",  # nobody's
        "1",  # an internal id is not a profile id
        "Runner_42",  # nor a username
        "not-an-id",
    ],
)
def test_an_unknown_profile_is_404(client: TestClient, asked: str) -> None:
    headers = signed_up(client)
    answer = client.get(f"/users/{asked}", headers=headers)
    assert (answer.status_code, code(answer)) == (404, "http_error")
    assert message(answer) == NO_PROFILE


def test_the_id_of_a_profile_outlives_a_new_username_not_the_account(
    client: TestClient,
) -> None:
    headers = signed_up(client)
    public_id = me(client, headers)["public_id"]
    viewer = other(client)
    client.patch("/me", json={"username": "Renamed"}, headers=headers)
    seen = client.get(f"/users/{public_id}", headers=viewer)
    assert seen.json()["username"] == "Renamed"
    assert client.delete("/me", headers=headers).status_code == 204
    gone = client.get(f"/users/{public_id}", headers=viewer)
    assert (gone.status_code, code(gone)) == (404, "http_error")


# --- The accounts made before the profile ---


def test_accounts_made_before_the_profile_keep_working(
    database_url: str, tmp_path: Path, wall: WallClock
) -> None:
    database = Database(database_url)
    # The schema of before TASK-116 (0001-0006 when written), with two
    # accounts in it,
    # one with a picture.
    before = [path for path in migrations() if path.name < PROFILES.name]
    assert "0006_pen_up_walks.sql" in [path.name for path in before]
    for path in before:
        shutil.copy(path, tmp_path / path.name)
    database.migrate(tmp_path)
    # As the API of before wrote them: its code reads the columns of today.
    first = old_account(database, wall, 1, EMAIL, "Runner_42")
    second = old_account(database, wall, 2, OTHER_EMAIL, "other.runner")
    jpeg = square_jpeg(base64.b64decode(a_photo()))
    with database.connect() as conn:
        conn.execute(
            "INSERT INTO profile_photos (user_id, jpeg, updated_at)"
            " SELECT id, %s, %s FROM users WHERE email = %s",
            (jpeg, wall.t, EMAIL),
        )
        columns = {
            row["column_name"]
            for row in conn.execute(
                "SELECT column_name FROM information_schema.columns"
                " WHERE table_name = 'users'"
            )
        }
    assert "bio" not in columns and "public_id" not in columns

    # The API of TASK-116 starts: the profile's migration, and nothing else.
    assert database.migrate(MIGRATIONS_DIR) == [
        path.stem for path in migrations() if path.name >= PROFILES.name
    ]
    new = api(database, wall)
    # The sessions of before still open, and each account has its own id.
    mine, theirs = me(new, first), me(new, second)
    assert (mine["username"], mine["bio"]) == ("Runner_42", "")
    assert (theirs["username"], theirs["bio"]) == ("other.runner", "")
    assert UUID(mine["public_id"]) != UUID(theirs["public_id"])
    signed_in = new.post(
        "/session", json={"email": EMAIL, "password": "correct horse battery"}
    )
    assert signed_in.status_code == 200
    # A username with a dot, allowed since TASK-114, can be kept and set.
    edited = new.patch("/me", json={"bio": "Still here"}, headers=second)
    assert (edited.status_code, edited.json()["username"]) == (200, "other.runner")
    assert (
        new.patch("/me", json={"username": "a.b.c"}, headers=first).status_code == 200
    )
    seen = new.get(f"/users/{mine['public_id']}", headers=second).json()
    assert seen["username"] == "a.b.c"
    assert seen["photo"] == base64.b64encode(jpeg).decode("ascii")
