"""Deterministic tests for tools/video_music.py: the ten tracks are made again
sample by sample and compared with music.json; the app's M4A is checked on
its bytes. No afconvert: it runs only when the files are made, on a Mac."""

from __future__ import annotations

import json
import math
import struct
import sys
from array import array

import pytest
import video_music as vm

KEPT = json.loads(vm.MANIFEST.read_text())


def test_the_manifest_lists_the_tracks_in_the_apps_order() -> None:
    assert list(KEPT) == list(vm.TRACKS)
    assert len(KEPT) == 10
    for name, entry in KEPT.items():
        assert entry["file"] == f"{name}.m4a"


@pytest.mark.parametrize("name", list(vm.TRACKS))
def test_each_track_makes_the_samples_kept_in_music_json(name: str) -> None:
    pcm = vm.TRACKS[name]()
    assert len(pcm) == 4 * vm.FRAMES  # 12 s of 16-bit stereo
    assert vm.sha256(pcm) == KEPT[name]["pcm_sha256"]
    samples = array("h", pcm)
    if sys.byteorder == "big":
        samples.byteswap()
    assert max(map(abs, samples)) <= round(vm.PEAK * 32767)
    assert samples[0] == samples[1] == 0
    assert max(map(abs, samples[-40:])) <= 1


@pytest.mark.parametrize("name", list(vm.TRACKS))
def test_the_apps_file_is_the_one_kept_and_small(name: str) -> None:
    data = (vm.OUT / KEPT[name]["file"]).read_bytes()
    assert vm.sha256(data) == KEPT[name]["m4a_sha256"]
    assert len(data) == KEPT[name]["bytes"] < 300_000


def test_a_sine_and_a_soft_limit_with_four_operations_only() -> None:
    for k in range(100):
        phase = k / 100
        assert abs(vm.sine(phase) - math.sin(2 * math.pi * phase)) < 0.002
    assert vm.limit(0.0) == 0.0
    assert vm.limit(5.0) == 1.0
    assert abs(vm.limit(0.5) - math.tanh(0.5)) < 0.01


def test_the_pitches_double_each_octave() -> None:
    assert vm.HZ[69] == 440.0
    assert abs(vm.HZ[81] - 880.0) < 1e-9
    assert abs(vm.HZ[60] - 261.6255653) < 1e-6


ESDS = bytes.fromhex("00000000038080802200000004808080144015001800000001f4000001f400")


def _encoded() -> vm.Encoded:
    return vm.Encoded(
        esds=ESDS,
        channels=2,
        rate=44_100,
        sizes=[3, 4, 5],
        packets=b"abcdefghijkl",
        priming=2112,
        frames=1000,
    )


def test_the_apps_file_leaves_the_priming_out_with_an_edit_list() -> None:
    data = vm.app_file(_encoded())
    assert data[4:12] == b"ftypM4A "
    start, _ = vm.path(data, b"moov", b"trak", b"edts", b"elst")
    # one entry: 1000 frames long, from frame 2112 of the media, at rate 1
    assert struct.unpack_from(">IIIIHH", data, start) == (0, 1, 1000, 2112, 1, 0)
    start, _ = vm.path(data, b"moov", b"mvhd")
    assert struct.unpack_from(">II", data, start + 12) == (44_100, 1000)
    start, _ = vm.path(data, b"moov", b"trak", b"mdia", b"mdhd")
    assert struct.unpack_from(">II", data, start + 12) == (44_100, 3 * 1024)
    start, _ = vm.path(data, b"moov", b"trak", b"mdia", b"hdlr")
    assert data[start + 8 : start + 12] == b"soun"


def test_the_apps_file_has_every_packet_in_one_chunk() -> None:
    data = vm.app_file(_encoded())
    start, _ = vm.path(data, *vm.STBL, b"stts")
    assert struct.unpack_from(">III", data, start + 4) == (1, 3, 1024)
    start, _ = vm.path(data, *vm.STBL, b"stsc")
    assert struct.unpack_from(">IIII", data, start + 4) == (1, 1, 3, 1)
    start, _ = vm.path(data, *vm.STBL, b"stsz")
    assert struct.unpack_from(">IIIII", data, start + 4) == (0, 3, 3, 4, 5)
    start, _ = vm.path(data, *vm.STBL, b"stco")
    count, offset = struct.unpack_from(">II", data, start + 4)
    assert count == 1
    assert data[offset - 4 : offset] == b"mdat"
    assert data[offset:] == b"abcdefghijkl"
    start, end = vm.path(data, *vm.STBL, b"stsd")
    entry = start + 8
    assert data[entry + 4 : entry + 8] == b"mp4a"
    assert struct.unpack_from(">HH", data, entry + 24) == (2, 16)
    assert data[entry + 36 : end] == vm.box(b"esds", ESDS)


def _afconvert_like() -> bytes:
    """An M4A laid out as afconvert writes it: packets in two chunks, the
    priming in iTunSMPB."""
    mp4a = vm.box(
        b"mp4a",
        bytes(6),
        struct.pack(">H", 1),
        bytes(8),
        struct.pack(">HHHHI", 2, 16, 0, 0, 44_100 << 16),
        vm.box(b"esds", ESDS),
    )
    smpb = " 00000000 00000840 00000090 00000000000003E8 " + "00000000 " * 8
    ilst = vm.box(
        b"----",
        vm.full_box(b"mean", 0, 0, b"com.apple.iTunes"),
        vm.full_box(b"name", 0, 0, b"iTunSMPB"),
        vm.box(b"data", struct.pack(">II", 1, 0), smpb.encode("ascii")),
    )

    def moov(first: int, second: int) -> bytes:
        stbl = vm.box(
            b"stbl",
            vm.full_box(b"stsd", 0, 0, struct.pack(">I", 1), mp4a),
            vm.full_box(b"stsz", 0, 0, struct.pack(">IIIII", 0, 3, 3, 4, 5)),
            vm.full_box(b"stsc", 0, 0, struct.pack(">IIIIIII", 2, 1, 2, 1, 2, 1, 1)),
            vm.full_box(b"stco", 0, 0, struct.pack(">III", 2, first, second)),
        )
        trak = vm.box(b"trak", vm.box(b"mdia", vm.box(b"minf", stbl)))
        return vm.box(b"moov", trak, vm.box(b"udta", ilst))

    head = vm.box(b"ftyp", b"M4A ", bytes(4))
    first = len(head) + len(moov(0, 0)) + 8
    body = vm.box(b"mdat", b"abcdefg", b"xx", b"hijkl")
    return head + moov(first, first + 9) + body


def test_afconverts_file_is_read_chunk_by_chunk_with_its_priming() -> None:
    encoded = vm.read_encoded(_afconvert_like())
    assert encoded.packets == b"abcdefghijkl"
    assert encoded.sizes == [3, 4, 5]
    assert (encoded.channels, encoded.rate) == (2, 44_100)
    assert (encoded.priming, encoded.frames) == (2112, 1000)
    assert encoded.esds == ESDS
