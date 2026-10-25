"""The emails of an account (TASK-300, ADR-0261): the signed links, the
words in five languages, and in a real PostgreSQL the link that confirms
the address of a new account, the change of address that waits for its
link, the notice to the old address, the new password chosen from a link,
the limits, the accounts of before and the pages a browser opens without
the API key. Resend is a fake network, and the emails go out at once."""

from __future__ import annotations

import json
import logging
import re
import shutil
import string
import threading
from datetime import timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from test_drawings import (
    WallClock,
    _load,
    api,
    client,  # noqa: F401  (the fixtures of the drawings' tests)
    database,  # noqa: F401
    old_account,
    public_id,
    signed_up,
    wall,  # noqa: F401
)

from shaperoute_api.access import OPEN_PATHS, RateLimiter
from shaperoute_api.account_email import (
    CONFIRM_FOR,
    CONFIRM_PATH,
    HOUR_S,
    LINK_HEADERS,
    RESET_FOR,
    RESET_PATH,
    AccountEmails,
    AccountLinks,
    Outbox,
    Token,
    confirm_state,
    install_account_email,
    read_token,
    reset_state,
)
from shaperoute_api.account_email_texts import (
    PASSWORD_FIELD,
    REPEAT_FIELD,
    WORDS,
    Words,
    confirm_email,
    masked,
    notice_email,
    password_problem,
    reset_email,
)
from shaperoute_api.accounts import MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH
from shaperoute_api.away_email import SENDER
from shaperoute_api.db import Database, migrations
from shaperoute_api.resend_email import Resend
from shaperoute_api.strava_client import Call, Reply

SECRET = b"s" * 32
BASE = "https://api.example.app"
EMAIL = "runner@example.com"
NEW_EMAIL = "runner.new@example.com"
OTHER_EMAIL = "other@example.com"
PASSWORD = "correct horse battery"
NEW_PASSWORD = "a brand new password"
MINUTE = timedelta(minutes=1)
LINK = re.compile(re.escape(BASE) + r"(/[a-z/]+)\?t=([0-9a-f.]+)")
(MIGRATION,) = [p for p in migrations() if p.name.endswith("_email_confirmation.sql")]


# --- The links ---

LINKS = AccountLinks(SECRET, BASE)
ID = UUID("8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13")


def test_a_token_holds_for_its_state_only(wall: WallClock) -> None:  # noqa: F811
    expires = wall.t + CONFIRM_FOR
    made = LINKS.token("confirm", ID, expires, confirm_state(EMAIL))
    token = read_token(made)
    assert token == Token(ID, int(expires.timestamp()), made.split(".")[2])
    assert LINKS.holds("confirm", token, confirm_state(EMAIL))
    # Another address, another use, another account, another secret.
    assert not LINKS.holds("confirm", token, confirm_state(NEW_EMAIL))
    assert not LINKS.holds("reset", token, confirm_state(EMAIL))
    moved = Token(uuid4(), token.expires_s, token.tag)
    assert not LINKS.holds("confirm", moved, confirm_state(EMAIL))
    assert not AccountLinks(b"t" * 32, BASE).holds(
        "confirm", token, confirm_state(EMAIL)
    )
    # A later expiry written by hand breaks the tag.
    later = Token(ID, token.expires_s + 3600, token.tag)
    assert not LINKS.holds("confirm", later, confirm_state(EMAIL))
    # The password's hash is part of a new password's link.
    reset = read_token(LINKS.token("reset", ID, expires, reset_state(EMAIL, "h1")))
    assert reset is not None
    assert LINKS.holds("reset", reset, reset_state(EMAIL, "h1"))
    assert not LINKS.holds("reset", reset, reset_state(EMAIL, "h2"))
    assert LINKS.url("reset", ID, expires, b"").startswith(f"{BASE}{RESET_PATH}?t=")


