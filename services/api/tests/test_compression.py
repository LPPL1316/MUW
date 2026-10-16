"""Answers compressed for a phone that takes gzip (TASK-288, ADR-0249):
from a kilobyte up, never the JPEGs and the zones' gzip files."""

from __future__ import annotations

import gzip
from pathlib import Path

from fastapi import Response
from fastapi.testclient import TestClient
from route_engine.network import FileSource

from shaperoute_api.app import GZIP_MIN_BYTES, create_app

GZIP = {"Accept-Encoding": "gzip"}
PLAIN = {"Accept-Encoding": "identity"}


def client() -> TestClient:
    app = create_app(FileSource(Path("unused.graphml")))

    @app.get("/test-text")
    def text(size: int) -> Response:
        return Response("x" * size, media_type="application/json")

    @app.get("/test-picture")
    def picture() -> Response:
        return Response(b"\xff\xd8" + b"\x00" * 5000, media_type="image/jpeg")

    @app.get("/test-zone")
    def zone() -> Response:
        return Response(gzip.compress(b"x" * 5000), media_type="application/gzip")

    return TestClient(app)


def raw(answer: object) -> int:
    """The bytes that came, before httpx unpacks them."""
    return int(answer.num_bytes_downloaded)  # type: ignore[attr-defined]


def test_a_large_answer_is_compressed_for_who_takes_gzip() -> None:
    app = client()
    answer = app.get("/openapi.json", headers=GZIP)
    assert answer.status_code == 200
    assert answer.headers["content-encoding"] == "gzip"
    assert "accept-encoding" in answer.headers["vary"].lower()
    assert raw(answer) < len(answer.content) / 3
    # Compressed whole, its length said: not in pieces.
    assert answer.headers["content-length"] == str(raw(answer))
    # The same body, unpacked.
    assert answer.json()["paths"]


def test_who_does_not_take_gzip_gets_it_plain() -> None:
    answer = client().get("/openapi.json", headers=PLAIN)
    assert "content-encoding" not in answer.headers
    assert raw(answer) == len(answer.content)


def test_less_than_a_kilobyte_is_not_compressed() -> None:
    app = client()
    small = app.get("/test-text", params={"size": GZIP_MIN_BYTES - 1}, headers=GZIP)
    assert "content-encoding" not in small.headers
    large = app.get("/test-text", params={"size": GZIP_MIN_BYTES}, headers=GZIP)
    assert large.headers["content-encoding"] == "gzip"


def test_pictures_and_gzip_files_are_left_as_they_are() -> None:
    app = client()
    for path in ("/test-picture", "/test-zone"):
        answer = app.get(path, headers=GZIP)
        assert "content-encoding" not in answer.headers, path
    assert app.get("/test-picture", headers=GZIP).content.startswith(b"\xff\xd8")
