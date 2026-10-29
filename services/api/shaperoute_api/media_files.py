"""Photos and videos kept as files on disk, never in the database (ADR-0289,
TASK-333; also the videos of the posts, ADR-0292, TASK-336).

What both share, with no table of their own: a folder of files named by
id, written whole or not at all; the check of a video without any program
besides Python (the MP4 boxes: `ftyp` first, the length from `mvhd`, the
size from the first picture track's `tkhd`); the metadata a phone writes
in it, where it was shot among them (`©xyz` in `udta`, the location in
`meta`), made `free` boxes of zeros of the same length, so no offset
moves; and
the server-wide cap of a feature, read from the environment.

Each feature keeps its rows (message_media.py for the messages) and says
which files are still wanted: the rest goes with `MediaFolder.keep_only`.
"""

from __future__ import annotations

import os
import struct
import time
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

# A file written but not yet in its table is still being sent: left alone
# this long by keep_only.
STRAY_AFTER_S = 600
GIGABYTE = 1_000_000_000

# Boxes that hold others, walked to reach the metadata of the tracks.
CONTAINERS = frozenset({b"moov", b"trak", b"mdia", b"minf"})
# Boxes of metadata, which no player needs: the place, the phone, the time.
BLANKED = frozenset({b"udta", b"meta", b"uuid"})
QUICKTIME = b"qt  "

NOT_A_VIDEO = "video: not an MP4 or QuickTime file"
NO_LENGTH = "video: the file does not say how long it is"


class MediaError(ValueError):
    """A file that cannot be kept: says why, in words for the 422."""


class MediaConfigError(ValueError):
    """A cap set in the environment that is not a number of gigabytes."""


# --- The folder ---


@dataclass(frozen=True)
class MediaFolder:
    """The files of one feature, `<id>.<ext>`, a poster `<id>.poster.jpg`."""

    root: Path

    def path(self, name: str) -> Path:
        return self.root / name

    def write(self, name: str, data: bytes) -> None:
        """The file whole, or not at all: written aside, then renamed."""
        self.root.mkdir(parents=True, exist_ok=True)
        aside = self.root / f".{name}.{uuid.uuid4().hex}.part"
        try:
            aside.write_bytes(data)
            os.replace(aside, self.path(name))
        finally:
            aside.unlink(missing_ok=True)

    def remove(self, name: str) -> None:
        self.path(name).unlink(missing_ok=True)

    def names(self) -> Iterator[tuple[str, float]]:
        """Each file and when it was last written, in seconds."""
        if not self.root.is_dir():
            return
        for entry in os.scandir(self.root):
            if entry.is_file():
                yield entry.name, entry.stat().st_mtime

    def keep_only(self, ids: set[str], clock_s: Callable[[], float] = time.time) -> int:
        """Removes the files whose id (the name up to its first dot) is not
        in `ids`, older than STRAY_AFTER_S; how many went."""
        removed = 0
        for name, written_s in list(self.names()):
            stem = name.lstrip(".").split(".", 1)[0]
            if stem in ids or clock_s() - written_s < STRAY_AFTER_S:
                continue
            self.remove(name)
            removed += 1
        return removed


def cap_bytes(variable: str, default_gb: float) -> int:
    """A feature's server-wide cap, from `variable` in gigabytes."""
    raw = os.environ.get(variable, "").strip()
    if not raw:
        return round(default_gb * GIGABYTE)
    try:
        gigabytes = float(raw)
    except ValueError:
        raise MediaConfigError(
            f"{variable}: a number of gigabytes, got {raw!r}"
        ) from None
    if not gigabytes > 0:
        raise MediaConfigError(f"{variable}: more than 0 gigabytes, got {raw!r}")
    return round(gigabytes * GIGABYTE)


# --- The boxes of a video ---


@dataclass(frozen=True)
class Box:
    kind: bytes
    start: int
    """Where its header starts."""
    body: int
    """Where what it holds starts, after the header."""
    end: int