@pytest.mark.parametrize(
    "text",
    [
        "",
        "nope",
        f"{ID.hex}.123",
        f"{ID.hex}.123.{'a' * 32}.x",
        f"{ID.hex}.12a.{'a' * 32}",
        f"{ID.hex}.123.{'a' * 31}",
        f"{ID.hex}.123.{'A' * 32}",
        f"{ID.hex.upper()}.123.{'a' * 32}",
        f"{'z' * 32}.123.{'a' * 32}",
        f"{ID.hex}.{'9' * 13}.{'a' * 32}",
    ],
)
def test_what_is_not_a_token(text: str) -> None:
    assert read_token(text) is None


# --- The words ---


def marks(text: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(text) if name}


def test_every_language_has_every_sentence_with_the_same_marks() -> None:
    assert set(WORDS) == {"en", "it", "de", "es", "fr"}
    for name in Words.__dataclass_fields__:
        english = getattr(WORDS["en"], name)
        for language, words in WORDS.items():
            sentence = getattr(words, name)
            assert sentence.strip(), (language, name)
            assert marks(sentence) == marks(english), (language, name)


def test_the_new_address_is_covered_in_the_notice() -> None:
    assert masked(NEW_EMAIL) == "r•••@example.com"
    notice = notice_email("en", "Runner_42", NEW_EMAIL)
    assert "r•••@example.com" in notice.text
    assert NEW_EMAIL not in notice.text + notice.html
    assert notice.subject == WORDS["en"].notice_subject
    assert "Forgot password?" in notice.text


def test_the_emails_carry_their_link() -> None:
    url = f"{BASE}{CONFIRM_PATH}?t=x"
    joined = confirm_email("it", "a<b", url, changing=False)
    assert joined.subject == WORDS["it"].confirm_subject
    assert f"{WORDS['it'].confirm_button}: {url}" in joined.text
    assert f'href="{url}"' in joined.html
    assert "a&lt;b" in joined.html
    changed = confirm_email("de", "ada", url, changing=True)
    assert changed.subject == WORDS["de"].change_subject
    reset = reset_email("fr", "ada", url)
    assert reset.subject == WORDS["fr"].reset_subject
    assert WORDS["fr"].reset_note in reset.text


def test_the_rules_of_a_new_password() -> None:
    short = "x" * (MIN_PASSWORD_LENGTH - 1)
    assert password_problem("en", short, short) == WORDS["en"].too_short.format(
        min=MIN_PASSWORD_LENGTH
    )
    long = "x" * (MAX_PASSWORD_LENGTH + 1)
    assert password_problem("it", long, long) == WORDS["it"].too_long.format(
        max=MAX_PASSWORD_LENGTH
    )
    assert password_problem("es", NEW_PASSWORD, PASSWORD) == WORDS["es"].not_same
    assert password_problem("en", NEW_PASSWORD, NEW_PASSWORD) is None


def test_the_pages_are_open() -> None:
    assert {CONFIRM_PATH, RESET_PATH} <= OPEN_PATHS


def test_the_outbox_sends_in_order_after_a_failure() -> None:
    done: list[int] = []
    finished = threading.Event()

    def fails() -> None:
        raise RuntimeError("Resend is down")

    outbox = Outbox(sleep=lambda _: None)
    outbox(lambda: done.append(1))
    outbox(fails)
    outbox(lambda: done.append(2))
    outbox(finished.set)
    assert finished.wait(5)
    assert done == [1, 2]


# --- In the database ---


