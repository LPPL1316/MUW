"""The files of the photos and videos, without a database (TASK-333,
ADR-0289): a video read from its MP4 boxes (length, size as shown, MP4 or
QuickTime), its metadata made `free` boxes of zeros with every offset kept,
the folder written whole and emptied of what no row keeps, the cap read
from the environment. The videos are made here, box by box."""

from __future__ import annotations

import os
import struct
from pathlib import Path

import pytest

from shaperoute_api.media_files import (
    GIGABYTE,
    NO_LENGTH,
    NOT_A_VIDEO,
    STRAY_AFTER_S,
    MediaConfigError,
    MediaError,
    MediaFolder,
    boxes,
    cap_bytes,
    video_facts,
    without_metadata,
)

# Where a phone says the video was shot, ISO 6709, as in an iPhone's file.
PLACE = b"+46.0667+011.1215+194.000/"
IDENTITY = (0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
# A phone held upright: the picture turned a quarter.
QUARTER = (0, 0x10000, 0, -0x10000, 0, 0, 0, 0, 0x40000000)


def box(kind: bytes, body: bytes) -> bytes:
    return struct.pack(">I", 8 + len(body)) + kind + body


def mvhd(duration: int, timescale: int = 600, version: int = 0) -> bytes:
    if version == 1:
        times = struct.pack(">QQIQ", 0, 0, timescale, duration)
    else:
        times = struct.pack(">IIII", 0, 0, timescale, duration)
    # Rate, volume, matrix, next track: what follows, unread.
    return box(b"mvhd", bytes([version, 0, 0, 0]) + times + bytes(80))


def tkhd(width: int, height: int, matrix: tuple[int, ...] = IDENTITY) -> bytes:
    head = bytes(4) + struct.pack(">IIIII", 0, 0, 1, 0, 0) + bytes(16)
    size = struct.pack(">II", width << 16, height << 16)
    return box(b"tkhd", head + struct.pack(">9i", *matrix) + size)


def place() -> bytes:
    return box(b"\xa9xyz", struct.pack(">HH", len(PLACE), 0) + PLACE)


def video(
    seconds: float = 24,
    width: int = 960,
    height: int = 540,
    matrix: tuple[int, ...] = IDENTITY,
    brand: bytes = b"isom",
    version: int = 0,
) -> bytes:
    """A small MP4 as a phone writes one: the place in `udta` and `meta`."""
    ftyp = box(b"ftyp", brand + bytes(4) + b"isommp41")
    sound = box(b"trak", tkhd(0, 0))
    pictures = box(b"trak", tkhd(width, height, matrix) + box(b"udta", place()))
    moov = box(
        b"moov",
        mvhd(round(seconds * 600), version=version)
        + sound
        + pictures
        + box(b"udta", place())
        + box(b"meta", bytes(4) + PLACE),
    )
    return ftyp + moov + box(b"mdat", bytes(range(256)) * 4)


# --- Reading a video ---


def test_a_video_says_its_length_and_size() -> None:
    facts = video_facts(video(seconds=24.5))
    assert (facts.duration_ms, facts.width, facts.height) == (24500, 960, 540)
    assert facts.media_type == "video/mp4"
    assert video_facts(video(seconds=61, version=1)).duration_ms == 61000


def test_an_upright_video_is_measured_upright() -> None:
    facts = video_facts(video(width=960, height=540, matrix=QUARTER))
    assert (facts.width, facts.height) == (540, 960)


def test_a_mov_is_served_as_quicktime() -> None:
    assert video_facts(video(brand=b"qt  ")).media_type == "video/quicktime"


@pytest.mark.parametrize(
    ("data", "why"),
    [
        (b"", NOT_A_VIDEO),
        (b"\x89PNG\r\n\x1a\n" + bytes(40), NOT_A_VIDEO),
        # A box longer than the file.
        (video()[:-10], NOT_A_VIDEO),
        # No moov.
        (box(b"ftyp", b"isom" + bytes(4)) + box(b"mdat", bytes(8)), NOT_A_VIDEO),
        # No pictures at all.
        (box(b"ftyp", b"isom" + bytes(4)) + box(b"moov", mvhd(600)), NOT_A_VIDEO),
        # No length.
        (video(seconds=0), NO_LENGTH),
    ],
)
def test_what_is_not_a_video_says_why(data: bytes, why: str) -> None:
    with pytest.raises(MediaError, match=why):
        video_facts(data)


def test_a_box_of_64_bit_size_is_read() -> None:
    body = bytes(20)
    large = struct.pack(">I4sQ", 1, b"free", 16 + len(body)) + body
    data = video() + large
    assert [b.kind for b in boxes(data, 0, len(data))][-1] == b"free"


# --- Without the metadata ---


def test_the_place_is_gone_and_every_offset_kept() -> None:
    original = video()
    blank = without_metadata(original)
    assert len(blank) == len(original)
    assert PLACE not in blank
    assert b"udta" not in blank and b"meta" not in blank
    # The pictures where they were, and the video still read the same.
    assert blank[-1024:] == original[-1024:]
    assert video_facts(blank) == video_facts(original)
    top = [b.kind for b in boxes(blank, 0, len(blank))]
    assert top == [b"ftyp", b"moov", b"mdat"]


# --- The folder ---


def test_a_file_is_written_whole_and_alone(tmp_path: Path) -> None:
    folder = MediaFolder(tmp_path / "messages")
    folder.write("a.jpg", b"one")
    folder.write("a.jpg", b"two")
    assert folder.path("a.jpg").read_bytes() == b"two"
    assert [name for name, _ in folder.names()] == ["a.jpg"]


def test_only_the_files_kept_stay(tmp_path: Path) -> None:
    folder = MediaFolder(tmp_path)
    for name in ("kept.mp4", "kept.poster.jpg", "gone.jpg", "new.jpg"):
        folder.write(name, b"x")
    old = 1_000_000.0
    for name in ("kept.mp4", "kept.poster.jpg", "gone.jpg"):
        os.utime(folder.path(name), (old, old))
    os.utime(folder.path("new.jpg"), (old + STRAY_AFTER_S, old + STRAY_AFTER_S))
    # A file just written may be waiting for its row: it stays.
    removed = folder.keep_only({"kept"}, clock_s=lambda: old + STRAY_AFTER_S + 1)
    assert removed == 1
    assert sorted(name for name, _ in folder.names()) == [
        "kept.mp4",
        "kept.poster.jpg",
        "new.jpg",
    ]


def test_a_folder_not_made_yet_is_empty(tmp_path: Path) -> None:
    assert list(MediaFolder(tmp_path / "none").names()) == []


# --- The cap ---


def test_the_cap_comes_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CAP_FOR_TEST", raising=False)
    assert cap_bytes("CAP_FOR_TEST", 10) == 10 * GIGABYTE
    monkeypatch.setenv("CAP_FOR_TEST", "2.5")
    assert cap_bytes("CAP_FOR_TEST", 10) == 2_500_000_000
    for wrong in ("ten", "0", "-1"):
        monkeypatch.setenv("CAP_FOR_TEST", wrong)
        with pytest.raises(MediaConfigError, match="CAP_FOR_TEST"):
            cap_bytes("CAP_FOR_TEST", 10)
