"""The teams of the shape game in a real PostgreSQL (TASK-296 part C,
ADR-0255, docs/GIOCO.md §6.1): a team is made with a checked name and a
code, joined with the code up to 20 members and 10 teams an account, never
across a block; anyone leaves and the owner removes; the team goes to the
oldest member when the owner leaves or deletes the account, and is deleted
without members. A block born between two members makes one leave."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from route_engine.network import FileSource
from test_game_api import rows
from test_push import FAST_HASHER, FakeExpo, signed_up

from shaperoute_api import game_teams
from shaperoute_api.accounts import Accounts
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.expo_push import Expo
from shaperoute_api.game_teams import (
    CANT_JOIN,
    CODE_PATTERN,
    MAX_MEMBERS,
    MAX_TEAMS,
    NAME_EMPTY,
    NAME_TOO_LONG,
    NO_TEAM_CODE,
    ONLY_OWNER,
    TOO_MANY_TEAMS,
    new_code,
)
from shaperoute_api.push import Pusher

NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def expo() -> FakeExpo:
    return FakeExpo()


@pytest.fixture
def client(database: Database, expo: FakeExpo) -> TestClient:
    accounts = Accounts(database, now=lambda: NOW, hasher=FAST_HASHER)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    app.state.pusher = Pusher(
        database, Expo(send=expo), run=lambda task: task(), later=lambda *_: None
    )
    return TestClient(app)


def public_id(client: TestClient, headers: dict[str, str]) -> str:
    return str(client.get("/me", headers=headers).json()["public_id"])


def team_of(
    client: TestClient, me: dict[str, str], name: str = "Sunday runners"
) -> Any:
    answer = client.post("/game/teams", json={"name": name}, headers=me)
    assert answer.status_code == 201, answer.text
    return answer.json()


def joined(client: TestClient, me: dict[str, str], code: str) -> Any:
    answer = client.post("/game/teams/join", json={"code": code}, headers=me)
    assert answer.status_code == 200, answer.text
    return answer.json()


def names_in(team: Any) -> list[str]:
    return [member["username"] for member in team["members"]]


def my_teams(client: TestClient, me: dict[str, str]) -> list[Any]:
    answer = client.get("/game/teams", headers=me)
    assert answer.status_code == 200, answer.text
    return list(answer.json()["teams"])


def test_the_creator_is_the_owner_and_the_only_member(client: TestClient) -> None:
    ada = signed_up(client, "ada")
    team = team_of(client, ada, "  Sunday   runners ")
    assert team["name"] == "Sunday runners"
    assert CODE_PATTERN.match(team["code"])
    assert team["owner"] == public_id(client, ada)
    assert names_in(team) == ["ada"]
    assert team["challenge"] is None
    assert my_teams(client, ada) == [team]
    # The others see the name and the picture, nothing else.
    assert set(team["members"][0]) == {"public_id", "username", "photo"}


def test_the_name_is_checked_like_a_comment(client: TestClient) -> None:
    ada = signed_up(client, "ada")
    for name, message in [("  ", NAME_EMPTY), ("x" * 41, NAME_TOO_LONG)]:
        answer = client.post("/game/teams", json={"name": name}, headers=ada)
        assert answer.status_code == 422, answer.text
        assert answer.json()["error"] == {
            "code": "invalid_request",
            "message": message,
            "suggested_distance_m": None,
            "reason": None,
        }
    answer = client.post("/game/teams", json={"name": "Run\x07club"}, headers=ada)
    assert answer.status_code == 422
    # The word filter of TASK-213, with the user's own words (ADR-0176).
    answer = client.post("/game/teams", json={"name": "You're an idiot"}, headers=ada)
    assert answer.status_code == 422, answer.text
    assert answer.json()["error"]["code"] == "comment_rejected"
    assert rows(client.app.state.accounts.database, "game_teams") == 0  # type: ignore[attr-defined]


def test_joining_with_the_code_in_any_case(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    team = team_of(client, ada)
    code = team["code"]
    typed = f" {code[:3].lower()} {code[3:]} "
    assert names_in(joined(client, bob, typed)) == ["ada", "bob"]
    # Joined again: still one row, the same team.
    assert names_in(joined(client, bob, code)) == ["ada", "bob"]
    assert names_in(my_teams(client, ada)[0]) == ["ada", "bob"]
    assert my_teams(client, bob)[0]["owner"] == public_id(client, ada)


def test_an_unknown_or_malformed_code_finds_no_team(client: TestClient) -> None:
    bob = signed_up(client, "bob")
    for code in ["ABCDEF", "abc", "ABCD01", "x" * 40]:
        answer = client.post("/game/teams/join", json={"code": code}, headers=bob)
        assert answer.status_code == 404, answer.text
        assert answer.json()["error"]["message"] == NO_TEAM_CODE


def test_a_full_team_refuses_without_saying_why(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Three members, not twenty: the API allows 30 POSTs a minute (access.py).
    monkeypatch.setattr(game_teams, "MAX_MEMBERS", 3)
    ada = signed_up(client, "ada")
    team = team_of(client, ada)
    for n in range(1, 3):
        joined(client, signed_up(client, f"runner{n}"), team["code"])
    late = signed_up(client, "late")
    answer = client.post("/game/teams/join", json={"code": team["code"]}, headers=late)
    assert answer.status_code == 403, answer.text
    assert answer.json()["error"]["message"] == CANT_JOIN
    assert len(my_teams(client, ada)[0]["members"]) == 3
    assert MAX_MEMBERS == 20


def test_an_account_is_in_ten_teams_at_most(client: TestClient) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    for n in range(MAX_TEAMS):
        team_of(client, ada, f"Team {n}")
    answer = client.post("/game/teams", json={"name": "One more"}, headers=ada)
    assert answer.status_code == 422, answer.text
    assert answer.json()["error"]["message"] == TOO_MANY_TEAMS
    other = team_of(client, bob)
    answer = client.post("/game/teams/join", json={"code": other["code"]}, headers=ada)
    assert answer.status_code == 403
    assert answer.json()["error"]["message"] == CANT_JOIN
    assert len(my_teams(client, ada)) == MAX_TEAMS


def test_a_block_either_way_keeps_one_out(client: TestClient) -> None:
    ada, bob, carol = (signed_up(client, n) for n in ("ada", "bob", "carol"))
    team = team_of(client, ada)
    assert (
        client.put(f"/users/{public_id(client, bob)}/block", headers=ada).status_code
        == 204
    )
    assert (
        client.put(f"/users/{public_id(client, ada)}/block", headers=carol).status_code
        == 204
    )
    for who in (bob, carol):
        answer = client.post(
            "/game/teams/join", json={"code": team["code"]}, headers=who
        )
        assert answer.status_code == 403, answer.text
        assert answer.json()["error"]["message"] == CANT_JOIN
    # Unblocked, in.
    client.delete(f"/users/{public_id(client, bob)}/block", headers=ada)
    assert names_in(joined(client, bob, team["code"])) == ["ada", "bob"]


def test_a_member_leaves_and_the_owner_removes(client: TestClient) -> None:
    ada, bob, carol = (signed_up(client, n) for n in ("ada", "bob", "carol"))
    team = team_of(client, ada)
    joined(client, bob, team["code"])
    joined(client, carol, team["code"])
    members = f"/game/teams/{team['id']}/members"
    # Bob leaves.
    assert (
        client.delete(f"{members}/{public_id(client, bob)}", headers=bob).status_code
        == 204
    )
    assert names_in(my_teams(client, ada)[0]) == ["ada", "carol"]
    assert my_teams(client, bob) == []
    # Carol is not the owner: she removes nobody but herself.
    answer = client.delete(f"{members}/{public_id(client, ada)}", headers=carol)
    assert answer.status_code == 422
    assert answer.json()["error"]["message"] == ONLY_OWNER
    # Bob is out: he sees no team, and the owner cannot remove him again.
    assert (
        client.delete(f"{members}/{public_id(client, ada)}", headers=bob).status_code
        == 404
    )
    assert (
        client.delete(f"{members}/{public_id(client, bob)}", headers=ada).status_code
        == 404
    )
    # The owner removes Carol.
    assert (
        client.delete(f"{members}/{public_id(client, carol)}", headers=ada).status_code
        == 204
    )
    assert names_in(my_teams(client, ada)[0]) == ["ada"]
    assert my_teams(client, carol) == []


def test_the_team_goes_to_the_oldest_member_when_the_owner_leaves(
    client: TestClient,
) -> None:
    ada, bob, carol = (signed_up(client, n) for n in ("ada", "bob", "carol"))
    team = team_of(client, ada)
    joined(client, bob, team["code"])
    joined(client, carol, team["code"])
    members = f"/game/teams/{team['id']}/members"
    assert (
        client.delete(f"{members}/{public_id(client, ada)}", headers=ada).status_code
        == 204
    )
    left = my_teams(client, carol)[0]
    assert left["owner"] == public_id(client, bob)
    assert names_in(left) == ["bob", "carol"]
    # Bob, the owner now, removes Carol.
    assert (
        client.delete(f"{members}/{public_id(client, carol)}", headers=bob).status_code
        == 204
    )


def test_a_team_without_members_is_deleted(
    client: TestClient, database: Database
) -> None:
    ada = signed_up(client, "ada")
    team = team_of(client, ada)
    members = f"/game/teams/{team['id']}/members"
    assert (
        client.delete(f"{members}/{public_id(client, ada)}", headers=ada).status_code
        == 204
    )
    assert rows(database, "game_teams") == rows(database, "game_team_members") == 0
    assert my_teams(client, ada) == []


def test_deleting_the_account_hands_its_teams_over(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    shared = team_of(client, ada, "Shared")
    joined(client, bob, shared["code"])
    team_of(client, ada, "Alone")
    assert client.delete("/me", headers=ada).status_code == 204
    teams = my_teams(client, bob)
    assert [t["name"] for t in teams] == ["Shared"]
    assert teams[0]["owner"] == public_id(client, bob)
    assert names_in(teams[0]) == ["bob"]
    assert rows(database, "game_teams") == rows(database, "game_team_members") == 1


def test_a_block_born_between_two_members_makes_one_leave(client: TestClient) -> None:
    ada, bob, carol = (signed_up(client, n) for n in ("ada", "bob", "carol"))
    team = team_of(client, ada)
    joined(client, bob, team["code"])
    joined(client, carol, team["code"])
    # Bob blocks the owner: Bob leaves.
    assert (
        client.put(f"/users/{public_id(client, ada)}/block", headers=bob).status_code
        == 204
    )
    assert names_in(my_teams(client, ada)[0]) == ["ada", "carol"]
    assert my_teams(client, bob) == []
    # The owner blocks Carol: Carol leaves, the owner stays.
    assert (
        client.put(f"/users/{public_id(client, carol)}/block", headers=ada).status_code
        == 204
    )
    assert names_in(my_teams(client, ada)[0]) == ["ada"]
    assert my_teams(client, carol) == []
    # Between two members, who blocks leaves.
    dave, erin = signed_up(client, "dave"), signed_up(client, "erin")
    other = team_of(client, dave, "Other")
    joined(client, ada, other["code"])
    joined(client, erin, other["code"])
    assert (
        client.put(f"/users/{public_id(client, erin)}/block", headers=ada).status_code
        == 204
    )
    assert names_in(my_teams(client, dave)[0]) == ["dave", "erin"]
    assert [t["name"] for t in my_teams(client, ada)] == ["Sunday runners"]


def test_the_teams_want_a_session(client: TestClient) -> None:
    assert client.post("/game/teams", json={"name": "x"}).status_code == 401
    assert client.post("/game/teams/join", json={"code": "ABCDEF"}).status_code == 401
    assert client.get("/game/teams").status_code == 401


def test_a_code_already_taken_is_drawn_again(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    draws = iter(["ABCDEF", "ABCDEF", "GHJKLM"])
    monkeypatch.setattr(game_teams, "new_code", lambda: next(draws))
    ada = signed_up(client, "ada")
    assert team_of(client, ada, "First")["code"] == "ABCDEF"
    assert team_of(client, ada, "Second")["code"] == "GHJKLM"


def test_a_code_is_six_of_the_alphabet_without_the_look_alikes() -> None:
    codes = {new_code() for _ in range(500)}
    assert all(CODE_PATTERN.match(code) for code in codes)
    assert not any(re.search("[IO01]", code) for code in codes)
    assert len(codes) > 490


def test_a_block_is_kept_when_a_hook_of_it_fails(
    client: TestClient, database: Database
) -> None:
    ada, bob = signed_up(client, "ada"), signed_up(client, "bob")
    team = team_of(client, ada)
    joined(client, bob, team["code"])

    def broken(conn: Any, blocker_id: int, blocked_id: int) -> None:
        conn.execute("SELECT 1 FROM no_such_table")

    client.app.state.on_block.insert(0, broken)  # type: ignore[attr-defined]
    answer = client.put(f"/users/{public_id(client, bob)}/block", headers=ada)
    assert answer.status_code == 204, answer.text
    assert rows(database, "blocks") == 1
    # The other hooks still ran: Bob is out of Ada's team.
    assert names_in(my_teams(client, ada)[0]) == ["ada"]
