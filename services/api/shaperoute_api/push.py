"""Push notifications: the phones of an account, and what is sent to them
(TASK-262 part A, ADR-0226, docs/API.md, «Push notifications»).

The app sends its Expo push token once the phone allowed notifications and
«Push notifications» is on in «Settings» (PUT /me/push-token); it takes it
back when the switch goes off or the account logs out (DELETE
/me/push-token/{token}). One row per token: a phone belongs to the account
that sent its token last.

Five events are notified, the same list for every channel (the user's
choice of 2026-10-07): a follow request, a follow request accepted, a
reaction, a comment, a tag. A sixth, a shape of the game unlocked (TASK-296,
ADR-0255), is told to the runner who unlocked it; three more are the game's
teams' (part C): a piece finished, a challenge complete, a day left. Each to
one recipient, and only when:

- the recipient has «Push notifications» on (users.notify_push);
- the recipient is not the one who acted, but for OWN_KINDS;
- neither has blocked the other (TASK-121);
- a drawing's event, the recipient sees the drawing.

What to send is read in the request, after its write, with one query: a
request that notifies nobody costs no thread and no network. The network is
outside the request: one thread posts to Expo (expo_push.py); a token Expo
calls dead (DeviceNotRegistered), at once or in a receipt read
RECEIPT_DELAY_S later, is deleted. Whatever goes wrong with a notification
is logged and never changes the answer of the request that caused it.

The same event is notified once a day at most (SAME_EVENT_S): asking to
follow twice, or changing a reaction, does not notify again. Kept in
memory: a restart forgets it, and the receipts not read yet.

The texts are in the language the app said with the token, else English.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel, ConfigDict, Field

from shaperoute_api.accounts import (
    ACCOUNT_ERRORS,
    Accounts,
    UserBody,
    accounts_of,
    current_user,
)
from shaperoute_api.db import Database
from shaperoute_api.expo_push import (
    DEVICE_NOT_REGISTERED,
    Expo,
    Message,
    Ticket,
    short,
)

log = logging.getLogger(__name__)

Platform = Literal["ios", "android"]
Language = Literal["en", "de", "it", "es", "fr"]
Kind = Literal[
    "follow_request",
    "follow_accepted",
    "reaction",
    "comment",
    "tag",
    "shape_unlocked",
    "piece_done",
    "challenge_done",
    "challenge_ending",
]
# The events of what one did oneself, or of nobody's doing: told to
# oneself too (the shape game, TASK-296).
OWN_KINDS: frozenset[str] = frozenset(
    {"shape_unlocked", "challenge_done", "challenge_ending"}
)

# An Expo push token: "ExponentPushToken[…]", or "ExpoPushToken[…]".
TOKEN_PATTERN = r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{1,180}\]$"
MAX_TOKEN_LENGTH = 200
# When the receipts of a send are asked: Expo has them after some minutes,
# and keeps them a day.
RECEIPT_DELAY_S = 15 * 60
RECEIPT_KEPT_S = 24 * 60 * 60
# The same event to the same person, not again before this.
SAME_EVENT_S = 24 * 60 * 60
# A comment in a notification: its beginning.
MAX_QUOTED = 100


class PushTokenRequestBody(BaseModel):
    """PUT /me/push-token: this phone's token, and what the texts need."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(max_length=MAX_TOKEN_LENGTH, pattern=TOKEN_PATTERN)
    platform: Platform
    language: Language | None = Field(
        default=None,
        description="The app's language on this phone; English without it.",
    )


# --- The tokens, in the database ---


@dataclass
class PushTokens:
    """The phones of the accounts."""

    database: Database
    now: Callable[[], datetime]

    def keep(self, user_id: int, body: PushTokenRequestBody) -> None:
        """The token is this account's now, even if another sent it before:
        the phone changed hands."""
        with self.database.connect() as conn:
            conn.execute(
                "INSERT INTO push_tokens (token, user_id, platform, language,"
                " updated_at) VALUES (%s, %s, %s, %s, %s)"
                " ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,"
                " platform = EXCLUDED.platform, language = EXCLUDED.language,"
                " updated_at = EXCLUDED.updated_at",
                (body.token, user_id, body.platform, body.language, self.now()),
            )

    def forget(self, user_id: int, token: str) -> None:
        """Only the account's own: another's token stays where it is."""
        with self.database.connect() as conn:
            conn.execute(
                "DELETE FROM push_tokens WHERE token = %s AND user_id = %s",
                (token, user_id),
            )