def boxes(data: bytes | bytearray, start: int, end: int) -> Iterator[Box]:
    """The boxes from `start` to `end`, one after the other; MediaError when
    one does not fit."""
    at = start
    while at < end:
        if end - at < 8:
            raise MediaError(NOT_A_VIDEO)
        size, kind = struct.unpack_from(">I4s", data, at)
        body = at + 8
        if size == 1:
            if end - at < 16:
                raise MediaError(NOT_A_VIDEO)
            (size,) = struct.unpack_from(">Q", data, body)
            body += 8
        elif size == 0:
            size = end - at
        if size < body - at or at + size > end:
            raise MediaError(NOT_A_VIDEO)
        yield Box(kind, at, body, at + size)
        at += size


def _child(data: bytes, parent: Box, kind: bytes) -> Box | None:
    return next(
        (b for b in boxes(data, parent.body, parent.end) if b.kind == kind), None
    )


@dataclass(frozen=True)
class VideoFacts:
    duration_ms: int
    width: int | None
    height: int | None
    media_type: str
    """video/mp4, or video/quicktime for a .mov."""


def video_facts(data: bytes) -> VideoFacts:
    """How long the video is and its size as shown; MediaError when it is
    not an MP4 or QuickTime file with a length."""
    top = list(boxes(data, 0, len(data)))
    if not top or top[0].kind != b"ftyp" or top[0].end - top[0].body < 4:
        raise MediaError(NOT_A_VIDEO)
    brand = bytes(data[top[0].body : top[0].body + 4])
    kinds = [b.kind for b in top]
    if kinds.count(b"moov") != 1 or b"mdat" not in kinds:
        raise MediaError(NOT_A_VIDEO)
    moov = top[kinds.index(b"moov")]
    mvhd = _child(data, moov, b"mvhd")
    if mvhd is None or mvhd.end - mvhd.body < 20:
        raise MediaError(NO_LENGTH)
    version = data[mvhd.body]
    if version == 1:
        if mvhd.end - mvhd.body < 32:
            raise MediaError(NO_LENGTH)
        timescale, duration = struct.unpack_from(">IQ", data, mvhd.body + 20)
    else:
        timescale, duration = struct.unpack_from(">II", data, mvhd.body + 12)
    if timescale == 0 or duration == 0 or duration == 0xFFFFFFFF:
        raise MediaError(NO_LENGTH)
    width, height = _shown_size(data, moov)
    return VideoFacts(
        duration_ms=max(1, duration * 1000 // timescale),
        width=width,
        height=height,
        media_type="video/quicktime" if brand == QUICKTIME else "video/mp4",
    )


def _shown_size(data: bytes, moov: Box) -> tuple[int | None, int | None]:
    """The size of the first track with pictures, turned as its matrix says
    (a phone held upright writes a wide picture turned a quarter)."""
    for trak in boxes(data, moov.body, moov.end):
        if trak.kind != b"trak":
            continue
        tkhd = _child(data, trak, b"tkhd")
        # The matrix (9 numbers) and then width and height, 16.16 each.
        if tkhd is None or tkhd.end - tkhd.body < 84:
            continue
        width, height = struct.unpack_from(">II", data, tkhd.end - 8)
        width, height = width >> 16, height >> 16
        if width == 0 or height == 0:
            continue
        a, b, _, c, d = struct.unpack_from(">iiiii", data, tkhd.end - 44)
        if a == 0 and d == 0 and b != 0 and c != 0:
            width, height = height, width
        return width, height
    return None, None


def without_metadata(data: bytes) -> bytes:
    """The video with its metadata boxes made `free` of the same length and
    full of zeros: where and when it was shot, the phone, gone from the
    file; the pictures and the sound, and every offset to them, are as they
    were."""
    out = bytearray(data)

    def blank(start: int, end: int) -> None:
        for box in boxes(out, start, end):
            if box.kind in BLANKED:
                out[box.start + 4 : box.start + 8] = b"free"
                out[box.body : box.end] = bytes(box.end - box.body)
            elif box.kind in CONTAINERS:
                blank(box.body, box.end)

    blank(0, len(out))
    return bytes(out)
