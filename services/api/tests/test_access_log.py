"""The access log holds no position nor the text searched (TASK-124)."""

from __future__ import annotations

import logging

import pytest

from shaperoute_api.access_log import ACCESS_LOGGER, HideQueryString, hide_query_strings


def access_record(path: str) -> logging.LogRecord:
    """A record as uvicorn's access logger makes it."""
    return logging.LogRecord(
        ACCESS_LOGGER,
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("100.81.107.6:58239", "GET", path, "1.1", 200),
        None,
    )


def test_a_place_search_line_has_no_position_nor_text() -> None:
    record = access_record("/places?q=via%20bel&lat=46.0097&lon=11.3140")
    assert HideQueryString().filter(record)
    line = record.getMessage()
    assert line == '100.81.107.6:58239 - "GET /places HTTP/1.1" 200'
    for leak in ("46.0097", "11.3140", "lat=", "via"):
        assert leak not in line


def test_a_line_without_query_is_unchanged() -> None:
    record = access_record("/route-jobs/b5680c5aec73")
    HideQueryString().filter(record)
    assert "GET /route-jobs/b5680c5aec73 HTTP/1.1" in record.getMessage()


def test_the_photo_of_a_town_near_the_phone_stays_out_of_the_line() -> None:
    record = access_record("/city-photos/Q3415.jpg?v=2")
    HideQueryString().filter(record)
    line = record.getMessage()
    assert line == '100.81.107.6:58239 - "GET /city-photos/ HTTP/1.1" 200'
    assert "Q3415" not in line


def test_the_filter_is_added_once(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("test-access-log")
    hide_query_strings(logger)
    hide_query_strings(logger)
    assert sum(isinstance(f, HideQueryString) for f in logger.filters) == 1
    with caplog.at_level(logging.INFO, logger="test-access-log"):
        logger.info('%s - "%s %s HTTP/%s" %d', "c", "GET", "/places?lat=1", "1.1", 200)
    assert "lat=" not in caplog.text