def forget_dead(database: Database, tokens: Sequence[str]) -> None:
    """Tokens Expo will never deliver to again, whoever has them."""
    if not tokens:
        return
    with database.connect() as conn:
        conn.execute("DELETE FROM push_tokens WHERE token = ANY(%s)", (list(tokens),))
    log.info("push: %d dead token(s) deleted", len(tokens))


# --- What is notified ---


@dataclass(frozen=True)
class PushEvent:
    """Something `actor_id` did that `recipient_id` is told of."""

    kind: Kind
    actor_id: int
    recipient_id: int
    # The drawing of a reaction, a comment, a tag.
    drawing_id: UUID | None = None
    # The reaction's code (reactions.py), the comment's text.
    reaction: str | None = None
    text: str | None = None
    # What tells two events of the same kind apart: a comment's id. Two
    # reactions of one person to one drawing are the same event.
    key: str = ""
    # A challenge of the shape game (TASK-296 C): the app opens it; its text
    # has a number (a piece's, or the pieces missing) and the shape's name
    # in the phone's language.
    challenge_id: UUID | None = None
    number: int | None = None
    names: Mapping[str, str] | None = None

    def same(self) -> tuple[str, int, int, str, str]:
        return (
            self.kind,
            self.actor_id,
            self.recipient_id,
            str(self.drawing_id or ""),
            self.key,
        )


REACTION_EMOJI = {
    "fire": "🔥",
    "clap": "👏",
    "strong": "💪",
    "laugh": "😂",
    "wow": "😮",
}

# The texts, by kind and language; {name} is who acted. The super like is a
# reaction with a comment: its own text (ADR-0193).
TEXTS: dict[str, dict[str, str]] = {
    "follow_request": {
        "en": "{name} asked to follow you.",
        "de": "{name} möchte dir folgen.",
        "it": "{name} ha chiesto di seguirti.",
        "es": "{name} ha pedido seguirte.",
        "fr": "{name} a demandé à te suivre.",
    },
    "follow_accepted": {
        "en": "{name} accepted your follow request.",
        "de": "{name} hat deine Folgeanfrage angenommen.",
        "it": "{name} ha accettato la tua richiesta di follow.",
        "es": "{name} ha aceptado tu solicitud para seguirle.",
        "fr": "{name} a accepté ta demande de suivi.",
    },
    "reaction": {
        "en": "{name} reacted {emoji} to your post.",
        "de": "{name} hat mit {emoji} auf deinen Beitrag reagiert.",
        "it": "{name} ha reagito con {emoji} al tuo post.",
        "es": "{name} ha reaccionado con {emoji} a tu publicación.",
        "fr": "{name} a réagi {emoji} à ta publication.",
    },
    "super_like": {
        "en": "{name} gave your post a MuW heart: {text}",
        "de": "{name} hat deinem Beitrag ein MuW-Herz gegeben: {text}",
        "it": "{name} ha dato un cuore MuW al tuo post: {text}",
        "es": "{name} ha dado un corazón MuW a tu publicación: {text}",
        "fr": "{name} a donné un cœur MuW à ta publication : {text}",
    },
    "comment": {
        "en": "{name} commented on your post: {text}",
        "de": "{name} hat deinen Beitrag kommentiert: {text}",
        "it": "{name} ha commentato il tuo post: {text}",
        "es": "{name} ha comentado tu publicación: {text}",
        "fr": "{name} a commenté ta publication : {text}",
    },
    "tag": {
        "en": "{name} tagged you in a post.",
        "de": "{name} hat dich in einem Beitrag markiert.",
        "it": "{name} ti ha taggato in un post.",
        "es": "{name} te ha etiquetado en una publicación.",
        "fr": "{name} t'a identifié dans une publication.",
    },
    # The shape game (TASK-296): no name, the runner is the one told.
    "shape_unlocked": {
        "en": "You unlocked a new shape! Find it in your collection, in Play.",
        "de": "Du hast eine neue Form freigeschaltet! Du findest sie in deiner"
        " Sammlung, unter Play.",
        "it": "Hai sbloccato una nuova forma! La trovi nella tua collezione, in Play.",
        "es": "¡Has desbloqueado una nueva forma! La encontrarás en tu colección,"
        " en Play.",
        "fr": "Tu as débloqué une nouvelle forme ! Tu la trouveras dans ta"
        " collection, dans Play.",
    },
    # The game's teams (TASK-296 C): the shape's name first, in the phone's
    # language, then the news; {n} is the piece, or the pieces missing.
    "piece_done": {
        "en": "{shape}: {name} finished piece {n}.",
        "de": "{shape}: {name} hat Teil {n} geschafft.",
        "it": "{shape}: {name} ha finito il pezzo {n}.",
        "es": "{shape}: {name} ha terminado la pieza {n}.",
        "fr": "{shape} : {name} a terminé la pièce {n}.",
    },
    "challenge_done": {
        "en": "{shape}: the shape is complete! Your team drew it together.",
        "de": "{shape}: die Form ist fertig! Euer Team hat sie zusammen gezeichnet.",
        "it": "{shape}: la forma è completa! La squadra l'ha disegnata insieme.",
        "es": "{shape}: ¡la forma está completa! Vuestro equipo la ha dibujado"
        " juntos.",
        "fr": "{shape} : la forme est complète ! Ton équipe l'a dessinée ensemble.",
    },
    "challenge_ending": {
        "en": "{shape}: 1 day left. Pieces missing: {n}.",
        "de": "{shape}: noch 1 Tag. Fehlende Teile: {n}.",
        "it": "{shape}: manca 1 giorno. Pezzi da fare: {n}.",
        "es": "{shape}: queda 1 día. Piezas que faltan: {n}.",
        "fr": "{shape} : plus qu'1 jour. Pièces manquantes : {n}.",
    },
}


