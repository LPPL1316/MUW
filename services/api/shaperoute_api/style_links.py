"""The shop links of MuW Style (TASK-384, ADR-0326, docs/STYLE.md, «I link»).

A dot of a Style post keeps the shop's own page. When «Shop» is touched the
API answers the link to open: through Awin's deep link when this server has
a publisher id and the shop's Awin advertiser id, else the shop's page as
it is. The ids come only from the environment, never from the repository:

- SHAPEROUTE_AWIN_PUBLISHER_ID, the number Awin gives the publisher;
- SHAPEROUTE_AWIN_ADVERTISERS, `retailer:id` pairs, like `zalando:12345`.

A page is only ever one of the shop's own sites (RETAILER_HOSTS): a row with
another address cannot send a phone somewhere else.
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Literal, cast, get_args
from urllib.parse import quote, urlsplit

Retailer = Literal["zalando", "amazon", "decathlon"]
RETAILERS: tuple[Retailer, ...] = get_args(Retailer)
# The sites of each shop, in Italy: the catalog is zalando.it (docs/STYLE.md).
RETAILER_HOSTS: dict[Retailer, frozenset[str]] = {
    "zalando": frozenset({"www.zalando.it"}),
    "amazon": frozenset({"www.amazon.it"}),
    "decathlon": frozenset({"www.decathlon.it"}),
}
MAX_URL_LENGTH = 1000

PUBLISHER_VARIABLE = "SHAPEROUTE_AWIN_PUBLISHER_ID"
ADVERTISERS_VARIABLE = "SHAPEROUTE_AWIN_ADVERTISERS"
AWIN_LINK = "https://www.awin1.com/cread.php"
AWIN_ID = re.compile(r"^[0-9]{1,12}$")


class StyleLinkError(ValueError):
    """A shop page that is not one of the shop's sites; says why."""


class StyleLinksConfigError(ValueError):
    """An Awin id in the environment that is not one."""


def checked_page(retailer: str, url: str) -> str:
    """The page as kept: https, on one of the retailer's sites, no password
    and no fragment."""
    if retailer not in RETAILER_HOSTS:
        raise StyleLinkError(f"retailer: one of {', '.join(RETAILERS)}")
    if len(url) > MAX_URL_LENGTH:
        raise StyleLinkError(f"url: at most {MAX_URL_LENGTH} characters")
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.username or parts.password:
        raise StyleLinkError("url: an https address without a user")
    hosts = RETAILER_HOSTS[cast(Retailer, retailer)]
    if parts.hostname not in hosts or parts.port is not None:
        raise StyleLinkError(f"url: a page of {', '.join(sorted(hosts))}")
    if parts.fragment:
        raise StyleLinkError("url: without #")
    return url


@dataclass(frozen=True)
class StyleLinks:
    """Awin's ids, when the server has them."""

    publisher_id: str | None = field(default=None, repr=False)
    advertisers: Mapping[str, str] = field(default_factory=dict, repr=False)

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> StyleLinks:
        """Without a publisher id, the shops' pages as they are."""
        publisher = environ.get(PUBLISHER_VARIABLE, "").strip() or None
        if publisher is not None and not AWIN_ID.match(publisher):
            raise StyleLinksConfigError(f"{PUBLISHER_VARIABLE} is a number")
        advertisers: dict[str, str] = {}
        for pair in environ.get(ADVERTISERS_VARIABLE, "").split(","):
            if not pair.strip():
                continue
            retailer, _, number = (part.strip() for part in pair.partition(":"))
            if retailer not in RETAILER_HOSTS or not AWIN_ID.match(number):
                raise StyleLinksConfigError(
                    f"{ADVERTISERS_VARIABLE} is retailer:number pairs, like"
                    " zalando:12345"
                )
            advertisers[retailer] = number
        return cls(publisher, advertisers)

    def link(self, retailer: str, url: str) -> str:
        """What «Shop» opens: Awin's deep link to the page, or the page."""
        page = checked_page(retailer, url)
        advertiser = self.advertisers.get(retailer)
        if self.publisher_id is None or advertiser is None:
            return page
        return (
            f"{AWIN_LINK}?awinmid={advertiser}&awinaffid={self.publisher_id}"
            f"&ued={quote(page, safe='')}"
        )
