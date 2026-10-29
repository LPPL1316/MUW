"""Signing in and up with Apple and Google (TASK-322, ADR-0282): the
id_tokens read with keys made here, the accounts they open, link or make,
and Apple's revocation in DELETE /me. No network: Apple's and Google's
answers are made here too, and the clocks are the tests'."""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.parse
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, get_args

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm
from route_engine.network import FileSource
from test_accounts import FAST_HASHER, PASSWORD, bearer, code, rows, sign_up

from shaperoute_api.accounts import AccountError, Accounts, FailedSignIns, SessionBody
from shaperoute_api.app import create_app
from shaperoute_api.db import Database
from shaperoute_api.schemas import ErrorCode
from shaperoute_api.sign_in_providers import (
    APPLE_BUNDLE_ID,
    APPLE_ISSUER,
    APPLE_KEY_ID_VARIABLE,
    APPLE_KEY_VARIABLE,
    APPLE_KEYS_URL,
    APPLE_REVOKE_URL,
    APPLE_TEAM_VARIABLE,
    APPLE_TOKEN_URL,
    CLIENT_SECRET_S,
    DEFAULT_KEYS_S,
    GOOGLE_CLIENTS_VARIABLE,
    GOOGLE_KEYS_URL,
    LEEWAY_S,
    MAX_KEYS_S,
    MIN_KEYS_S,
    REFETCH_S,
    AppleSetup,
    GoogleSetup,
    NewAccountBody,
    ProviderSignInRequestBody,
    SignInProviders,
    SignInProvidersBody,
    keys_lifetime_s,
)
from shaperoute_api.strava_client import Call, Reply

REPO = Path(__file__).resolve().parents[3]
FIXTURES = REPO / "packages" / "shared-types" / "fixtures"

NOW = datetime(2026, 10, 29, 9, 0, tzinfo=UTC)
NOW_S = int(NOW.timestamp())
# Keys made once: RSA for the providers' tokens, P-256 for Apple's .p8.
PROVIDER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
APPLE_P8 = (
    ec.generate_private_key(ec.SECP256R1())
    .private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    .decode()
)
KID = "test-key-1"
TEAM_ID = "TEAM123456"
KEY_ID = "KEY1234567"
GOOGLE_IOS = "ios-client.apps.googleusercontent.com"
GOOGLE_WEB = "web-client.apps.googleusercontent.com"
GOOGLE_ISSUER = "https://accounts.google.com"
NONCE = "a-nonce-the-app-made"
EMAIL = "runner@example.com"
RELAY = "abc123@privaterelay.appleid.com"
CODE = "apple-code-1"
REFRESH = "apple-refresh-1"
# A claim left out of a token.
LEFT_OUT = object()


