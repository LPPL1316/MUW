"""One email out through Resend, as small as it can be (TASK-291, ADR-0251).

The code that talks to Resend is one: resend_email.py, of the email to who
is away (TASK-284). The reports' mailer is its Resend, and send_email only
says whether Resend took the email.

The key is a secret and the address is personal: neither is ever in a log,
an error or a repr. Of a refusal only the status is logged.
"""

from __future__ import annotations

from shaperoute_api.resend_email import SEND_URL, Email, Resend

__all__ = ["SEND_URL", "Mailer", "send_email"]

# Resend, through `send`: the network, or a fake in the tests. `sender` is
# the From of every email, on a domain verified in Resend.
Mailer = Resend


def send_email(mailer: Mailer, to: str, subject: str, text: str, html: str) -> bool:
    """Whether Resend took the email; never raises, never retries."""
    return mailer.deliver(Email(to, subject, text, html)) is not None