class Network:
    """Resend's network: the emails it took, as JSON."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, call: Call) -> Reply:
        assert call.body is not None
        self.sent.append(json.loads(call.body))
        return Reply(200, {}, b'{"id": "e"}')

    def to(self, address: str) -> list[dict[str, Any]]:
        return [email for email in self.sent if email["to"] == [address]]


@pytest.fixture
def network() -> Network:
    return Network()


def account_emails(
    app: TestClient, clock: WallClock, network: Network
) -> AccountEmails:
    """The emails of `app`'s accounts, sent at once, on the test's clock."""
    accounts = app.app.state.accounts  # type: ignore[attr-defined]
    return AccountEmails(
        accounts,
        Resend("re_key", SENDER, send=network),
        LINKS,
        later=lambda job: job(),
        now=clock,
        clock=lambda: clock.t.timestamp(),
    )


@pytest.fixture
def emails(
    client: TestClient, wall: WallClock, network: Network  # noqa: F811
) -> AccountEmails:
    made = account_emails(client, wall, network)
    install_account_email(client.app, made)  # type: ignore[arg-type]
    return made


@pytest.fixture
def mail(client: TestClient, emails: AccountEmails) -> TestClient:  # noqa: F811
    """The API with the emails on."""
    return client


def link_of(email: dict[str, Any]) -> tuple[str, str]:
    """The path and the token of the link of an email."""
    found = LINK.search(email["text"])
    assert found is not None
    assert f'href="{found.group(0)}"' in email["html"]
    return found.group(1), found.group(2)


def me(app: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    answer = app.get("/me", headers=headers)
    assert answer.status_code == 200
    body: dict[str, Any] = answer.json()
    return body


def sign_in(app: TestClient, email: str, password: str = PASSWORD) -> int:
    return app.post("/session", json={"email": email, "password": password}).status_code


def code(answer: Any) -> str:
    return str(answer.json()["error"]["code"])


def test_signing_up_sends_the_link_and_the_account_works(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail, language="it")
    (sent,) = network.sent
    assert sent["to"] == [EMAIL]
    assert sent["from"] == SENDER
    assert sent["subject"] == WORDS["it"].confirm_subject
    assert link_of(sent)[0] == CONFIRM_PATH
    account = me(mail, mine)
    assert account["email_confirmed"] is False
    assert account["pending_email"] is None
    assert mail.get("/account-email", headers=mine).json() == {"on": True}


def test_the_link_asks_first_and_only_the_button_confirms(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail, language="de")
    path, token = link_of(network.sent[0])
    asked = mail.get(path, params={"t": token})
    assert asked.status_code == 200
    for header, value in LINK_HEADERS.items():
        assert asked.headers[header] == value
    assert WORDS["de"].confirm_ask.format(email=EMAIL) in asked.text
    assert 'method="post"' in asked.text
    assert me(mail, mine)["email_confirmed"] is False
    done = mail.post(path, params={"t": token})
    assert done.status_code == 200
    assert WORDS["de"].confirmed.format(email=EMAIL) in done.text
    assert me(mail, mine)["email_confirmed"] is True
    # Used once: it says so, and changes nothing more.
    again = mail.get(path, params={"t": token})
    assert again.status_code == 200
    assert 'method="post"' not in again.text
    assert mail.post(path, params={"t": token}).status_code == 200
    assert me(mail, mine)["email_confirmed"] is True


def test_a_wrong_link_confirms_nothing(
    mail: TestClient, network: Network, wall: WallClock  # noqa: F811
) -> None:
    mine = signed_up(mail, language="it")
    theirs = signed_up(mail, email=OTHER_EMAIL, username="other_runner")
    path, token = link_of(network.to(EMAIL)[0])
    head, expires, tag = token.split(".")
    their_id = UUID(public_id(mail, theirs)).hex
    for wrong in [
        f"{head}.{expires}.{'0' * 32}",
        f"{head}.{int(expires) + 60}.{tag}",
        f"{their_id}.{expires}.{tag}",
        "nope",
        "",
    ]:
        for method in (mail.get, mail.post):
            answer = method(path, params={"t": wrong})
            assert answer.status_code == 404, wrong
    # The page of a link of ours that does not work speaks its account's
    # language; one that is not a link at all, English.
    assert (
        WORDS["it"].wrong_link
        in mail.get(path, params={"t": f"{head}.{expires}.{'0' * 32}"}).text
    )
    assert WORDS["en"].wrong_link in mail.get(path, params={"t": "nope"}).text
    wall.t += CONFIRM_FOR + MINUTE
    assert mail.post(path, params={"t": token}).status_code == 404
    assert me(mail, mine)["email_confirmed"] is False
    assert me(mail, theirs)["email_confirmed"] is False


def change(app: TestClient, headers: dict[str, str], email: str = NEW_EMAIL) -> Any:
    return app.put(
        "/me/email", json={"email": email, "password": PASSWORD}, headers=headers
    )


def test_a_new_address_waits_for_its_link(mail: TestClient, network: Network) -> None:
    mine = signed_up(mail)
    network.sent.clear()
    answer = change(mail, mine)
    assert answer.status_code == 200
    assert answer.json()["email"] == EMAIL
    assert answer.json()["pending_email"] == NEW_EMAIL
    (confirm,) = network.to(NEW_EMAIL)
    assert confirm["subject"] == WORDS["en"].change_subject
    (notice,) = network.to(EMAIL)
    assert notice["subject"] == WORDS["en"].notice_subject
    assert NEW_EMAIL not in notice["text"] + notice["html"]
    assert LINK.search(notice["text"]) is None
    # The old address until the link is opened.
    assert sign_in(mail, NEW_EMAIL) == 401
    assert sign_in(mail, EMAIL) == 200
    path, token = link_of(confirm)
    page = mail.get(path, params={"t": token})
    assert WORDS["en"].confirm_ask.format(email=NEW_EMAIL) in page.text
    assert mail.post(path, params={"t": token}).status_code == 200
    account = me(mail, mine)
    assert account["email"] == NEW_EMAIL
    assert account["email_confirmed"] is True
    assert account["pending_email"] is None
    assert sign_in(mail, NEW_EMAIL) == 200
    assert sign_in(mail, EMAIL) == 401


def test_the_link_of_an_address_left_works_no_more(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail)
    first = link_of(network.to(EMAIL)[0])
    assert change(mail, mine).status_code == 200
    path, token = link_of(network.to(NEW_EMAIL)[0])
    assert mail.post(path, params={"t": token}).status_code == 200
    assert mail.post(first[0], params={"t": first[1]}).status_code == 404
    assert me(mail, mine)["email"] == NEW_EMAIL


def test_another_change_replaces_the_one_waiting_and_cancel_drops_it(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail)
    assert change(mail, mine).status_code == 200
    replaced = link_of(network.to(NEW_EMAIL)[0])
    assert change(mail, mine, "third@example.com").json()["pending_email"] == (
        "third@example.com"
    )
    assert mail.post(replaced[0], params={"t": replaced[1]}).status_code == 404
    third = link_of(network.to("third@example.com")[0])
    dropped = mail.delete("/me/email/pending", headers=mine)
    assert dropped.status_code == 200
    assert dropped.json()["pending_email"] is None
    assert mail.post(third[0], params={"t": third[1]}).status_code == 404
    assert me(mail, mine)["email"] == EMAIL
    # Asking for the address of now drops what waits, and sends nothing.
    assert change(mail, mine).status_code == 200
    sent = len(network.sent)
    assert change(mail, mine, EMAIL).json()["pending_email"] is None
    assert len(network.sent) == sent


def test_an_address_taken_in_between_changes_nothing(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail)
    assert change(mail, mine).status_code == 200
    path, token = link_of(network.to(NEW_EMAIL)[0])
    signed_up(mail, email=NEW_EMAIL, username="quicker")
    taken = mail.post(path, params={"t": token})
    assert taken.status_code == 409
    assert WORDS["en"].taken in taken.text
    assert me(mail, mine)["email"] == EMAIL


def test_the_address_of_another_account_is_refused_at_once(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail)
    signed_up(mail, email=OTHER_EMAIL, username="other_runner")
    network.sent.clear()
    answer = change(mail, mine, OTHER_EMAIL)
    assert answer.status_code == 409
    assert code(answer) == "email_taken"
    assert network.sent == []
    wrong = mail.put(
        "/me/email", json={"email": NEW_EMAIL, "password": "wrong!"}, headers=mine
    )
    assert wrong.status_code == 403
    assert network.sent == []


def test_without_emails_a_change_holds_at_once_not_confirmed(
    client: TestClient, database: Database  # noqa: F811
) -> None:
    mine = signed_up(client)
    with database.connect() as conn:
        conn.execute("UPDATE users SET email_confirmed = true")
    assert me(client, mine)["email_confirmed"] is True
    answer = change(client, mine)
    assert answer.status_code == 200
    assert answer.json()["email"] == NEW_EMAIL
    assert answer.json()["email_confirmed"] is False
    assert answer.json()["pending_email"] is None
    # None of the paths of the emails is there.
    assert client.get("/account-email", headers=mine).status_code == 404
    assert client.post("/password-reset", json={"email": EMAIL}).status_code == 404
    assert client.get(CONFIRM_PATH, params={"t": "x"}).status_code == 404
    assert client.get(RESET_PATH, params={"t": "x"}).status_code == 404


def test_the_link_again_with_a_limit(
    mail: TestClient, network: Network, wall: WallClock  # noqa: F811
) -> None:
    mine = signed_up(mail)
    network.sent.clear()
    for _ in range(3):
        assert mail.post("/me/email/confirmation", headers=mine).status_code == 202
    assert len(network.to(EMAIL)) == 3
    refused = mail.post("/me/email/confirmation", headers=mine)
    assert refused.status_code == 429
    assert code(refused) == "too_many_requests"
    assert int(refused.headers["Retry-After"]) > 0
    # A change counts too.
    assert change(mail, mine).status_code == 429
    assert me(mail, mine)["pending_email"] is None
    wall.t += timedelta(seconds=HOUR_S) + MINUTE
    assert change(mail, mine).status_code == 200
    # With an address waiting, the link goes there.
    network.sent.clear()
    assert mail.post("/me/email/confirmation", headers=mine).status_code == 202
    assert [email["to"] for email in network.sent] == [[NEW_EMAIL]]
    path, token = link_of(network.sent[0])
    assert mail.post(path, params={"t": token}).status_code == 200
    # Nothing left to confirm: nothing sent.
    network.sent.clear()
    assert mail.post("/me/email/confirmation", headers=mine).status_code == 204
    assert network.sent == []


def test_a_new_password_is_asked_for_the_same_way_whoever_has_the_address(
    mail: TestClient, network: Network
) -> None:
    signed_up(mail)
    network.sent.clear()
    member = mail.post("/password-reset", json={"email": " Runner@Example.com "})
    nobody = mail.post("/password-reset", json={"email": "nobody@example.com"})
    assert member.status_code == nobody.status_code == 202
    assert member.content == nobody.content == b""
    assert [email["to"] for email in network.sent] == [[EMAIL]]
    assert link_of(network.sent[0])[0] == RESET_PATH
    for _ in range(2):
        mail.post("/password-reset", json={"email": EMAIL})
        mail.post("/password-reset", json={"email": "nobody@example.com"})
    # The fourth in an hour, for either.
    for address in (EMAIL, "nobody@example.com"):
        refused = mail.post("/password-reset", json={"email": address})
        assert refused.status_code == 429
        assert code(refused) == "too_many_requests"
    assert len(network.sent) == 3


def test_the_example_is_the_body() -> None:
    from shaperoute_api.account_email import PasswordResetRequestBody

    request = _load("password-reset-request.json")
    assert set(request) == set(PasswordResetRequestBody.model_fields)
    PasswordResetRequestBody.model_validate(request)


def test_the_language_of_a_new_password(mail: TestClient, network: Network) -> None:
    signed_up(mail, language="it")
    network.sent.clear()
    mail.post("/password-reset", json={"email": EMAIL, "language": "fr"})
    mail.post("/password-reset", json={"email": EMAIL})
    assert [email["subject"] for email in network.sent] == [
        WORDS["fr"].reset_subject,
        WORDS["it"].reset_subject,
    ]


def ask_reset(app: TestClient, network: Network) -> tuple[str, str]:
    network.sent.clear()
    assert app.post("/password-reset", json={"email": EMAIL}).status_code == 202
    (sent,) = network.sent
    return link_of(sent)


def test_a_new_password_from_the_link(mail: TestClient, network: Network) -> None:
    mine = signed_up(mail, language="es")
    other_phone = {
        "Authorization": "Bearer "
        + mail.post("/session", json={"email": EMAIL, "password": PASSWORD}).json()[
            "token"
        ]
    }
    assert change(mail, mine).status_code == 200
    path, token = ask_reset(mail, network)
    form = mail.get(path, params={"t": token})
    assert form.status_code == 200
    assert form.headers["x-frame-options"] == "DENY"
    words = WORDS["es"]
    assert words.reset_title.format(username="Runner_42") in form.text
    assert f'name="{PASSWORD_FIELD}"' in form.text
    assert 'autocomplete="new-password"' in form.text

    def post(password: str, repeat: str) -> Any:
        return mail.post(
            path,
            params={"t": token},
            data={PASSWORD_FIELD: password, REPEAT_FIELD: repeat},
        )

    short = post("short", "short")
    assert short.status_code == 422
    assert words.too_short.format(min=MIN_PASSWORD_LENGTH) in short.text
    assert "short" not in short.text.replace(words.too_short, "")
    different = post(NEW_PASSWORD, PASSWORD)
    assert different.status_code == 422
    assert words.not_same in different.text
    huge = mail.post(path, params={"t": token}, content=b"password=" + b"x" * 20000)
    assert huge.status_code == 422
    assert sign_in(mail, EMAIL) == 200
    done = post(NEW_PASSWORD, NEW_PASSWORD)
    assert done.status_code == 200
    assert words.reset_done in done.text
    # Every phone signed out; the old password no more, the new one yes.
    for phone in (mine, other_phone):
        assert mail.get("/me", headers=phone).status_code == 401
    assert sign_in(mail, EMAIL) == 401
    assert sign_in(mail, EMAIL, NEW_PASSWORD) == 200
    again = {
        "Authorization": "Bearer "
        + mail.post("/session", json={"email": EMAIL, "password": NEW_PASSWORD}).json()[
            "token"
        ]
    }
    account = me(mail, again)
    assert account["email_confirmed"] is True
    assert account["pending_email"] is None
    # Once: the same link works no more.
    assert mail.get(path, params={"t": token}).status_code == 404
    assert post("yet another one", "yet another one").status_code == 404
    assert sign_in(mail, EMAIL, NEW_PASSWORD) == 200


def test_a_new_password_clears_the_wrong_tries(
    mail: TestClient, network: Network
) -> None:
    signed_up(mail)
    for _ in range(5):
        assert sign_in(mail, EMAIL, "wrong!") == 401
    assert sign_in(mail, EMAIL) == 429
    path, token = ask_reset(mail, network)
    mail.post(
        path,
        params={"t": token},
        data={PASSWORD_FIELD: NEW_PASSWORD, REPEAT_FIELD: NEW_PASSWORD},
    )
    assert sign_in(mail, EMAIL, NEW_PASSWORD) == 200


def test_the_link_of_a_new_password_lasts_an_hour(
    mail: TestClient, network: Network, wall: WallClock  # noqa: F811
) -> None:
    signed_up(mail)
    path, token = ask_reset(mail, network)
    wall.t += RESET_FOR - MINUTE
    assert mail.get(path, params={"t": token}).status_code == 200
    wall.t += 2 * MINUTE
    assert mail.get(path, params={"t": token}).status_code == 404
    answer = mail.post(
        path,
        params={"t": token},
        data={PASSWORD_FIELD: NEW_PASSWORD, REPEAT_FIELD: NEW_PASSWORD},
    )
    assert answer.status_code == 404
    assert sign_in(mail, EMAIL) == 200


def test_a_change_of_address_kills_the_link_of_a_new_password(
    mail: TestClient, network: Network
) -> None:
    mine = signed_up(mail)
    path, token = ask_reset(mail, network)
    assert change(mail, mine).status_code == 200
    confirm = link_of(network.to(NEW_EMAIL)[0])
    assert mail.post(confirm[0], params={"t": confirm[1]}).status_code == 200
    assert mail.get(path, params={"t": token}).status_code == 404


def test_the_pages_need_no_api_key(
    monkeypatch: pytest.MonkeyPatch,
    client: TestClient,  # noqa: F811
    database: Database,  # noqa: F811
    wall: WallClock,  # noqa: F811
    network: Network,
) -> None:
    install_account_email(
        client.app, account_emails(client, wall, network)  # type: ignore[arg-type]
    )
    mine = signed_up(client)
    path, token = link_of(network.sent[0])
    monkeypatch.setenv("SHAPEROUTE_API_KEY", "k" * 32)
    keyed = api(database, wall)
    install_account_email(
        keyed.app, account_emails(keyed, wall, network)  # type: ignore[arg-type]
    )
    assert keyed.get("/account-email", headers=mine).status_code == 401
    assert keyed.post("/password-reset", json={"email": EMAIL}).status_code == 401
    # A browser has no key, and still has the page and its button.
    assert keyed.get(path, params={"t": token}).status_code == 200
    assert keyed.post(path, params={"t": token}).status_code == 200
    assert me(client, mine)["email_confirmed"] is True


def test_the_accounts_of_before_are_not_confirmed(
    database_url: str, tmp_path: Path, wall: WallClock, network: Network  # noqa: F811
) -> None:
    before = Database(database_url)
    for path in migrations():
        if path.name < MIGRATION.name:
            shutil.copy(path, tmp_path / path.name)
    before.migrate(tmp_path)
    phone = old_account(before, wall)
    before.migrate()
    app = api(before, wall)
    install_account_email(app.app, account_emails(app, wall, network))  # type: ignore[arg-type]
    account = me(app, phone)
    assert account["email_confirmed"] is False
    assert account["pending_email"] is None
    assert network.sent == []
    # Their link, when they ask for it.
    assert app.post("/me/email/confirmation", headers=phone).status_code == 202
    path, token = link_of(network.sent[0])
    assert app.post(path, params={"t": token}).status_code == 200
    assert me(app, phone)["email_confirmed"] is True


def test_at_most_so_many_emails_an_hour_in_all(
    mail: TestClient,
    network: Network,
    emails: AccountEmails,
    wall: WallClock,  # noqa: F811
    caplog: pytest.LogCaptureFixture,
) -> None:
    emails.all = RateLimiter(1, HOUR_S, lambda: wall.t.timestamp())
    mine = signed_up(mail)
    with caplog.at_level(logging.WARNING):
        assert mail.post("/me/email/confirmation", headers=mine).status_code == 202
    assert len(network.sent) == 1
    assert "not sent" in caplog.text


def test_nothing_personal_in_the_logs(
    mail: TestClient, network: Network, caplog: pytest.LogCaptureFixture
) -> None:
    # The API's own records: the server's access log has no query strings
    # (access_log.py), and the test client's own lines are not the API's.
    with caplog.at_level(logging.DEBUG, logger="shaperoute_api"):
        mine = signed_up(mail)
        change(mail, mine)
        mail.post("/password-reset", json={"email": EMAIL})
        links = [link_of(email) for email in network.sent if LINK.search(email["text"])]
        for path, token in links:
            mail.get(path, params={"t": token})
    assert len(links) == 3
    logged = " ".join(
        record.getMessage()
        for record in caplog.records
        if record.name.startswith("shaperoute_api")
    )
    for secret in [EMAIL, NEW_EMAIL, PASSWORD, "re_key", *(t for _, t in links)]:
        assert secret not in logged