def _load(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def jwks(*keys: tuple[str, rsa.RSAPrivateKey]) -> bytes:
    found = []
    for kid, key in keys:
        public = json.loads(RSAAlgorithm.to_jwk(key.public_key()))
        found.append({**public, "kid": kid, "alg": "RS256", "use": "sig"})
    return json.dumps({"keys": found}).encode()


def keys_reply(*keys: tuple[str, rsa.RSAPrivateKey], max_age: int = 3600) -> Reply:
    headers = {"cache-control": f"public, max-age={max_age}"}
    return Reply(200, headers, jwks(*keys))


def id_token(
    provider: str = "apple",
    key: rsa.RSAPrivateKey = PROVIDER_KEY,
    kid: str = KID,
    **changes: Any,
) -> str:
    """A token as the provider signs it, with `changes` to its claims."""
    claims: dict[str, Any] = {
        "sub": f"{provider}-subject-1",
        "iat": NOW_S - 5,
        "exp": NOW_S + 600,
        "email": EMAIL,
    }
    if provider == "apple":
        claims |= {
            "iss": APPLE_ISSUER,
            "aud": APPLE_BUNDLE_ID,
            # Apple says it as a string, and carries the nonce's SHA-256.
            "email_verified": "true",
            "nonce": hashlib.sha256(NONCE.encode()).hexdigest(),
        }
    else:
        claims |= {
            "iss": GOOGLE_ISSUER,
            "aud": GOOGLE_IOS,
            "email_verified": True,
            "name": "Ada Runner",
            "picture": "https://example.com/ada.jpg",
        }
    claims |= changes
    claims = {name: value for name, value in claims.items() if value is not LEFT_OUT}
    return jwt.encode(claims, key, algorithm="RS256", headers={"kid": kid})


class Network:
    """Apple's and Google's answers, by address; the calls made."""

    def __init__(self) -> None:
        self.calls: list[Call] = []
        self.replies: dict[str, Reply | Exception] = {
            APPLE_KEYS_URL: keys_reply((KID, PROVIDER_KEY)),
            GOOGLE_KEYS_URL: keys_reply((KID, PROVIDER_KEY)),
            APPLE_TOKEN_URL: Reply(
                200, {}, json.dumps({"refresh_token": REFRESH}).encode()
            ),
            APPLE_REVOKE_URL: Reply(200, {}, b""),
        }

    def __call__(self, call: Call) -> Reply:
        self.calls.append(call)
        answer = self.replies[call.url]
        if isinstance(answer, Exception):
            raise answer
        return answer

    def to(self, url: str) -> list[Call]:
        return [call for call in self.calls if call.url == url]


class Ticks:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


class Wall:
    def __init__(self) -> None:
        self.t = NOW

    def __call__(self) -> datetime:
        return self.t


def form(call: Call) -> dict[str, str]:
    assert call.body is not None
    return dict(urllib.parse.parse_qsl(call.body.decode()))


@pytest.fixture
def network() -> Network:
    return Network()


@pytest.fixture
def ticks() -> Ticks:
    return Ticks()


@pytest.fixture
def wall() -> Wall:
    return Wall()


@pytest.fixture
def providers(network: Network, wall: Wall, ticks: Ticks) -> SignInProviders:
    return SignInProviders(
        AppleSetup(TEAM_ID, KEY_ID, APPLE_P8),
        GoogleSetup((GOOGLE_IOS, GOOGLE_WEB)),
        send=network,
        now=wall,
        clock=ticks,
    )


def body(provider: str = "apple", **changes: Any) -> dict[str, Any]:
    sent: dict[str, Any] = {"id_token": id_token(provider)}
    if provider == "apple":
        sent |= {"authorization_code": CODE, "nonce": NONCE}
    return sent | changes


NEW = {"username": "Runner_42", "at_least_16": True, "language": "it"}


# --- The contract ---


def test_the_fixtures_are_the_contract() -> None:
    request = _load("provider-sign-in-request.json")
    assert set(request) == set(ProviderSignInRequestBody.model_fields)
    ProviderSignInRequestBody.model_validate(request)
    SignInProvidersBody.model_validate(_load("sign-in-providers.json"))
    new_account = _load("new-account-error.json")
    assert NewAccountBody.model_validate(new_account).model_dump() == new_account
    codes = _load("api-error-codes.json")
    assert {"new_account", "provider_unavailable"} <= set(codes)
    assert {"new_account", "provider_unavailable"} <= set(get_args(ErrorCode))


# --- The tokens, without a database ---


def test_an_apple_token_gives_its_identity(providers: SignInProviders) -> None:
    identity = providers.identity("apple", id_token("apple"), NONCE)
    assert (identity.provider, identity.subject, identity.email) == (
        "apple",
        "apple-subject-1",
        EMAIL,
    )


def test_a_google_token_of_either_client_gives_its_identity(
    providers: SignInProviders,
) -> None:
    for client in (GOOGLE_IOS, GOOGLE_WEB):
        token = id_token("google", aud=client, email="Ada@Example.com ")
        identity = providers.identity("google", token, None)
        # In lower case, as POST /accounts keeps it.
        assert (identity.subject, identity.email) == (
            "google-subject-1",
            "ada@example.com",
        )
    # Google's other issuer, without the scheme.
    token = id_token("google", iss="accounts.google.com")
    assert providers.identity("google", token, None).subject == "google-subject-1"


@pytest.mark.parametrize(
    ("provider", "token", "nonce"),
    [
        ("apple", id_token("apple", key=OTHER_KEY), NONCE),
        ("apple", id_token("apple", aud="com.someone.else"), NONCE),
        ("apple", id_token("apple", iss=GOOGLE_ISSUER), NONCE),
        ("apple", id_token("apple", exp=NOW_S - LEEWAY_S - 1), NONCE),
        ("apple", id_token("apple", iat=NOW_S + LEEWAY_S + 1), NONCE),
        ("apple", id_token("apple", exp=LEFT_OUT), NONCE),
        ("apple", id_token("apple"), "another-nonce"),
        ("apple", id_token("apple"), None),
        ("apple", id_token("apple", nonce=LEFT_OUT), NONCE),
        ("apple", id_token("apple", email_verified="false"), NONCE),
        ("apple", id_token("apple", email=LEFT_OUT), NONCE),
        ("apple", id_token("apple", email="not an email"), NONCE),
        ("apple", id_token("apple", kid="unknown-key"), NONCE),
        ("google", id_token("google", email_verified=False), None),
        ("google", id_token("google", email_verified=LEFT_OUT), None),
        ("google", id_token("google", aud=APPLE_BUNDLE_ID), None),
        ("google", id_token("google", iss=APPLE_ISSUER), None),
        ("google", id_token("apple"), None),
        ("google", "not-a-token", None),
        (
            "google",
            jwt.encode(
                {"sub": "x"}, "a-shared-secret-of-32-bytes-long", algorithm="HS256"
            ),
            None,
        ),
    ],
)
def test_a_token_that_does_not_hold_is_wrong_credentials(
    providers: SignInProviders, provider: Any, token: str, nonce: str | None
) -> None:
    with pytest.raises(AccountError) as raised:
        providers.identity(provider, token, nonce)
    assert (raised.value.status, raised.value.code) == (401, "wrong_credentials")


def test_a_token_a_little_late_on_this_clock_still_holds(
    providers: SignInProviders,
) -> None:
    token = id_token("apple", exp=NOW_S - LEEWAY_S + 1, iat=NOW_S + LEEWAY_S - 1)
    assert providers.identity("apple", token, NONCE).email == EMAIL


def test_the_keys_are_kept_as_their_cache_control_says(
    providers: SignInProviders, network: Network, ticks: Ticks
) -> None:
    network.replies[APPLE_KEYS_URL] = keys_reply((KID, PROVIDER_KEY), max_age=600)
    for _ in range(3):
        providers.identity("apple", id_token("apple"), NONCE)
    assert len(network.to(APPLE_KEYS_URL)) == 1
    ticks.t += 599
    providers.identity("apple", id_token("apple"), NONCE)
    assert len(network.to(APPLE_KEYS_URL)) == 1
    ticks.t += 1
    providers.identity("apple", id_token("apple"), NONCE)
    assert len(network.to(APPLE_KEYS_URL)) == 2
    # Each provider has its own.
    assert network.to(GOOGLE_KEYS_URL) == []


def test_a_new_key_is_asked_for_at_most_once_a_minute(
    providers: SignInProviders, network: Network, ticks: Ticks
) -> None:
    providers.identity("google", id_token("google"), None)
    rotated = id_token("google", key=OTHER_KEY, kid="test-key-2")
    for _ in range(3):
        with pytest.raises(AccountError, match="could not be checked"):
            providers.identity("google", rotated, None)
    # Asked a moment ago: not again before REFETCH_S. Then Google has
    # rotated, and the new key is there.
    assert len(network.to(GOOGLE_KEYS_URL)) == 1
    network.replies[GOOGLE_KEYS_URL] = keys_reply(
        (KID, PROVIDER_KEY), ("test-key-2", OTHER_KEY)
    )
    ticks.t += REFETCH_S
    assert providers.identity("google", rotated, None).subject == "google-subject-1"
    assert len(network.to(GOOGLE_KEYS_URL)) == 2


def test_keys_that_cannot_be_read_are_503_the_old_ones_stay(
    providers: SignInProviders, network: Network, ticks: Ticks
) -> None:
    network.replies[APPLE_KEYS_URL] = OSError("no network")
    with pytest.raises(AccountError) as raised:
        providers.identity("apple", id_token("apple"), NONCE)
    assert (raised.value.status, raised.value.code) == (503, "provider_unavailable")
    network.replies[APPLE_KEYS_URL] = keys_reply((KID, PROVIDER_KEY))
    ticks.t += REFETCH_S
    providers.identity("apple", id_token("apple"), NONCE)
    # Apple down after that: the keys of before, asked for again a minute on.
    network.replies[APPLE_KEYS_URL] = Reply(500, {}, b"")
    ticks.t += DEFAULT_KEYS_S
    assert providers.identity("apple", id_token("apple"), NONCE).email == EMAIL
    ticks.t += MIN_KEYS_S - 1
    providers.identity("apple", id_token("apple"), NONCE)
    assert len(network.to(APPLE_KEYS_URL)) == 3


def test_the_keys_lifetime_stays_within_bounds() -> None:
    assert keys_lifetime_s("public, max-age=21600, must-revalidate") == 21600
    assert keys_lifetime_s(None) == DEFAULT_KEYS_S
    assert keys_lifetime_s("no-cache") == DEFAULT_KEYS_S
    assert keys_lifetime_s("max-age=0") == MIN_KEYS_S
    assert keys_lifetime_s("max-age=99999999") == MAX_KEYS_S


def test_a_provider_without_keys_is_off() -> None:
    off = SignInProviders.from_env({})
    assert off.names == []
    with pytest.raises(AccountError) as raised:
        off.identity("google", id_token("google"), None)
    assert (raised.value.status, raised.value.code) == (503, "provider_unavailable")
    # Apple needs all three; the .p8 with its lines joined by "\n".
    apple_vars = {
        APPLE_TEAM_VARIABLE: TEAM_ID,
        APPLE_KEY_ID_VARIABLE: KEY_ID,
        APPLE_KEY_VARIABLE: APPLE_P8.replace("\n", "\\n"),
    }
    for left in apple_vars:
        partial = {k: v for k, v in apple_vars.items() if k != left}
        assert SignInProviders.from_env(partial).names == []
    on = SignInProviders.from_env(
        apple_vars | {GOOGLE_CLIENTS_VARIABLE: f" {GOOGLE_IOS} , {GOOGLE_WEB},"}
    )
    assert on.names == ["apple", "google"]
    assert on.apple is not None and on.apple.private_key == APPLE_P8.strip()
    assert on.google == GoogleSetup((GOOGLE_IOS, GOOGLE_WEB))


def test_a_p8_that_is_not_a_key_leaves_apple_off(
    caplog: pytest.LogCaptureFixture,
) -> None:
    broken = {
        APPLE_TEAM_VARIABLE: TEAM_ID,
        APPLE_KEY_ID_VARIABLE: KEY_ID,
        APPLE_KEY_VARIABLE: "-----BEGIN PRIVATE KEY-----\\nnope\\n-----END",
    }
    with caplog.at_level(logging.ERROR):
        assert SignInProviders.from_env(broken).names == []
    assert APPLE_KEY_VARIABLE in caplog.text
    assert "nope" not in caplog.text


def test_apple_gets_a_client_secret_signed_with_the_p8(
    providers: SignInProviders, network: Network
) -> None:
    assert providers.apple_refresh_token(CODE) == REFRESH
    (call,) = network.to(APPLE_TOKEN_URL)
    sent = form(call)
    assert sent["client_id"] == APPLE_BUNDLE_ID
    assert (sent["code"], sent["grant_type"]) == (CODE, "authorization_code")
    public = serialization.load_pem_private_key(APPLE_P8.encode(), None).public_key()
    assert jwt.get_unverified_header(sent["client_secret"])["kid"] == KEY_ID
    secret = jwt.decode(
        sent["client_secret"],
        public,
        algorithms=["ES256"],
        audience=APPLE_ISSUER,
        options={"verify_exp": False, "verify_iat": False},
    )
    assert secret == {
        "iss": TEAM_ID,
        "iat": NOW_S,
        "exp": NOW_S + CLIENT_SECRET_S,
        "aud": APPLE_ISSUER,
        "sub": APPLE_BUNDLE_ID,
    }


@pytest.mark.parametrize(
    "answer",
    [
        Reply(400, {}, b'{"error": "invalid_grant"}'),
        Reply(200, {}, b"not json"),
        Reply(200, {}, b'{"access_token": "a"}'),
        OSError("no network"),
    ],
)
def test_a_code_apple_does_not_exchange_gives_no_token(
    providers: SignInProviders,
    network: Network,
    answer: Reply | Exception,
    caplog: pytest.LogCaptureFixture,
) -> None:
    network.replies[APPLE_TOKEN_URL] = answer
    with caplog.at_level(logging.WARNING):
        assert providers.apple_refresh_token(CODE) is None
    assert CODE not in caplog.text


# --- The accounts, in a real PostgreSQL ---


@pytest.fixture
def database(database_url: str) -> Database:
    database = Database(database_url)
    database.migrate()
    return database


@pytest.fixture
def accounts(database: Database, wall: Wall) -> Accounts:
    return Accounts(database, now=wall, hasher=FAST_HASHER, failed=FailedSignIns())


@pytest.fixture
def client(accounts: Accounts, providers: SignInProviders) -> TestClient:
    app = create_app(
        FileSource(Path("unused.graphml")), accounts=accounts, sign_in=providers
    )
    return TestClient(app)


def test_the_providers_with_keys_are_listed(client: TestClient) -> None:
    answer = client.get("/session/providers")
    assert answer.status_code == 200
    assert answer.json() == {"providers": ["apple", "google"]}


def test_without_keys_or_accounts_no_provider_is_listed(
    accounts: Accounts, providers: SignInProviders
) -> None:
    unused = FileSource(Path("unused.graphml"))
    no_keys = TestClient(
        create_app(unused, accounts=accounts, sign_in=SignInProviders())
    )
    assert no_keys.get("/session/providers").json() == {"providers": []}
    answer = no_keys.post("/session/google", json=body("google"))
    assert (answer.status_code, code(answer)) == (503, "provider_unavailable")
    # Email and password as before.
    assert sign_up(no_keys).status_code == 201
    no_accounts = TestClient(create_app(unused, sign_in=providers))
    assert no_accounts.get("/session/providers").json() == {"providers": []}
    answer = no_accounts.post("/session/google", json=body("google"))
    assert (answer.status_code, code(answer)) == (503, "accounts_unavailable")


def test_the_environment_decides_without_a_given_provider(
    accounts: Accounts, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(GOOGLE_CLIENTS_VARIABLE, GOOGLE_WEB)
    for name in (APPLE_TEAM_VARIABLE, APPLE_KEY_ID_VARIABLE, APPLE_KEY_VARIABLE):
        monkeypatch.delenv(name, raising=False)
    app = create_app(FileSource(Path("unused.graphml")), accounts=accounts)
    answer = TestClient(app).get("/session/providers")
    assert answer.json() == {"providers": ["google"]}


@pytest.mark.parametrize("provider", ["apple", "google"])
def test_a_new_identity_asks_for_a_username_then_has_an_account(
    client: TestClient, database: Database, network: Network, provider: str
) -> None:
    first = client.post(f"/session/{provider}", json=body(provider))
    assert first.status_code == 404
    assert first.json()["error"]["code"] == "new_account"
    assert first.json()["error"]["email"] == EMAIL
    assert set(first.json()) == set(_load("new-account-error.json"))
    assert rows(database, "users") == []
    assert rows(database, "user_identities") == []
    # Nothing asked of Apple before there is an account.
    assert network.to(APPLE_TOKEN_URL) == []

    made = client.post(f"/session/{provider}", json=body(provider, **NEW))
    assert made.status_code == 201
    session = SessionBody.model_validate(made.json())
    assert (session.user.email, session.user.username) == (EMAIL, "Runner_42")
    # Apple or Google verified the address.
    assert session.user.email_confirmed is True
    assert client.get("/me", headers=bearer(session.token)).status_code == 200
    (user,) = rows(database, "users")
    assert user["language"] == "it"
    assert user["notify_away"] is True
    assert user["confirmed_16_at"] == NOW
    (identity,) = rows(database, "user_identities")
    assert identity["provider"] == provider
    assert identity["subject"] == f"{provider}-subject-1"
    assert identity["user_id"] == session.user.id
    assert identity["email"] == EMAIL
    assert identity["created_at"] == NOW
    # Only Apple's token is kept, for the revocation; Google keeps nothing.
    expected = REFRESH if provider == "apple" else None
    assert identity["apple_refresh_token"] == expected
    assert len(network.to(APPLE_TOKEN_URL)) == (provider == "apple")

    # The next time: the same account, 200, nothing new.
    again = client.post(f"/session/{provider}", json=body(provider))
    assert again.status_code == 200
    assert again.json()["user"]["id"] == session.user.id
    assert len(rows(database, "users")) == 1
    assert len(network.to(APPLE_TOKEN_URL)) == (provider == "apple")


def test_the_password_of_a_new_account_is_one_nobody_knows(
    client: TestClient, database: Database
) -> None:
    client.post("/session/google", json=body("google", **NEW))
    (user,) = rows(database, "users")
    assert user["password_hash"].startswith("$argon2id$")
    answer = client.post("/session", json={"email": EMAIL, "password": PASSWORD})
    assert code(answer) == "wrong_credentials"


def test_a_new_account_follows_the_rules_of_sign_up(
    client: TestClient, database: Database
) -> None:
    too_young = client.post("/session/google", json=body("google", username="Ada"))
    assert (too_young.status_code, code(too_young)) == (422, "invalid_request")
    sign_up(client, email="other@example.com", username="Runner_42")
    taken = client.post("/session/google", json=body("google", **NEW))
    assert (taken.status_code, code(taken)) == (409, "username_taken")
    bad = client.post(
        "/session/google", json=body("google", **NEW | {"username": "a b"})
    )
    assert (bad.status_code, code(bad)) == (422, "invalid_request")
    away = client.post(
        "/session/google",
        json=body("google", **NEW | {"username": "Ada_1", "away_email": False}),
    )
    assert away.status_code == 201
    assert away.json()["user"]["notifications"]["away"] is False
    assert len(rows(database, "user_identities")) == 1


def test_an_unknown_provider_or_a_body_with_more_is_refused(
    client: TestClient,
) -> None:
    answer = client.post("/session/facebook", json=body("google"))
    assert (answer.status_code, code(answer)) == (422, "invalid_request")
    answer = client.post("/session/google", json=body("google", password="x"))
    assert (answer.status_code, code(answer)) == (422, "invalid_request")


def test_a_wrong_token_is_401_and_writes_nothing(
    client: TestClient, database: Database
) -> None:
    wrong = body("apple", **NEW, nonce="replayed")
    answer = client.post("/session/apple", json=wrong)
    assert (answer.status_code, code(answer)) == (401, "wrong_credentials")
    assert rows(database, "users") == []


@pytest.mark.parametrize("provider", ["apple", "google"])
def test_a_confirmed_email_is_linked_and_keeps_its_password(
    client: TestClient, database: Database, provider: str
) -> None:
    old = sign_up(client).json()
    with database.connect() as conn:
        conn.execute("UPDATE users SET email_confirmed = true")
    answer = client.post(f"/session/{provider}", json=body(provider))
    assert answer.status_code == 200
    assert answer.json()["user"]["id"] == old["user"]["id"]
    assert answer.json()["user"]["username"] == old["user"]["username"]
    # Both ways open it now, and the phone of before stays signed in.
    assert client.get("/me", headers=bearer(old["token"])).status_code == 200
    signed_in = client.post("/session", json={"email": EMAIL, "password": PASSWORD})
    assert signed_in.status_code == 200
    (identity,) = rows(database, "user_identities")
    assert identity["user_id"] == old["user"]["id"]
    again = client.post(f"/session/{provider}", json=body(provider))
    assert again.json()["user"]["id"] == old["user"]["id"]


def test_an_unconfirmed_email_loses_its_password_and_sessions(
    client: TestClient, database: Database
) -> None:
    old = sign_up(client).json()
    assert old["user"]["email_confirmed"] is False
    other_phone = client.post("/session", json={"email": EMAIL, "password": PASSWORD})
    # With a username, as after a 404 of a moment before: it is ignored.
    answer = client.post(
        "/session/google", json=body("google", **NEW | {"username": "Someone_1"})
    )
    assert answer.status_code == 200
    user = answer.json()["user"]
    assert (user["id"], user["username"]) == (old["user"]["id"], "Runner_42")
    assert user["email_confirmed"] is True
    for token in (old["token"], other_phone.json()["token"]):
        gone = client.get("/me", headers=bearer(token))
        assert (gone.status_code, code(gone)) == (401, "not_signed_in")
    assert client.get("/me", headers=bearer(answer.json()["token"])).status_code == 200
    signed_in = client.post("/session", json={"email": EMAIL, "password": PASSWORD})
    assert code(signed_in) == "wrong_credentials"
    assert len(rows(database, "sessions")) == 1


def test_apple_and_google_open_the_same_account_by_its_email(
    client: TestClient, database: Database
) -> None:
    made = client.post("/session/apple", json=body("apple", **NEW)).json()
    linked = client.post("/session/google", json=body("google"))
    assert linked.status_code == 200
    assert linked.json()["user"]["id"] == made["user"]["id"]
    # The account was confirmed: Apple's session stays.
    assert client.get("/me", headers=bearer(made["token"])).status_code == 200
    assert {row["provider"] for row in rows(database, "user_identities")} == {
        "apple",
        "google",
    }


def test_a_known_identity_follows_it_not_its_email(
    client: TestClient, database: Database
) -> None:
    made = client.post("/session/apple", json=body("apple", **NEW)).json()
    # «Hide My Email» turned on later: the same Apple account, a relay.
    relayed = id_token("apple", email=RELAY)
    answer = client.post("/session/apple", json=body("apple", id_token=relayed))
    assert answer.status_code == 200
    assert answer.json()["user"]["id"] == made["user"]["id"]
    assert answer.json()["user"]["email"] == EMAIL
    (identity,) = rows(database, "user_identities")
    assert identity["email"] == RELAY


def test_a_code_apple_refuses_signs_in_and_the_next_one_is_exchanged(
    client: TestClient, database: Database, network: Network
) -> None:
    network.replies[APPLE_TOKEN_URL] = Reply(400, {}, b'{"error":"invalid_grant"}')
    made = client.post("/session/apple", json=body("apple", **NEW))
    assert made.status_code == 201
    (identity,) = rows(database, "user_identities")
    assert identity["apple_refresh_token"] is None
    network.replies[APPLE_TOKEN_URL] = Reply(200, {}, b'{"refresh_token": "r2"}')
    client.post("/session/apple", json=body("apple", authorization_code="code-2"))
    (identity,) = rows(database, "user_identities")
    assert identity["apple_refresh_token"] == "r2"
    # Kept from then on: no code is exchanged any more.
    client.post("/session/apple", json=body("apple", authorization_code="code-3"))
    assert len(network.to(APPLE_TOKEN_URL)) == 2


def test_deleting_an_apple_account_revokes_its_access(
    client: TestClient, database: Database, network: Network
) -> None:
    made = client.post("/session/apple", json=body("apple", **NEW)).json()
    answer = client.delete("/me", headers=bearer(made["token"]))
    assert answer.status_code == 204
    (call,) = network.to(APPLE_REVOKE_URL)
    sent = form(call)
    assert (sent["token"], sent["token_type_hint"]) == (REFRESH, "refresh_token")
    assert sent["client_id"] == APPLE_BUNDLE_ID
    assert rows(database, "users") == []
    assert rows(database, "user_identities") == []


@pytest.mark.parametrize(
    "answer", [Reply(400, {}, b'{"error":"invalid_request"}'), OSError("down")]
)
def test_a_revocation_that_fails_does_not_stop_the_deletion(
    client: TestClient,
    database: Database,
    network: Network,
    answer: Reply | Exception,
    caplog: pytest.LogCaptureFixture,
) -> None:
    made = client.post("/session/apple", json=body("apple", **NEW)).json()
    network.replies[APPLE_REVOKE_URL] = answer
    with caplog.at_level(logging.WARNING):
        deleted = client.delete("/me", headers=bearer(made["token"]))
    assert deleted.status_code == 204
    assert rows(database, "users") == []
    assert "not revoked" in caplog.text or "No answer from Apple" in caplog.text
    assert REFRESH not in caplog.text


def test_deleting_a_google_or_password_account_calls_nobody(
    client: TestClient, network: Network
) -> None:
    made = client.post("/session/google", json=body("google", **NEW)).json()
    assert client.delete("/me", headers=bearer(made["token"])).status_code == 204
    other = sign_up(client, email="other@example.com", username="Other_1").json()
    assert client.delete("/me", headers=bearer(other["token"])).status_code == 204
    assert network.to(APPLE_REVOKE_URL) == []
    assert network.to(APPLE_TOKEN_URL) == []


def test_nothing_secret_reaches_the_log(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        made = client.post("/session/apple", json=body("apple", **NEW)).json()
        client.post("/session/apple", json=body("apple"))
        client.delete("/me", headers=bearer(made["token"]))
    for secret in (CODE, REFRESH, NONCE, made["token"], APPLE_P8[40:80]):
        assert secret not in caplog.text