def quoted(text: str | None) -> str:
    """A comment as a notification shows it: on one line, its beginning."""
    line = " ".join((text or "").split())
    return line if len(line) <= MAX_QUOTED else line[: MAX_QUOTED - 1] + "…"


def text_of(event: PushEvent, name: str, language: str | None) -> str:
    """What the notification says, in `language`, else in English."""
    which: str = event.kind
    if event.kind == "reaction" and event.reaction == "super_like":
        which = "super_like"
    texts = TEXTS[which]
    template = texts.get(language or "en", texts["en"])
    names = event.names or {}
    return template.format(
        name=name,
        emoji=REACTION_EMOJI.get(event.reaction or "", ""),
        text=quoted(event.text),
        shape=names.get(language or "en") or names.get("en", ""),
        n="" if event.number is None else event.number,
    )


def data_of(event: PushEvent, actor_public_id: UUID, actor_name: str) -> dict[str, str]:
    """What the app opens when the notification is touched: the challenge,
    the drawing, or the profile of who acted."""
    if event.challenge_id is not None:
        return {"kind": event.kind, "challenge_id": str(event.challenge_id)}
    if event.drawing_id is not None:
        return {"kind": event.kind, "drawing_id": str(event.drawing_id)}
    return {
        "kind": event.kind,
        "public_id": str(actor_public_id),
        "username": actor_name,
    }


Blocked = Callable[[Connection[DictRow], int, int], bool]


def blocked_between(conn: Connection[DictRow], a: int, b: int) -> bool:
    """Whether either account blocked the other (TASK-121, ADR-0228)."""
    # Here, not at the top: follows.py calls this module's hooks.
    from shaperoute_api.follows import apart_sql

    row = conn.execute(
        f"SELECT {apart_sql('%s', 'u.id')} AS apart FROM users u WHERE u.id = %s",
        (a, b),
    ).fetchone()
    return row is not None and bool(row["apart"])


Run = Callable[[Callable[[], None]], object]
Later = Callable[[float, Callable[[], None]], object]


def _later(delay_s: float, task: Callable[[], None]) -> object:
    timer = threading.Timer(delay_s, task)
    timer.daemon = True
    timer.start()
    return timer


@dataclass
class _Pending:
    ticket_id: str
    token: str
    sent_at: float


