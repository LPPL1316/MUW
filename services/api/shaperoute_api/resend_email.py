"""Resend, the email service, as this server talks to it (TASK-284,
ADR-0244, docs/DEPLOY.md, «Email di ritorno»). What is sent, and to whom,
is in away_email.py.

One call: POST /emails, the key as a Bearer token, JSON over HTTPS with the
standard library, as expo_push.py talks to Expo. The answer is the id of
the email, or an error with a name ("validation_error", "rate_limit_exceeded"
…). Resend takes 2 requests a second: the caller waits between two sends.
An Idempotency-Key makes Resend send an email once even if it is asked
twice within a day.

The key is a secret, and the address of the reader is personal: neither is
ever in a log, an error or a repr. Of an error only its status and name are
logged, never its message, which may quote the address.

The only place that names Resend's address: change it here.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from shaperoute_api.strava_client import Call, Reply, Send, send_over_network

log = logging.getLogger(__name__)

SEND_URL = "https://api.resend.com/emails"
# Resend sits behind a firewall that refuses Python's own User-Agent.
USER_AGENT = "MuW-API/1.0"
# An email Resend took without saying its id.
UNKNOWN_ID = "?"


@dataclass(frozen=True)
class Email:
    """One email to one reader."""

    to: str = field(repr=False)
    subject: str
    text: str = field(repr=False)
    html: str = field(repr=False)
    # Headers of the email itself, such as List-Unsubscribe.
    headers: Mapping[str, str] = field(default_factory=dict, repr=False)
    # The same key within a day is one email for Resend.
    idempotency_key: str | None = None


def _error_name(reply: Reply) -> str:
    """The name of Resend's error, without its message."""
    try:
        body: Any = json.loads(reply.body)
    except ValueError:
        return "?"
    name = body.get("name") if isinstance(body, Mapping) else None
    return name if isinstance(name, str) and name.isidentifier() else "?"


@dataclass(frozen=True)
class Resend:
    """Resend, through `send`: the network, or a fake. `sender` is the
    From of every email, on a domain verified in Resend."""

    key: str = field(repr=False)
    sender: str
    send: Send = field(default=send_over_network, repr=False)

    def deliver(self, email: Email) -> str | None:
        """Resend's id of the email, or None when Resend did not take it
        (logged): it is not sent again here. A 200 is an email taken, even
        when its id cannot be read: UNKNOWN_ID then."""
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        }
        if email.idempotency_key is not None:
            headers["Idempotency-Key"] = email.idempotency_key
        payload: dict[str, Any] = {
            "from": self.sender,
            "to": [email.to],
            "subject": email.subject,
            "text": email.text,
            "html": email.html,
        }
        if email.headers:
            payload["headers"] = dict(email.headers)
        call = Call("POST", SEND_URL, headers, json.dumps(payload).encode())
        try:
            reply = self.send(call)
        except Exception:
            # The call carries the key and the address: nothing of it.
            log.warning("email: Resend did not answer")
            return None
        if reply.status != 200:
            log.warning(
                "email: Resend answered %s %s", reply.status, _error_name(reply)
            )
            return None
        try:
            body: Any = json.loads(reply.body)
        except ValueError:
            body = None
        email_id = body.get("id") if isinstance(body, Mapping) else None
        if not isinstance(email_id, str) or not email_id:
            log.warning("email: Resend answered without an id")
            return UNKNOWN_ID
        return email_id
