"""The shop links of MuW Style (TASK-384, ADR-0326).

No database: a page only of the shop's own sites, Awin's deep link only
with both ids, the ids read from the environment and refused when they are
not numbers."""

from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

import pytest

from shaperoute_api.style_links import (
    ADVERTISERS_VARIABLE,
    PUBLISHER_VARIABLE,
    StyleLinkError,
    StyleLinks,
    StyleLinksConfigError,
    checked_page,
)

PAGE = "https://www.zalando.it/asics-road-packable-jacket-giacca-da-running-midnight-as142f03e-k12.html"


def test_a_page_of_the_shop_is_kept_as_it_is() -> None:
    assert checked_page("zalando", PAGE) == PAGE
    assert checked_page("amazon", "https://www.amazon.it/s?k=ASICS") is not None


@pytest.mark.parametrize(
    ("retailer", "url"),
    [
        ("zalando", "http://www.zalando.it/x.html"),
        ("zalando", "https://www.amazon.it/x"),
        ("zalando", "https://zalando.it.example.com/x.html"),
        ("zalando", "https://user@www.zalando.it/x.html"),
        ("zalando", "https://www.zalando.it:8443/x.html"),
        ("zalando", "https://www.zalando.it/x.html#top"),
        ("zalando", "https://www.zalando.it/" + "x" * 1000),
        ("shein", "https://www.zalando.it/x.html"),
        ("zalando", "javascript:alert(1)"),
    ],
)
def test_any_other_address_is_refused(retailer: str, url: str) -> None:
    with pytest.raises(StyleLinkError):
        checked_page(retailer, url)


def test_without_the_ids_shop_opens_the_page() -> None:
    assert StyleLinks().link("zalando", PAGE) == PAGE
    assert StyleLinks("123", {}).link("zalando", PAGE) == PAGE
    assert StyleLinks(None, {"zalando": "456"}).link("zalando", PAGE) == PAGE


def test_with_both_ids_shop_opens_awins_deep_link() -> None:
    link = StyleLinks("123", {"zalando": "456"}).link("zalando", PAGE)
    parts = urlsplit(link)
    assert (parts.scheme, parts.hostname, parts.path) == (
        "https",
        "www.awin1.com",
        "/cread.php",
    )
    assert parse_qs(parts.query) == {
        "awinmid": ["456"],
        "awinaffid": ["123"],
        "ued": [PAGE],
    }


def test_a_shop_without_its_advertiser_id_opens_the_page() -> None:
    page = "https://www.amazon.it/dp/B0000"
    assert StyleLinks("123", {"zalando": "456"}).link("amazon", page) == page


def test_the_ids_come_from_the_environment() -> None:
    links = StyleLinks.from_env(
        {PUBLISHER_VARIABLE: " 123 ", ADVERTISERS_VARIABLE: "zalando:456, amazon:7"}
    )
    assert links.publisher_id == "123"
    assert dict(links.advertisers) == {"zalando": "456", "amazon": "7"}
    assert StyleLinks.from_env({}) == StyleLinks()


@pytest.mark.parametrize(
    "environ",
    [
        {PUBLISHER_VARIABLE: "abc"},
        {ADVERTISERS_VARIABLE: "zalando=456"},
        {ADVERTISERS_VARIABLE: "shein:456"},
        {ADVERTISERS_VARIABLE: "zalando:"},
    ],
)
def test_an_id_that_is_not_a_number_is_refused(environ: dict[str, str]) -> None:
    with pytest.raises(StyleLinksConfigError):
        StyleLinks.from_env(environ)


def test_the_ids_are_not_in_the_repr() -> None:
    assert "123" not in repr(StyleLinks("123", {"zalando": "456"}))