@dataclass
class Pusher:
    """Sends the notifications of the events, outside their requests."""

    database: Database
    expo: Expo = field(default_factory=Expo)
    # Where the network part runs: one thread; the tests run it at once.
    run: Run | None = None
    # How the receipts are asked for later; the tests call check_receipts.
    later: Later = _later
    clock: Callable[[], float] = time.monotonic
    blocked: Blocked = blocked_between

    def __post_init__(self) -> None:
        self._lock = threading.Lock()
        self._sent: dict[tuple[str, int, int, str, str], float] = {}
        self._pending: list[_Pending] = []
        self._waiting = False
        if self.run is None:
            pool = ThreadPoolExecutor(1, thread_name_prefix="push")
            self.run = pool.submit

    def notify(self, event: PushEvent) -> None:
        """Called after the write of the event. Never raises."""
        try:
            own = event.actor_id == event.recipient_id
            if (own and event.kind not in OWN_KINDS) or not self._first(event):
                return
            messages = self.messages(event)
            if messages:
                assert self.run is not None
                self.run(lambda: self._send(messages))
        except Exception:
            log.exception("push: %s not notified", event.kind)

    def _first(self, event: PushEvent) -> bool:
        """Whether the event was not notified in the last SAME_EVENT_S."""
        now = self.clock()
        with self._lock:
            for old in [k for k, t in self._sent.items() if now - t >= SAME_EVENT_S]:
                del self._sent[old]
            if event.same() in self._sent:
                return False
            self._sent[event.same()] = now
            return True

    def messages(self, event: PushEvent) -> list[Message]:
        """One message for each phone of the recipient, when it is to be
        told: the conditions of the module's docstring."""
        with self.database.connect() as conn:
            people = conn.execute(
                "SELECT r.notify_push, a.username, a.public_id"
                " FROM users r, users a WHERE r.id = %s AND a.id = %s",
                (event.recipient_id, event.actor_id),
            ).fetchone()
            if people is None or not people["notify_push"]:
                return []
            if self.blocked(conn, event.actor_id, event.recipient_id):
                return []
            if event.drawing_id is not None and not _sees(
                conn, event.recipient_id, event.drawing_id
            ):
                return []
            phones = conn.execute(
                "SELECT token, language FROM push_tokens WHERE user_id = %s"
                " ORDER BY token",
                (event.recipient_id,),
            ).fetchall()
        name = people["username"]
        data = data_of(event, people["public_id"], name)
        return [
            Message(phone["token"], text_of(event, name, phone["language"]), data)
            for phone in phones
        ]

    def _send(self, messages: list[Message]) -> None:
        try:
            tickets = self.expo.push(messages)
            self._after(tickets)
        except Exception:
            log.exception("push: %d message(s) not sent", len(messages))

    def _after(self, tickets: Sequence[Ticket]) -> None:
        dead = [t.to for t in tickets if t.error == DEVICE_NOT_REGISTERED]
        for ticket in tickets:
            if ticket.error is not None and ticket.error != DEVICE_NOT_REGISTERED:
                log.warning("push: %s to %s", ticket.error, short(ticket.to))
        forget_dead(self.database, dead)
        now = self.clock()
        with self._lock:
            self._pending.extend(
                _Pending(t.id, t.to, now) for t in tickets if t.id is not None
            )
        self._wait_for_receipts()

    def _wait_for_receipts(self) -> None:
        with self._lock:
            if self._waiting or not self._pending:
                return
            self._waiting = True

        def check() -> None:
            with self._lock:
                self._waiting = False
            assert self.run is not None
            self.run(self.check_receipts)

        self.later(RECEIPT_DELAY_S, check)

    def check_receipts(self) -> list[str]:
        """Reads the receipts of the tickets sent RECEIPT_DELAY_S ago or
        more; deletes the tokens they call dead. The tokens deleted."""
        try:
            return self._check_receipts()
        except Exception:
            log.exception("push: receipts not read")
            return []
        finally:
            self._wait_for_receipts()

    def _check_receipts(self) -> list[str]:
        now = self.clock()
        with self._lock:
            due = [p for p in self._pending if now - p.sent_at >= RECEIPT_DELAY_S]
        if not due:
            return []
        said = self.expo.receipts([p.ticket_id for p in due])
        dead = sorted(
            {p.token for p in due if said.get(p.ticket_id) == DEVICE_NOT_REGISTERED}
        )
        for p in due:
            error = said.get(p.ticket_id)
            if error is not None and error != DEVICE_NOT_REGISTERED:
                log.warning("push: receipt %s for %s", error, short(p.token))
        forget_dead(self.database, dead)
        done = {
            p.ticket_id
            for p in due
            if p.ticket_id in said or now - p.sent_at >= RECEIPT_KEPT_S
        }
        with self._lock:
            self._pending = [p for p in self._pending if p.ticket_id not in done]
        return dead


def _sees(conn: Connection[DictRow], viewer_id: int, drawing_id: UUID) -> bool:
    # Here, not at the top: drawings.py calls this module's hooks.
    from shaperoute_api.drawings import drawing_seen_sql

    row = conn.execute(
        "SELECT 1 FROM drawings d JOIN runs r ON r.id = d.run_id"
        f" WHERE d.id = %s AND {drawing_seen_sql('%s')}",
        (drawing_id, viewer_id),
    ).fetchone()
    return row is not None


def notify(request: Request, event: PushEvent) -> None:
    """For the modules that write an event: after the write, never raises.
    Without a database there is no pusher, and nothing to notify."""
    pusher: Pusher | None = getattr(request.app.state, "pusher", None)
    if pusher is not None:
        pusher.notify(event)


def _pusher(request: Request) -> Pusher | None:
    pusher: Pusher | None = getattr(request.app.state, "pusher", None)
    return pusher


