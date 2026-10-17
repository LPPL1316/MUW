"""One email out through Resend, as small as it can be (TASK-291, ADR-0251).

A stand-in until TASK-284's resend_email.py (#502) is in main: then
send_email calls it, and this file shrinks to that call, so the code that
talks to Resend is one. One POST to Resend's /emails, the key as a Bearer
token, with the standard library, as strava_client.py talks to Strava.

The key is a secret and the address is personal: neither is ever in a log,
an error or a repr. Of a refusal only the status is logged.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from shaperoute_api.strava_client import Call, Send, send_over_network

log = logging.getLogger(__name__)

SEND_URL = "https://api.resend.com/emails"
# Resend sits behind a firewall that refuses Python's own User-Agent.
USER_AGENT = "MuW-API/1.0"


@dataclass(frozen=True)
class Mailer:
    """Resend, through `send`: the network, or a fake in the tests.
    `sender` is the From of every email, on a domain verified in Resend."""

    key: str = field(repr=False)
    sender: str
    send: Send = field(default=send_over_network, repr=False)


def send_email(mailer: Mailer, to: str, subject: str, text: str, html: str) -> bool:
    """Whether Resend took the email; never raises, never retries."""
    payload = {
        "from": mailer.sender,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
    }
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {mailer.key}",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
    }
    call = Call("POST", SEND_URL, headers, json.dumps(payload).encode())
    try:
        reply = mailer.send(call)
    except Exception:
        # The call carries the key and the address: nothing of it.
        log.warning("email: Resend did not answer")
        return False
    if reply.status != 200:
        log.warning("email: Resend answered %s", reply.status)
        return False
    return True
