"""Resend as this server talks to it (TASK-284, ADR-0244), with a fake
network: what goes on the wire, what comes back, and that neither the key
nor the reader's address is ever in a log or a repr."""

from __future__ import annotations

import json
import logging

import pytest

from shaperoute_api.resend_email import (
    SEND_URL,
    UNKNOWN_ID,
    USER_AGENT,
    Email,
    Resend,
)
from shaperoute_api.strava_client import Call, Reply

KEY = "re_secret_key_123"
SENDER = "MuW <hello@getmuw.app>"
READER = "runner@example.com"


class Wire:
    """The network: the calls made, and one answer for all of them."""

    def __init__(self, reply: Reply | None) -> None:
        self.calls: list[Call] = []
        self.reply = reply

    def __call__(self, call: Call) -> Reply:
        self.calls.append(call)
        if self.reply is None:
            raise OSError("no network")
        return self.reply


def email(**changes: object) -> Email:
    fields: dict[str, object] = {
        "to": READER,
        "subject": "2 new drawings from people you follow",
        "text": "Hi,\n\nOpen MuW",
        "html": "<p>Hi,</p>",
        "headers": {"List-Unsubscribe": "<https://api.example/away-email/stop>"},
        "idempotency_key": "away-1-1760000000",
        **changes,
    }
    return Email(**fields)  # type: ignore[arg-type]


def answer(status: int, body: object) -> Reply:
    return Reply(status, {}, json.dumps(body).encode())


def test_an_email_goes_on_the_wire_as_resend_documents_it() -> None:
    wire = Wire(answer(200, {"id": "49a3999c"}))
    assert Resend(KEY, SENDER, send=wire).deliver(email()) == "49a3999c"
    (call,) = wire.calls
    assert (call.method, call.url) == ("POST", SEND_URL)
    assert call.headers["Authorization"] == f"Bearer {KEY}"
    assert call.headers["Idempotency-Key"] == "away-1-1760000000"
    assert call.headers["User-Agent"] == USER_AGENT
    assert call.body is not None
    sent = json.loads(call.body)
    assert sent == {
        "from": SENDER,
        "to": [READER],
        "subject": "2 new drawings from people you follow",
        "text": "Hi,\n\nOpen MuW",
        "html": "<p>Hi,</p>",
        "headers": {"List-Unsubscribe": "<https://api.example/away-email/stop>"},
    }


def test_without_headers_or_key_nothing_more_is_sent() -> None:
    wire = Wire(answer(200, {"id": "x"}))
    Resend(KEY, SENDER, send=wire).deliver(email(headers={}, idempotency_key=None))
    (call,) = wire.calls
    assert "Idempotency-Key" not in call.headers
    assert call.body is not None
    assert "headers" not in json.loads(call.body)


@pytest.mark.parametrize(
    "reply",
    [
        answer(422, {"name": "validation_error", "message": f"Bad {READER}"}),
        answer(429, {"name": "rate_limit_exceeded", "message": "slow down"}),
        Reply(500, {}, b"<html>down</html>"),
        None,
    ],
)
def test_an_email_refused_is_none_and_logged_without_secrets(
    reply: Reply | None, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.WARNING, logger="shaperoute_api.resend_email")
    assert Resend(KEY, SENDER, send=Wire(reply)).deliver(email()) is None
    assert caplog.records
    logged = caplog.text
    assert KEY not in logged and READER not in logged
    if reply is not None and reply.status == 422:
        assert "422 validation_error" in logged


def test_a_200_without_an_id_is_an_email_taken() -> None:
    wire = Wire(Reply(200, {}, b"not json"))
    assert Resend(KEY, SENDER, send=wire).deliver(email()) == UNKNOWN_ID


def test_neither_the_key_nor_the_address_is_in_a_repr() -> None:
    assert KEY not in repr(Resend(KEY, SENDER))
    assert READER not in repr(email())
    assert "Open MuW" not in repr(email())