def _one(pusher: Pusher, sql: str, params: tuple[object, ...]) -> int | None:
    """The `id` of the row `sql` finds; None when none, or on any error."""
    try:
        with pusher.database.connect() as conn:
            row = conn.execute(sql, params).fetchone()
    except Exception:
        log.exception("push: the recipient was not found")
        return None
    return None if row is None else int(row["id"])


def _as_uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None


def notify_account(request: Request, kind: Kind, actor_id: int, public_id: str) -> None:
    """A follow event (follows.py): the account of `public_id` is told.
    After the write; never raises."""
    pusher, wanted = _pusher(request), _as_uuid(public_id)
    if pusher is None or wanted is None:
        return
    recipient = _one(pusher, "SELECT id FROM users WHERE public_id = %s", (wanted,))
    if recipient is not None:
        pusher.notify(PushEvent(kind, actor_id, recipient))


def notify_owner(
    request: Request,
    kind: Kind,
    actor_id: int,
    drawing_id: str,
    reaction: str | None = None,
    text: str | None = None,
    key: str = "",
) -> None:
    """A reaction or a comment (reactions.py, comments.py): the owner of the
    drawing is told. After the write; never raises."""
    pusher, wanted = _pusher(request), _as_uuid(drawing_id)
    if pusher is None or wanted is None:
        return
    owner = _one(
        pusher,
        "SELECT r.user_id AS id FROM drawings d JOIN runs r ON r.id = d.run_id"
        " WHERE d.id = %s",
        (wanted,),
    )
    if owner is not None:
        pusher.notify(PushEvent(kind, actor_id, owner, wanted, reaction, text, key))


def tagged_before(request: Request, user_id: int, key: str) -> frozenset[int]:
    """Who is tagged in the drawing of the run `key` before it is kept again
    (drawings.py): only the ones tagged now for the first time are told."""
    pusher = _pusher(request)
    if pusher is None:
        return frozenset()
    try:
        with pusher.database.connect() as conn:
            rows = conn.execute(
                "SELECT t.user_id FROM drawing_tags t"
                " JOIN drawings d ON d.id = t.drawing_id"
                " JOIN runs r ON r.id = d.run_id"
                " WHERE r.user_id = %s AND r.key = %s",
                (user_id, key),
            ).fetchall()
    except Exception:
        log.exception("push: the tags of before were not read")
        return frozenset()
    return frozenset(int(row["user_id"]) for row in rows)


def notify_tagged(
    request: Request, actor_id: int, drawing_id: UUID, before: frozenset[int]
) -> None:
    """A drawing kept with its tags (drawings.py): each member tagged now and
    not before is told. After the write; never raises."""
    pusher = _pusher(request)
    if pusher is None:
        return
    try:
        with pusher.database.connect() as conn:
            rows = conn.execute(
                "SELECT user_id FROM drawing_tags WHERE drawing_id = %s",
                (drawing_id,),
            ).fetchall()
    except Exception:
        log.exception("push: the tags were not read")
        return
    for row in rows:
        if int(row["user_id"]) not in before:
            pusher.notify(PushEvent("tag", actor_id, int(row["user_id"]), drawing_id))


# --- The endpoints ---


def push_tokens_of(
    accounts: Annotated[Accounts, Depends(accounts_of)],
) -> PushTokens:
    """In the database of the accounts, on the same clock."""
    return PushTokens(accounts.database, accounts.now)


Tokens = Annotated[PushTokens, Depends(push_tokens_of)]
Me = Annotated[UserBody, Depends(current_user)]


def push_routes() -> APIRouter:
    router = APIRouter(tags=["accounts"], responses=ACCOUNT_ERRORS)

    @router.put("/me/push-token", status_code=204)
    def keep_push_token(
        body: PushTokenRequestBody, tokens: Tokens, user: Me
    ) -> Response:
        tokens.keep(user.id, body)
        return Response(status_code=204)

    # Any text: a token that is not one was never kept, and is gone already.
    @router.delete("/me/push-token/{token}", status_code=204)
    def forget_push_token(token: str, tokens: Tokens, user: Me) -> Response:
        tokens.forget(user.id, token)
        return Response(status_code=204)

    return router


def install_push(app: FastAPI, pusher: Pusher | None = None) -> None:
    """The phones of the accounts and the notifications; after
    install_accounts, which sets the database and the errors. Without a
    database, no pusher: nothing is sent."""
    accounts: Accounts | None = app.state.accounts
    if pusher is None and accounts is not None:
        pusher = Pusher(accounts.database)
    app.state.pusher = pusher
    app.include_router(push_routes())
