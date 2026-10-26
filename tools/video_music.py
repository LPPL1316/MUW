"""Makes the ten music tracks of a run's video (TASK-301, ADR-0262).

Ours, written note by note here, 12 s each and built on the video's times
(ADR-0254): the intro until 1 s, the line drawing itself until 9 s, a hit
when the whole drawing shows, and the end at 12 s.

The sound is made with + - * / only (no sin or exp of the C library, whose
last digit may differ from one computer to another) and a fixed
pseudo-random noise, so the 16-bit samples are the same, byte for byte,
everywhere: `music.json` keeps their SHA-256, and `--check` makes them again
and compares. macOS's own `afconvert` then encodes them in AAC, and the file
is written again as a plain M4A for the app (one chunk, the encoder's
priming in an edit list): `music.json` keeps the SHA-256 of that too.

Run from the repository's root, on a Mac:

    python3 tools/video_music.py          # the ten .m4a and music.json
    python3 tools/video_music.py --check  # the samples against music.json

The files go to apps/mobile/assets/music/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import struct
import subprocess
import sys
import tempfile
import wave
from array import array
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from functools import cache
from pathlib import Path

RATE = 44_100
SECONDS = 12
FRAMES = RATE * SECONDS
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "mobile" / "assets" / "music"
MANIFEST = OUT / "music.json"
BITRATE = 128_000

# The video's times (videoScene.ts): the line starts, the drawing is whole.
DRAW_S = 1.0
HIT_S = 9.0
# The end fades to silence over this long.
FADE_S = 1.2
# The loudest sample, from 0 to 1 (about -1 dBFS).
PEAK = 0.89

TWO_PI = 6.283185307179586
# 2 ** (1 / 12) as a literal: no pow() of the C library.
SEMITONE = 1.0594630943592953

Sound = tuple[float, ...]


def _frequencies() -> list[float]:
    table = [0.0] * 128
    table[69] = 440.0
    for note in range(70, 128):
        table[note] = table[note - 1] * SEMITONE
    for note in range(68, -1, -1):
        table[note] = table[note + 1] / SEMITONE
    return table


# The pitch of each MIDI note, in hertz.
HZ = _frequencies()


def sine(phase: float) -> float:
    """sin(2π·phase) for a phase in [0, 1), within 0.1 %: a parabola and its
    correction, with + - * only."""
    x = phase + phase - 1.0
    y = 4.0 * x * (1.0 - abs(x))
    return -(0.225 * (y * abs(y) - y) + y)


def wrap(phase: float) -> float:
    """A phase back into [0, 1)."""
    phase -= int(phase)
    return phase + 1.0 if phase < 0.0 else phase


def pole(hz: float) -> float:
    """The coefficient of a one-pole low-pass filter at about `hz`."""
    w = TWO_PI * hz / RATE
    return w / (1.0 + w)


def decay(seconds: float) -> float:
    """What a level is multiplied by at each sample to fall by e in `seconds`
    (near enough: 1 - 1/n instead of exp(-1/n))."""
    return 1.0 - 1.0 / (seconds * RATE)


def limit(x: float) -> float:
    """A soft limit: tanh, near enough, with + - * / only."""
    if x > 3.0:
        return 1.0
    if x < -3.0:
        return -1.0
    return x * (27.0 + x * x) / (27.0 + 9.0 * x * x)


def taper(sound: list[float], seconds: float = 0.01) -> Sound:
    """The end of a sound brought down to zero, so that it does not click."""
    n = min(len(sound), round(seconds * RATE))
    for i in range(n):
        sound[len(sound) - n + i] *= (n - i) / n
    return tuple(sound)


def oscillator(shape: str, hz: float, n: int) -> list[float]:
    """`n` samples of a saw, square, triangle or sine wave at `hz`; the saw
    and the square without the click of their jumps (PolyBLEP)."""
    step = hz / RATE
    top = 1.0 - step
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        phase += step
        if phase >= 1.0:
            phase -= 1.0
        if shape == "saw":
            value = phase + phase - 1.0
            if phase < step:
                t = phase / step
                value -= t + t - t * t - 1.0
            elif phase > top:
                t = (phase - 1.0) / step
                value -= t * t + t + t + 1.0
        elif shape == "square":
            value = 1.0 if phase < 0.5 else -1.0
            for edge, sign in ((phase, 1.0), (wrap(phase + 0.5), -1.0)):
                if edge < step:
                    t = edge / step
                    value += sign * (t + t - t * t - 1.0)
                elif edge > top:
                    t = (edge - 1.0) / step
                    value += sign * (t * t + t + t + 1.0)
        elif shape == "triangle":
            value = 4.0 * phase - 1.0 if phase < 0.5 else 3.0 - 4.0 * phase
        else:
            value = sine(phase)
        out[i] = value
    return out


@cache
def voice(
    note: int,
    seconds: float,
    shape: str = "saw",
    cutoff: float = 2000.0,
    cutoff_end: float | None = None,
    attack: float = 0.005,
    release: float = 0.05,
    fade: float | None = None,
    sustain: float = 1.0,
    unison: int = 1,
    spread: float = 0.006,
    drive: float = 0.0,
) -> Sound:
    """A note of a synthesizer: `unison` waves spread around the pitch (a
    supersaw), distorted by `drive`, through a two-pole low-pass filter
    whose cutoff moves from `cutoff` to `cutoff_end`, with a straight
    attack, a fall to `sustain` over `fade` seconds and a straight release
    at the end."""
    n = round(seconds * RATE)
    raw = [0.0] * n
    for k in range(unison):
        offset = 1.0 if unison == 1 else 1.0 + spread * (2.0 * k / (unison - 1) - 1.0)
        wave_k = oscillator(shape, HZ[note] * offset, n)
        for i in range(n):
            raw[i] += wave_k[i] / unison
    if drive > 0.0:
        raw = [limit(x * drive) for x in raw]
    a = pole(cutoff)
    step_a = (pole(cutoff if cutoff_end is None else cutoff_end) - a) / n
    first = 0.0
    second = 0.0
    rise = max(1.0, attack * RATE)
    fall = max(1.0, release * RATE)
    tail_from = n - fall
    keep = 1.0 if fade is None else decay(fade)
    above = 1.0
    out = [0.0] * n
    for i in range(n):
        first += a * (raw[i] - first)
        second += a * (first - second)
        a += step_a
        level = sustain + (1.0 - sustain) * above
        above *= keep
        if i < rise:
            level *= i / rise
        if i > tail_from:
            level *= (n - i) / fall
        out[i] = second * level
    return tuple(out)


@cache
def guitar(notes: tuple[int, ...], seconds: float, muted: bool) -> Sound:
    """A distorted electric guitar: the notes' saws together, clipped hard,
    then filtered; `muted` is the short, dark palm-muted chop."""
    n = round(seconds * RATE)
    raw = [0.0] * n
    for note in notes:
        for detune in (0.997, 1.003):
            wave_k = oscillator("saw", HZ[note] * detune, n)
            for i in range(n):
                raw[i] += wave_k[i]
    clipped = [limit(x * 2.5) for x in raw]
    a = pole(1300.0 if muted else 3800.0)
    step_a = (pole(500.0 if muted else 1600.0) - a) / n
    keep = decay(0.07 if muted else 1.2)
    sustain = 0.0 if muted else 0.35
    first = 0.0
    second = 0.0
    above = 1.0
    out = [0.0] * n
    for i in range(n):
        first += a * (clipped[i] - first)
        second += a * (first - second)
        a += step_a
        level = sustain + (1.0 - sustain) * above
        above *= keep
        if i < 100:
            level *= i / 100
        out[i] = second * level
    return taper(out)


@cache
def keys(
    note: int,
    seconds: float,
    bright: float = 1.2,
    ratio: float = 1.0,
    fade: float = 1.1,
) -> Sound:
    """An electric piano, or a bell with a higher `ratio`: a sine bent by
    another (FM), the bend fading faster than the note."""
    n = round(seconds * RATE)
    out = [0.0] * n
    step = HZ[note] / RATE
    carrier = 0.0
    modulator = 0.0
    tine = 0.0
    level = 1.0
    index = bright
    keep_level = decay(fade)
    keep_index = decay(0.25)
    keep_tine = decay(0.04)
    tine_level = 0.25
    fall = round(0.08 * RATE)
    for i in range(n):
        carrier += step
        if carrier >= 1.0:
            carrier -= 1.0
        modulator = wrap(modulator + ratio * step)
        tine += 7.0 * step
        if tine >= 1.0:
            tine -= 1.0
        value = sine(wrap(carrier + index * sine(modulator) * 0.25))
        value += tine_level * sine(tine)
        if i < 40:
            value *= i / 40
        if i > n - fall:
            value *= (n - i) / fall
        out[i] = value * level
        level *= keep_level
        index *= keep_index
        tine_level *= keep_tine
    return tuple(out)


@cache
def kick(
    seconds: float = 0.4,
    high: float = 150.0,
    low: float = 48.0,
    drop: float = 0.03,
    fade: float = 0.2,
    seed: int = 1,
    click: float = 0.3,
    drive: float = 0.0,
) -> Sound:
    """A drum with a falling pitch: kicks, toms, an 808, the boom of the
    hit; `drive` saturates it, which a phone's speaker hears better."""
    n = round(seconds * RATE)
    out = [0.0] * n
    phase = 0.0
    pitch = 1.0
    level = 1.0
    keep_pitch = decay(drop)
    keep_level = decay(fade)
    span = high - low
    state = seed
    clicks = round(0.004 * RATE)
    for i in range(n):
        phase += (low + span * pitch) / RATE
        if phase >= 1.0:
            phase -= 1.0
        value = sine(phase) * level
        if i < clicks:
            state = (state * 1_664_525 + 1_013_904_223) & 0xFFFF_FFFF
            noise = state / 2_147_483_648.0 - 1.0
            value += click * noise * (clicks - i) / clicks
        if drive > 0.0:
            value = limit(value * drive)
        out[i] = value
        pitch *= keep_pitch
        level *= keep_level
    return taper(out)


@cache
def hiss(
    seconds: float,
    fade: float,
    low_cut: float,
    high_cut: float,
    seed: int,
    attack: float = 0.001,
    high_cut_end: float | None = None,
) -> Sound:
    """Noise between two cutoffs that fades: hats, snares, crashes. With
    `high_cut_end`, the top cutoff moves there (a riser)."""
    n = round(seconds * RATE)
    out = [0.0] * n
    state = seed
    top = 0.0
    bottom = 0.0
    a_low = pole(low_cut)
    a_high = pole(high_cut)
    step_high = (pole(high_cut if high_cut_end is None else high_cut_end) - a_high) / n
    level = 1.0
    keep = decay(fade)
    rise = max(1.0, attack * RATE)
    for i in range(n):
        state = (state * 1_664_525 + 1_013_904_223) & 0xFFFF_FFFF
        x = state / 2_147_483_648.0 - 1.0
        top += a_high * (x - top)
        bottom += a_low * (top - bottom)
        a_high += step_high
        value = (top - bottom) * level
        if i < rise:
            value *= i / rise
        out[i] = value
        level *= keep
    return taper(list(out))


@cache
def snare(
    seed: int, fade: float = 0.09, body: float = 190.0, seconds: float = 0.32
) -> Sound:
    """Noise and a short tone under it."""
    noise = hiss(seconds, fade, 1200.0, 9000.0, seed)
    tone = kick(0.18, body * 1.4, body, 0.01, 0.045, seed + 1)
    return taper(
        [n + 0.6 * tone[i] if i < len(tone) else n for i, n in enumerate(noise)]
    )


@cache
def clap(seed: int) -> Sound:
    """Three short bursts, then a tail."""
    out = list(hiss(0.3, 0.07, 1000.0, 7000.0, seed))
    for k, at in enumerate((0.0, 0.011, 0.022)):
        burst = hiss(0.012, 0.004, 1000.0, 7000.0, seed + 7 * (k + 1))
        start = round(at * RATE)
        for i, value in enumerate(burst):
            out[start + i] += 0.9 * value
    return tuple(out)


def hat(seed: int = 3) -> Sound:
    return hiss(0.06, 0.018, 7000.0, 16000.0, seed)


def open_hat(seed: int = 5) -> Sound:
    return hiss(0.3, 0.1, 6500.0, 16000.0, seed)


def shaker(seed: int = 9) -> Sound:
    return hiss(0.08, 0.025, 5000.0, 12000.0, seed, 0.012)


def crash(seed: int = 13, seconds: float = 3.0) -> Sound:
    return hiss(seconds, 0.9, 3500.0, 15000.0, seed)


def riser(seconds: float, seed: int, top: float = 9000.0) -> Sound:
    """Noise that grows and brightens until it ends."""
    return hiss(seconds, 100.0, 200.0, 400.0, seed, seconds * 0.95, top)


def tom(note: int, seed: int = 17) -> Sound:
    return kick(0.45, HZ[note] * 1.6, HZ[note], 0.05, 0.22, seed, 0.2)


def punch() -> Sound:
    """The kick of the dance tracks: high, short, with a click."""
    return kick(0.35, 230.0, 52.0, 0.022, 0.16, 1, 0.45, 1.4)


def boom() -> Sound:
    """The low hit when the drawing is whole."""
    return kick(2.5, 120.0, 38.0, 0.1, 0.8, 19, 0.5, 1.6)


def eight_o_eight(note: int, seconds: float) -> Sound:
    """A long, tuned, saturated kick: the bass of trap."""
    return kick(seconds, HZ[note] * 2.5, HZ[note], 0.03, 0.6, 23, 0.4, 2.2)


class Mix:
    """Where the sounds go: left and right, a part ducked under the kicks
    («pumped»), and what is sent to the room and to the echo."""

    def __init__(self, duck: float = 0.0, duck_fade: float = 0.1) -> None:
        self.left = [0.0] * FRAMES
        self.right = [0.0] * FRAMES
        self.pumped_left = [0.0] * FRAMES
        self.pumped_right = [0.0] * FRAMES
        self.room = [0.0] * FRAMES
        self.echo = [0.0] * FRAMES
        self.kicks: list[float] = []
        self.duck = duck
        self.duck_fade = duck_fade

    def add(
        self,
        at: float,
        sound: Sound,
        gain: float,
        pan: float = 0.0,
        room: float = 0.0,
        echo: float = 0.0,
        pumped: bool = False,
    ) -> None:
        """`sound` from `at` seconds; `pan` from -1 (left) to 1 (right)."""
        start = round(at * RATE)
        first = max(0, start)
        end = min(FRAMES, start + len(sound))
        left = self.pumped_left if pumped else self.left
        right = self.pumped_right if pumped else self.right
        to_left = gain * (1.0 - pan)
        to_right = gain * (1.0 + pan)
        for i in range(first, end):
            value = sound[i - start]
            left[i] += value * to_left
            right[i] += value * to_right
        for send, amount in ((self.room, room), (self.echo, echo)):
            if amount > 0.0:
                level = gain * amount
                for i in range(first, end):
                    send[i] += sound[i - start] * level

    def kick(self, at: float, sound: Sound, gain: float) -> None:
        """A kick, which the pumped part ducks under."""
        self.add(at, sound, gain)
        self.kicks.append(at)

    def chord(
        self,
        at: float,
        notes: Sequence[int],
        make: Callable[[int], Sound],
        gain: float,
        width: float = 0.4,
        room: float = 0.0,
        echo: float = 0.0,
        pumped: bool = False,
    ) -> None:
        """Each note of a chord, spread from left to right."""
        for k, note in enumerate(notes):
            pan = 0.0 if len(notes) == 1 else width * (2.0 * k / (len(notes) - 1) - 1.0)
            self.add(at, make(note), gain, pan, room, echo, pumped)

    def pumped(self) -> tuple[list[float], list[float]]:
        """The pumped part, ducked at each kick and let back up."""
        keep = decay(self.duck_fade)
        hits = sorted(round(at * RATE) for at in self.kicks)
        duck = 0.0
        k = 0
        left = [0.0] * FRAMES
        right = [0.0] * FRAMES
        for i in range(FRAMES):
            while k < len(hits) and i >= hits[k]:
                duck = 1.0
                k += 1
            gain = 1.0 - self.duck * duck
            left[i] = self.pumped_left[i] * gain
            right[i] = self.pumped_right[i] * gain
            duck *= keep
        return left, right


def reverb(send: Sequence[float]) -> tuple[list[float], list[float]]:
    """A small room (Schroeder, as Freeverb): four damped combs, then two
    all-pass filters for each side."""
    c1, c2, c3, c4 = ([0.0] * size for size in (1557, 1617, 1491, 1422))
    n1, n2, n3, n4 = len(c1), len(c2), len(c3), len(c4)
    i1 = i2 = i3 = i4 = 0
    s1 = s2 = s3 = s4 = 0.0
    l1, l2, r1, r2 = ([0.0] * size for size in (556, 441, 579, 464))
    j1 = j2 = k1 = k2 = 0
    feedback = 0.8
    damp = 0.3
    keep = 1.0 - damp
    left = [0.0] * FRAMES
    right = [0.0] * FRAMES
    for i in range(FRAMES):
        x = send[i] * 0.2
        v1 = c1[i1]
        s1 = v1 * keep + s1 * damp
        c1[i1] = x + s1 * feedback
        i1 = i1 + 1 if i1 + 1 < n1 else 0
        v2 = c2[i2]
        s2 = v2 * keep + s2 * damp
        c2[i2] = x + s2 * feedback
        i2 = i2 + 1 if i2 + 1 < n2 else 0
        v3 = c3[i3]
        s3 = v3 * keep + s3 * damp
        c3[i3] = x + s3 * feedback
        i3 = i3 + 1 if i3 + 1 < n3 else 0
        v4 = c4[i4]
        s4 = v4 * keep + s4 * damp
        c4[i4] = x + s4 * feedback
        i4 = i4 + 1 if i4 + 1 < n4 else 0
        wet = v1 + v2 + v3 + v4
        held = l1[j1]
        l1[j1] = wet + held * 0.5
        y = held - wet
        j1 = j1 + 1 if j1 + 1 < 556 else 0
        held = l2[j2]
        l2[j2] = y + held * 0.5
        left[i] = held - y
        j2 = j2 + 1 if j2 + 1 < 441 else 0
        held = r1[k1]
        r1[k1] = wet + held * 0.5
        y = held - wet
        k1 = k1 + 1 if k1 + 1 < 579 else 0
        held = r2[k2]
        r2[k2] = y + held * 0.5
        right[i] = held - y
        k2 = k2 + 1 if k2 + 1 < 464 else 0
    return left, right


def ping_pong(
    send: Sequence[float], delay_s: float, feedback: float
) -> tuple[list[float], list[float]]:
    """An echo that goes right, then left, then right, each time quieter."""
    d = round(delay_s * RATE)
    left = [0.0] * FRAMES
    right = [0.0] * FRAMES
    line_left = [0.0] * FRAMES
    line_right = [0.0] * FRAMES
    for i in range(FRAMES):
        back_right = line_right[i - d] if i >= d else 0.0
        back_left = line_left[i - d] if i >= d else 0.0
        line_left[i] = send[i] + feedback * back_right
        line_right[i] = back_left
        left[i] = feedback * back_right
        right[i] = back_left
    return left, right


def master(mix: Mix, echo_s: float, drive: float) -> bytes:
    """Everything together: the pumped part, the room and the echo, a soft
    limit, the loudest sample at PEAK, the start and the end faded, as
    16-bit stereo."""
    pumped_left, pumped_right = mix.pumped()
    room_left, room_right = reverb(mix.room)
    echo_left, echo_right = ping_pong(mix.echo, echo_s, 0.35)
    left = [0.0] * FRAMES
    right = [0.0] * FRAMES
    for i in range(FRAMES):
        wet_left = pumped_left[i] + room_left[i] + echo_left[i]
        wet_right = pumped_right[i] + room_right[i] + echo_right[i]
        left[i] = limit((mix.left[i] + wet_left) * drive)
        right[i] = limit((mix.right[i] + wet_right) * drive)
    loudest = max(max(map(abs, left)), max(map(abs, right)))
    scale = PEAK / loudest
    fade_in = round(0.004 * RATE)
    fade_out = round(FADE_S * RATE)
    samples = array("h", bytes(4 * FRAMES))
    for i in range(FRAMES):
        gain = scale
        if i < fade_in:
            gain *= i / fade_in
        to_end = FRAMES - i
        if to_end < fade_out:
            share = to_end / fade_out
            gain *= share * share
        samples[2 * i] = round(left[i] * gain * 32767.0)
        samples[2 * i + 1] = round(right[i] * gain * 32767.0)
    if sys.byteorder == "big":
        samples.byteswap()
    return samples.tobytes()


def beats(bpm: float) -> Callable[[float], float]:
    """The time of a beat, counted from when the line starts (beat 0): the
    tempos are those where the hit at 9 s falls on the first beat of a
    bar."""
    length = 60.0 / bpm

    def at(beat: float) -> float:
        return DRAW_S + beat * length

    return at


def roll(
    mix: Mix, start: float, end: float, count: int, sound: Sound, top: float
) -> None:
    """Hits evenly from `start` to `end` seconds, growing to `top`."""
    for k in range(count):
        share = (k + 1) / count
        mix.add(start + (end - start) * k / count, sound, top * share, room=0.2)


def whole(mix: Mix, root: int, gain: float = 1.0) -> None:
    """The drawing is whole: the boom, a crash and the low root ringing."""
    mix.add(HIT_S, boom(), 0.9 * gain, room=0.2)
    mix.add(HIT_S, crash(), 0.35 * gain, room=0.4)
    low = voice(root, 3.0, "saw", 700.0, 150.0, 0.005, 0.6, 0.9, 0.2)
    mix.add(HIT_S, low, 0.3 * gain)
    mix.add(
        HIT_S, voice(root - 12, 3.0, "sine", 300.0, None, 0.005, 0.6, 1.0), 0.4 * gain
    )


def energy() -> bytes:
    """150 beats a minute in A minor (Am, F, C, G): four on the floor, a bass
    on the off-beats ducked under the kick, supersaw stabs; a snare roll and
    a riser into the line and into the hit, then A minor ringing."""
    at = beats(150.0)
    mix = Mix(duck=0.7, duck_fade=0.09)
    bars = [
        (45, (57, 60, 64)),
        (41, (57, 60, 65)),
        (48, (55, 60, 64)),
        (43, (55, 59, 62)),
        (43, (55, 59, 62)),
    ]
    for b in range(18):
        mix.kick(at(b), punch(), 0.9)
    riff = ((0.0, 2), (0.75, 2), (1.5, 1), (2.25, 2), (3.0, 3), (3.5, 1))
    for bar, (root, notes) in enumerate(bars):
        start = 4 * bar
        for b in range(4):
            if bar < 4 and b % 2 == 1:
                mix.add(at(start + b), clap(11), 0.45, room=0.25)
            mix.add(at(start + b + 0.5), open_hat(), 0.2, 0.2)
            for sixteenth in (0.25, 0.75):
                mix.add(at(start + b + sixteenth), hat(), 0.09, -0.3)
            if bar < 4 or b < 2:
                bass = voice(root, 0.2, "saw", 2600.0, 400.0, 0.002, 0.03, 0.1, 0.35, 2)
                mix.add(at(start + b + 0.5), bass, 0.3, pumped=True)
                sub = voice(root - 12, 0.2, "sine", 400.0, None, 0.002, 0.03)
                mix.add(at(start + b + 0.5), sub, 0.4, pumped=True)
        mix.chord(
            at(start),
            notes,
            lambda n: voice(n, 1.7, "saw", 1500.0, 2500.0, 0.05, 0.2, unison=2),
            0.05,
            room=0.4,
            pumped=True,
        )
        if bar < 4:
            tones = (notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24)
            for beat, k in riff:
                stab = voice(
                    tones[k], 0.22, "saw", 4200.0, 1400.0, 0.002, 0.06, 0.15, 0.3, 3
                )
                mix.add(at(start + beat), stab, 0.13, room=0.3, echo=0.2, pumped=True)
                under = voice(
                    tones[k] - 12,
                    0.22,
                    "saw",
                    3000.0,
                    1000.0,
                    0.002,
                    0.06,
                    0.15,
                    0.3,
                    2,
                )
                mix.add(at(start + beat), under, 0.07, room=0.2, pumped=True)
    # Into the hit: a roll and a riser over the last two beats.
    roll(mix, at(18), at(20), 8, snare(21, 0.05), 0.5)
    mix.add(at(16), riser(1.6, 31, 10000.0), 0.3, room=0.3)
    # Into the line.
    roll(mix, 0.0, DRAW_S, 10, snare(21, 0.05), 0.4)
    mix.add(0.0, riser(1.0, 32), 0.3, room=0.3)
    # The drawing is whole.
    whole(mix, 45)
    mix.kicks.append(HIT_S)
    mix.chord(
        HIT_S,
        (57, 60, 64, 69, 72),
        lambda n: voice(n, 3.0, "saw", 3000.0, 600.0, 0.01, 0.6, 1.2, 0.2, 3),
        0.06,
        room=0.6,
    )
    for s, note in enumerate((81, 76, 72, 69, 76, 72, 69, 64)):
        pluck = voice(note, 0.3, "square", 2600.0, 500.0, 0.002, 0.1, 0.15, 0.0)
        mix.add(
            HIT_S + 0.2 * s, pluck, 0.1 * (1.0 - s / 9.0), (-0.3, 0.3)[s % 2], 0.3, 0.4
        )
    return master(mix, 0.3, 1.8)


def chill() -> bytes:
    """90 beats a minute in F (Fmaj7, Am7, B♭maj7 and C9): a hard swung
    beat, a round bass, an electric piano and a small tune; a drum fill into
    the line, and F major 9 when the drawing is whole."""
    at = beats(90.0)
    mix = Mix()
    bars = [
        ((41,), (57, 60, 64, 65)),
        ((45,), (55, 60, 64, 67)),
        ((46, 48), (57, 62, 65, 69), (58, 62, 64, 67)),
    ]
    swing = 0.17
    for bar, (roots, *voicings) in enumerate(bars):
        start = 4 * bar
        for b, gain in ((0.0, 0.9), (1.75, 0.5), (2.5, 0.8)):
            mix.kick(
                at(start + b), kick(0.4, 160.0, 50.0, 0.03, 0.18, 1, 0.4, 1.3), gain
            )
        for b in (1, 3):
            mix.add(at(start + b), snare(51, 0.11, 200.0), 0.5, 0.1, room=0.3)
        mix.add(at(start + 2.75), snare(52, 0.04, 220.0), 0.08, -0.1)
        for e in range(8):
            time = at(start + e / 2.0 + (swing if e % 2 else 0.0))
            mix.add(time, hat(), 0.16 if e % 2 else 0.1, -0.3)
        mix.add(at(start + 3.5 + swing), open_hat(), 0.12, 0.3)
        line = ((0.0, 0, 1.3), (1.75, 12, 0.5), (2.5, 7, 1.0))
        for k, root in enumerate(roots):
            for beat, step, length in (
                line if len(roots) == 1 else ((0.0, 0, 1.3), (1.0, 12, 0.6))
            ):
                note = root + step
                seconds = length * 0.6667
                mix.add(
                    at(start + 2 * k + beat),
                    voice(
                        note, seconds, "triangle", 1400.0, 500.0, 0.005, 0.1, 0.5, 0.5
                    ),
                    0.45,
                )
                mix.add(
                    at(start + 2 * k + beat),
                    voice(note, seconds, "saw", 900.0, 300.0, 0.005, 0.1, 0.3, 0.3),
                    0.15,
                )
        for k, notes in enumerate(voicings):
            hit = start + 2 * k
            length = 1.6 if len(voicings) == 1 else 1.3
            mix.chord(
                at(hit),
                notes,
                lambda n, s=length: keys(n, s),
                0.1,
                room=0.45,
                echo=0.12,
            )
            if len(voicings) == 1:
                mix.chord(
                    at(start + 2.5),
                    notes[1:],
                    lambda n: keys(n, 0.7, 0.8),
                    0.07,
                    room=0.4,
                )
    tune = (
        (0.5, 72, 0.5),
        (1.0, 74, 0.5),
        (1.5, 76, 1.0),
        (3.0, 72, 0.5),
        (3.5, 74, 0.5),
        (4.0, 76, 1.0),
        (5.5, 79, 0.5),
        (6.0, 76, 1.0),
        (7.0, 74, 1.0),
        (8.0, 74, 1.0),
        (9.0, 72, 0.5),
        (9.5, 69, 0.5),
        (10.0, 72, 1.0),
        (11.0, 74, 1.0),
    )
    for beat, note, length in tune:
        mix.add(
            at(beat),
            keys(note, length * 0.6667 + 0.2, 1.6, 2.0, 0.8),
            0.12,
            0.15,
            0.4,
            0.3,
        )
    # Into the line: a fill and the first chord swelling in.
    for beat, gain in ((-1.0, 0.25), (-0.5, 0.35), (-0.25, 0.45)):
        mix.add(at(beat), snare(53, 0.08, 200.0), gain, room=0.3)
    mix.chord(
        0.0,
        (53, 57, 60, 64),
        lambda n: voice(n, 1.2, "saw", 300.0, 1400.0, 0.9, 0.2, unison=2),
        0.05,
        room=0.5,
    )
    mix.add(0.0, riser(1.0, 54, 7000.0), 0.15, room=0.4)
    # The drawing is whole.
    whole(mix, 41, 0.8)
    mix.chord(
        HIT_S,
        (57, 60, 64, 67, 72),
        lambda n: keys(n, 3.0, 1.0),
        0.1,
        room=0.55,
        echo=0.15,
    )
    mix.chord(
        HIT_S,
        (53, 57, 60, 64, 67),
        lambda n: voice(n, 3.0, "saw", 900.0, 400.0, 0.05, 1.0, unison=2),
        0.04,
        room=0.6,
    )
    for s, note in enumerate((84, 79, 76, 72)):
        mix.add(
            HIT_S + 0.3 + 0.4 * s,
            keys(note, 1.2, 1.4, 2.0, 0.6),
            0.08,
            (0.3, -0.3)[s % 2],
            0.6,
            0.4,
        )
    return master(mix, 0.5, 1.7)


def epic() -> bytes:
    """120 beats a minute in D minor (Dm, B♭, Gm, A): big drums, strings in
    sixteenths, horns; a drum roll into the line, and D major when the
    drawing is whole."""
    at = beats(120.0)
    mix = Mix()
    bars = [
        (38, (50, 57, 62, 65), ((0.0, 69, 2.0), (2.0, 74, 2.0))),
        (34, (50, 58, 62, 65), ((0.0, 77, 3.0), (3.0, 74, 1.0))),
        (31, (50, 55, 62, 70), ((0.0, 70, 2.0), (2.0, 74, 2.0))),
        (33, (49, 57, 61, 64), ((0.0, 73, 2.0), (2.0, 76, 2.0))),
    ]
    strings = (0, 0, 12, 0, 7, 0, 12, 7, 0, 0, 12, 0, 7, 12, 7, 0)
    for bar, (root, notes, tune) in enumerate(bars):
        start = 4 * bar
        for b, gain in ((0.0, 0.9), (1.0, 0.5), (1.5, 0.5), (2.0, 0.9), (3.0, 0.6)):
            mix.kick(
                at(start + b), kick(0.7, 140.0, 58.0, 0.06, 0.3, 1000, 0.3, 1.4), gain
            )
        mix.add(at(start + 2), snare(1100, 0.13, 170.0), 0.45, room=0.6)
        if bar == 3:
            for s in range(16):
                drum = tom(50 - s // 4, 1200 + s % 2)
                mix.add(
                    at(start + s / 4.0), drum, 0.15 + 0.03 * s, (-0.3, 0.3)[s % 2], 0.4
                )
        for s, step in enumerate(strings):
            string = voice(
                root + 24 + step, 0.12, "saw", 3000.0, 900.0, 0.004, 0.04, 0.08, 0.3, 2
            )
            mix.add(at(start + s / 4.0), string, 0.11, (-0.25, 0.25)[s % 2], 0.35)
        mix.add(
            at(start), voice(root, 2.1, "saw", 600.0, 300.0, 0.02, 0.2, 1.5, 0.6), 0.28
        )
        mix.add(at(start), voice(root, 2.1, "sine", 300.0, None, 0.02, 0.2), 0.35)
        mix.chord(
            at(start),
            notes,
            lambda n: voice(n, 2.15, "saw", 900.0, 1400.0, 0.15, 0.3, unison=2),
            0.05,
            room=0.6,
        )
        for beat, note, length in tune:
            seconds = length * 0.5 + 0.08
            for octave, gain in ((0, 0.12), (-12, 0.09)):
                horn = voice(
                    note + octave, seconds, "saw", 700.0, 2600.0, 0.06, 0.15, unison=2
                )
                mix.add(at(start + beat), horn, gain, room=0.5, echo=0.1)
    roll(mix, 0.0, DRAW_S, 16, tom(38, 1400), 0.6)
    mix.add(0.0, riser(1.0, 1500, 8000.0), 0.3, room=0.4)
    whole(mix, 38, 1.2)
    mix.chord(
        HIT_S,
        (50, 57, 62, 66, 69),
        lambda n: voice(n, 3.0, "saw", 1600.0, 600.0, 0.03, 1.0, 1.5, 0.3, 2),
        0.07,
        room=0.6,
    )
    for note in (74, 78, 62):
        mix.add(
            HIT_S,
            voice(note, 3.0, "saw", 900.0, 2000.0, 0.04, 1.0, 1.8, 0.4, 2),
            0.1,
            room=0.6,
            echo=0.1,
        )
    return master(mix, 0.375, 1.6)


def sprint() -> bytes:
    """180 beats a minute, drum and bass in F minor (Fm, D♭, A♭, E♭): a
    two-step beat, a wide distorted bass, chord stabs and a lead; a snare
    roll into the line and into the hit, then F minor."""
    at = beats(180.0)
    mix = Mix()
    bars = [
        (41, (53, 56, 60)),
        (37, (53, 56, 61)),
        (44, (51, 56, 60)),
        (39, (51, 55, 58)),
        (41, (53, 56, 60)),
        (39, (51, 55, 58)),
    ]
    lead = (72, 75, 77, 80, 77, 75, 72, 70)
    for bar, (root, notes) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 2.5):
            mix.kick(at(start + b), punch(), 0.85)
        for b in (1, 3):
            if bar < 5 or b == 1:
                mix.add(at(start + b), snare(61, 0.08, 220.0), 0.55, room=0.25)
        for b in (1.75, 3.25):
            mix.add(at(start + b), snare(62, 0.03, 240.0), 0.1, 0.2)
        for e in range(8):
            mix.add(at(start + e / 2.0), hat(), 0.13 if e % 2 else 0.08, 0.3)
        reese = voice(
            root,
            1.36,
            "saw",
            1000.0,
            500.0,
            0.01,
            0.05,
            unison=2,
            spread=0.012,
            drive=1.6,
        )
        mix.add(at(start), reese, 0.3)
        mix.add(at(start), voice(root - 12, 1.36, "sine", 300.0, None, 0.01, 0.05), 0.4)
        mix.chord(
            at(start),
            notes,
            lambda n: voice(n + 12, 1.36, "saw", 1800.0, 2400.0, 0.05, 0.2, unison=2),
            0.04,
            room=0.5,
        )
        if bar % 2 == 0:
            for beat in (0.5, 2.0):
                mix.chord(
                    at(start + beat),
                    notes,
                    lambda n: voice(
                        n + 12, 0.2, "square", 3500.0, 900.0, 0.002, 0.05, 0.1, 0.2
                    ),
                    0.06,
                    room=0.3,
                    echo=0.3,
                )
        if 1 <= bar <= 4:
            for e, note in enumerate(lead if bar % 2 else lead[::-1]):
                pluck = voice(
                    note, 0.16, "square", 3000.0, 700.0, 0.002, 0.04, 0.1, 0.1
                )
                mix.add(at(start + e / 2.0), pluck, 0.07, (-0.3, 0.3)[e % 2], 0.25, 0.3)
    roll(mix, at(22), at(24), 8, snare(63, 0.05, 230.0), 0.55)
    mix.add(at(20), riser(1.333, 64, 10000.0), 0.3, room=0.3)
    roll(mix, 0.0, DRAW_S, 12, snare(63, 0.05, 230.0), 0.4)
    mix.add(0.0, riser(1.0, 65), 0.3, room=0.3)
    whole(mix, 41)
    mix.add(
        HIT_S,
        voice(41, 3.0, "saw", 1000.0, 300.0, 0.01, 0.8, 1.0, 0.3, 2, 0.012, 1.6),
        0.3,
    )
    mix.chord(
        HIT_S,
        (53, 56, 60, 65, 68),
        lambda n: voice(n, 3.0, "saw", 2600.0, 600.0, 0.01, 0.8, 1.2, 0.2, 3),
        0.06,
        room=0.6,
    )
    return master(mix, 0.25, 1.8)


def rock() -> bytes:
    """150 beats a minute in E minor (E5, C5, G5, D5): drums, distorted
    guitars in palm-muted eighths, the bass under them and a lead; a tom
    fill into the line, and the E chord ringing when the drawing is
    whole."""
    at = beats(150.0)
    mix = Mix()
    bars = [
        (40, (40, 47, 52)),
        (48, (48, 55, 60)),
        (43, (43, 50, 55)),
        (50, (50, 57, 62)),
        (40, (40, 47, 52)),
    ]
    leads = {
        2: ((0.0, 71, 1.0), (1.0, 74, 0.5), (1.5, 71, 0.5), (2.0, 69, 2.0)),
        3: ((0.0, 67, 1.0), (1.0, 69, 1.0), (2.0, 66, 1.0), (3.0, 64, 1.0)),
    }
    for bar, (root, chord_notes) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 2.0, 2.5):
            mix.kick(
                at(start + b), kick(0.35, 180.0, 55.0, 0.025, 0.15, 1, 0.5, 1.2), 0.85
            )
        for b in (1, 3):
            mix.add(at(start + b), snare(71, 0.1, 180.0), 0.6, room=0.3)
        for e in range(8):
            mix.add(
                at(start + e / 2.0), hiss(0.08, 0.03, 6000.0, 14000.0, 72), 0.14, 0.35
            )
        mix.add(at(start), crash(73, 1.5), 0.12, -0.3, 0.3)
        open_chord = guitar(chord_notes, 0.4, False)
        muted = guitar(chord_notes, 0.13, True)
        for side, delay in ((-0.6, 0.0), (0.6, 0.012)):
            mix.add(at(start) + delay, open_chord, 0.16, side)
            for e in range(1, 8):
                build = 1.0 + (0.08 * e if bar == 4 else 0.0)
                mix.add(
                    at(start + e / 2.0) + delay,
                    muted if bar < 4 else open_chord,
                    0.15 * build,
                    side,
                )
        for e in range(8):
            bass = voice(
                root - 12, 0.18, "square", 900.0, 400.0, 0.003, 0.03, 0.12, 0.5
            )
            mix.add(at(start + e / 2.0), bass, 0.25)
        for beat, note, length in leads.get(bar, ()):
            sound = guitar((note,), length * 0.4 + 0.05, False)
            mix.add(at(start + beat), sound, 0.13, 0.1, 0.3, 0.2)
    roll(mix, at(18), at(20), 8, snare(74, 0.06, 190.0), 0.55)
    for k in range(10):
        mix.add(k * 0.1, tom(52 - 2 * k, 75), 0.2 + 0.05 * k, (-0.4, 0.4)[k % 2], 0.3)
    mix.add(0.0, riser(1.0, 76, 6000.0), 0.15, room=0.3)
    whole(mix, 40)
    for side, delay in ((-0.6, 0.0), (0.6, 0.012)):
        mix.add(
            HIT_S + delay, guitar((40, 47, 52, 56, 59), 3.0, False), 0.18, side, 0.3
        )
    return master(mix, 0.3, 1.6)


def funk() -> bytes:
    """120 beats a minute in E minor (Em7, A7, B7): a busy beat with ghost
    notes, a slapped bass, a clavinet and horn stabs; a fill into the line,
    and E minor 9 from the horns when the drawing is whole."""
    at = beats(120.0)
    mix = Mix()
    bars = [
        (40, (62, 64, 67)),
        (40, (62, 64, 67)),
        (45, (61, 64, 67)),
        (47, (63, 66, 69)),
    ]
    slap = (
        (0.0, 0, 0.25),
        (0.5, 12, 0.15),
        (0.75, 0, 0.2),
        (1.5, 10, 0.2),
        (2.0, 0, 0.25),
        (2.5, 3, 0.2),
        (2.75, 5, 0.2),
        (3.25, 7, 0.2),
        (3.5, 12, 0.15),
    )
    for bar, (root, notes) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 0.75, 2.5):
            mix.kick(
                at(start + b), kick(0.35, 170.0, 52.0, 0.025, 0.15, 1, 0.4, 1.2), 0.85
            )
        for b in (1, 3):
            mix.add(at(start + b), snare(81, 0.07, 210.0), 0.5, room=0.2)
        for b in (1.75, 2.25, 3.75):
            mix.add(at(start + b), snare(82, 0.03, 230.0), 0.09, 0.15)
        for s in range(16):
            if s != 14:
                mix.add(at(start + s / 4.0), hat(), 0.13 if s % 2 == 0 else 0.06, 0.3)
        mix.add(at(start + 3.5), open_hat(), 0.14, 0.3)
        for beat, step, length in slap:
            note = root + step
            seconds = length * 0.5
            pop = step >= 10
            thumb = voice(
                note,
                seconds,
                "saw",
                4500.0 if pop else 3000.0,
                300.0,
                0.001,
                0.03,
                0.08,
                0.4,
            )
            mix.add(at(start + beat), thumb, 0.3)
            mix.add(
                at(start + beat),
                voice(note - 12, seconds, "sine", 300.0, None, 0.001, 0.03),
                0.3,
            )
        for beat in (0.5, 1.25, 2.0, 2.75, 3.5):
            mix.chord(
                at(start + beat),
                notes,
                lambda n: voice(
                    n, 0.09, "square", 5000.0, 1200.0, 0.001, 0.02, 0.05, 0.2
                ),
                0.05,
                0.5,
            )
        if bar % 2 == 1:
            mix.chord(
                at(start + 3.5),
                notes,
                lambda n: voice(
                    n + 12, 0.2, "saw", 3200.0, 1500.0, 0.01, 0.05, unison=2
                ),
                0.08,
                room=0.4,
            )
    roll(mix, 0.0, DRAW_S, 8, snare(83, 0.05, 220.0), 0.5)
    for k, note in enumerate((50, 48, 45, 43)):
        mix.add(0.5 + 0.125 * k, tom(note, 84), 0.3, (-0.3, 0.3)[k % 2], 0.3)
    mix.chord(
        0.2,
        (64, 67, 71),
        lambda n: voice(n, 0.8, "saw", 400.0, 3000.0, 0.6, 0.1, unison=2),
        0.07,
        room=0.4,
    )
    whole(mix, 40, 0.9)
    mix.chord(
        HIT_S,
        (64, 67, 71, 74, 78),
        lambda n: voice(n, 2.5, "saw", 3500.0, 900.0, 0.01, 0.6, 0.8, 0.25, 2),
        0.08,
        room=0.5,
        echo=0.1,
    )
    for beat, step, length in slap[:5]:
        mix.add(
            at(16 + beat),
            voice(
                40 + step, length * 0.5, "saw", 3000.0, 300.0, 0.001, 0.03, 0.08, 0.4
            ),
            0.25,
        )
    return master(mix, 0.375, 1.7)


def sunny() -> bytes:
    """120 beats a minute in C (F, G, Em, Am): four on the floor, claps,
    piano on the off-beats, a bouncing bass and a bell tune; claps into the
    line, and C major when the drawing is whole."""
    at = beats(120.0)
    mix = Mix(duck=0.35, duck_fade=0.1)
    bars = [
        (41, (57, 60, 65)),
        (43, (59, 62, 67)),
        (40, (59, 64, 67)),
        (45, (60, 64, 69)),
    ]
    tune = (
        (
            (0.0, 72, 0.5),
            (0.5, 77, 0.5),
            (1.0, 81, 1.0),
            (2.0, 79, 0.5),
            (2.5, 77, 0.5),
            (3.0, 72, 1.0),
        ),
        (
            (0.0, 74, 0.5),
            (0.5, 79, 0.5),
            (1.0, 83, 1.0),
            (2.0, 81, 0.5),
            (2.5, 79, 0.5),
            (3.0, 74, 1.0),
        ),
        (
            (0.0, 76, 0.5),
            (0.5, 79, 0.5),
            (1.0, 83, 1.5),
            (2.5, 79, 0.5),
            (3.0, 76, 1.0),
        ),
        (
            (0.0, 81, 1.0),
            (1.0, 79, 0.5),
            (1.5, 76, 0.5),
            (2.0, 72, 1.0),
            (3.0, 74, 1.0),
        ),
    )
    for bar, (root, notes) in enumerate(bars):
        start = 4 * bar
        for b in range(4):
            mix.kick(at(start + b), punch(), 0.7)
            if b % 2 == 1:
                mix.add(at(start + b), clap(91), 0.4, room=0.3)
                mix.add(at(start + b), snare(92, 0.07, 200.0), 0.2)
            mix.add(
                at(start + b + 0.5), hiss(0.1, 0.05, 6000.0, 16000.0, 93), 0.12, 0.35
            )
            mix.chord(
                at(start + b + 0.5),
                notes,
                lambda n: keys(n, 0.3, 1.6),
                0.07,
                room=0.3,
                pumped=True,
            )
        for s in range(16):
            mix.add(at(start + s / 4.0), shaker(), 0.07 if s % 2 else 0.04, -0.35)
        mix.chord(
            at(start), notes, lambda n: keys(n, 1.0, 1.4), 0.08, room=0.4, pumped=True
        )
        mix.chord(
            at(start),
            notes,
            lambda n: voice(n, 2.05, "saw", 1200.0, 1600.0, 0.1, 0.2, unison=2),
            0.03,
            room=0.5,
            pumped=True,
        )
        for e in range(8):
            note = root + (12 if e % 2 else 0)
            mix.add(
                at(start + e / 2.0),
                voice(note, 0.22, "triangle", 1800.0, 500.0, 0.003, 0.04, 0.15, 0.4),
                0.45,
                pumped=True,
            )
            mix.add(
                at(start + e / 2.0),
                voice(note, 0.22, "saw", 1200.0, 400.0, 0.003, 0.04, 0.12, 0.3),
                0.12,
                pumped=True,
            )
        for beat, note, length in tune[bar]:
            bell = keys(note, length * 0.5 + 0.25, 2.0, 2.0, 0.6)
            mix.add(at(start + beat), bell, 0.13, 0.1, 0.3, 0.25)
    roll(mix, 0.0, DRAW_S, 4, clap(94), 0.4)
    mix.add(0.0, riser(1.0, 95), 0.25, room=0.3)
    roll(mix, at(15), at(16), 4, snare(96, 0.05, 210.0), 0.4)
    whole(mix, 48, 0.9)
    mix.chord(HIT_S, (60, 64, 67, 72, 76), lambda n: keys(n, 3.0, 1.4), 0.1, room=0.5)
    mix.chord(
        HIT_S,
        (60, 64, 67, 72),
        lambda n: voice(n, 3.0, "saw", 1600.0, 600.0, 0.05, 1.0, unison=2),
        0.04,
        room=0.6,
    )
    for s, note in enumerate((84, 79, 76, 72)):
        mix.add(
            HIT_S + 0.25 * (s + 1),
            keys(note, 1.0, 2.0, 2.0, 0.5),
            0.1,
            (-0.3, 0.3)[s % 2],
            0.5,
            0.4,
        )
    return master(mix, 0.375, 1.7)


def trap() -> bytes:
    """150 beats a minute in C minor (Cm, A♭, E♭, B♭, G), felt in half time:
    an 808 under the kick, a clap on the third beat, hats with rolls and a
    bell tune; a hat roll into the line, and the 808 ringing when the
    drawing is whole."""
    at = beats(150.0)
    mix = Mix()
    bars = [
        (36, (60, 63, 67), (79, 75, 72, 75, 79, 77, 75, 72)),
        (32, (60, 63, 68), (80, 75, 72, 75, 80, 79, 75, 72)),
        (39, (58, 63, 67), (79, 75, 70, 75, 79, 77, 75, 70)),
        (34, (58, 62, 65), (77, 74, 70, 74, 77, 75, 74, 70)),
        (31, (59, 62, 67), (79, 74, 71, 74, 79, 77, 74, 71)),
    ]
    hits = ((0.0, 1.5), (1.5, 1.25), (2.75, 1.25))
    for bar, (root, notes, bells) in enumerate(bars):
        start = 4 * bar
        for beat, length in hits:
            mix.kick(at(start + beat), punch(), 0.5)
            mix.add(at(start + beat), eight_o_eight(root, length * 0.4 + 0.05), 0.5)
        mix.add(at(start + 2), clap(101), 0.5, room=0.25)
        mix.add(at(start + 2), snare(102, 0.08, 200.0), 0.25)
        for e in range(8):
            mix.add(at(start + e / 2.0), hat(), 0.14, 0.3)
        if bar % 2 == 1 or bar == 4:
            for s in range(8):
                mix.add(at(start + 3.0 + s / 8.0), hat(7), 0.05 + 0.01 * s, -0.3)
        for e, note in enumerate(bells):
            gain = 0.11 if bar < 4 else 0.07
            mix.add(
                at(start + e / 2.0),
                keys(note, 0.35, 1.5, 3.0, 0.5),
                gain,
                (-0.25, 0.25)[e % 2],
                0.3,
                0.2,
            )
        mix.chord(
            at(start),
            notes,
            lambda n: voice(n, 1.65, "saw", 700.0, 1100.0, 0.2, 0.3, unison=2),
            0.04,
            room=0.6,
        )
    roll(mix, at(18), at(20), 8, snare(103, 0.05, 210.0), 0.5)
    mix.add(at(17), riser(1.2, 104, 9000.0), 0.25, room=0.3)
    for s in range(16):
        mix.add(s / 16.0, hat(7), 0.03 + 0.012 * s, (-0.3, 0.3)[s % 2])
    mix.add(0.0, riser(1.0, 105), 0.25, room=0.3)
    mix.add(HIT_S, crash(), 0.3, room=0.4)
    mix.add(HIT_S, punch(), 0.8)
    mix.add(HIT_S, eight_o_eight(36, 3.0), 0.9)
    mix.add(HIT_S, clap(101), 0.5, room=0.4)
    mix.chord(
        HIT_S,
        (60, 63, 67, 72),
        lambda n: voice(n, 3.0, "saw", 1200.0, 500.0, 0.05, 1.0, unison=2),
        0.05,
        room=0.6,
    )
    mix.add(HIT_S, keys(84, 2.0, 1.5, 3.0, 0.8), 0.1, room=0.5, echo=0.4)
    return master(mix, 0.3, 1.3)


def retro() -> bytes:
    """120 beats a minute in B minor (Bm, G, D, A), the eighties: a big
    gated snare, an octave bass, a sixteenth arpeggio with echo, wide pads
    and a lead; a tom fill into the line, and B minor when the drawing is
    whole."""
    at = beats(120.0)
    mix = Mix(duck=0.4, duck_fade=0.12)
    bars = [
        (35, (59, 62, 66), ((0.0, 78, 2.0), (2.0, 74, 2.0))),
        (31, (59, 62, 67), ((0.0, 74, 2.0), (2.0, 71, 2.0))),
        (38, (57, 62, 66), ((0.0, 81, 2.0), (2.0, 78, 2.0))),
        (33, (57, 61, 64), ((0.0, 76, 3.0), (3.0, 73, 1.0))),
    ]
    arpeggio = (0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3)
    for bar, (root, notes, lead) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 2.0):
            mix.kick(at(start + b), punch(), 0.85)
        for b in (1, 3):
            mix.add(at(start + b), snare(111, 0.6, 180.0, 0.28), 0.5, room=0.5)
        for s in range(16):
            mix.add(at(start + s / 4.0), hat(), 0.1 if s % 2 == 0 else 0.05, 0.3)
        for e in range(8):
            note = root + 12 + (12 if e % 2 else 0)
            bass = voice(note, 0.22, "saw", 1400.0, 450.0, 0.003, 0.04, 0.15, 0.35, 2)
            mix.add(at(start + e / 2.0), bass, 0.3, pumped=True)
            mix.add(
                at(start + e / 2.0),
                voice(note - 12, 0.22, "sine", 300.0, None, 0.003, 0.04),
                0.3,
                pumped=True,
            )
        tones = (
            notes[0] + 12,
            notes[1] + 12,
            notes[2] + 12,
            notes[0] + 24,
            notes[1] + 24,
        )
        for s, k in enumerate(arpeggio):
            pluck = voice(tones[k], 0.13, "saw", 3500.0, 800.0, 0.002, 0.04, 0.08, 0.1)
            mix.add(at(start + s / 4.0), pluck, 0.06, (-0.35, 0.35)[s % 2], 0.3, 0.35)
        mix.chord(
            at(start),
            notes,
            lambda n: voice(
                n, 2.1, "saw", 1400.0, 1800.0, 0.25, 0.3, unison=3, spread=0.01
            ),
            0.04,
            0.6,
            room=0.6,
            pumped=True,
        )
        for beat, note, length in lead:
            sound = voice(
                note, length * 0.5 + 0.05, "square", 1800.0, 2600.0, 0.03, 0.1, unison=2
            )
            mix.add(at(start + beat), sound, 0.08, room=0.5, echo=0.3)
    roll(mix, at(14), at(16), 8, tom(45, 112), 0.5)
    for k in range(8):
        mix.add(
            k * 0.125, tom(55 - 2 * k, 113), 0.15 + 0.05 * k, (-0.4, 0.4)[k % 2], 0.5
        )
    mix.add(0.0, riser(1.0, 114), 0.2, room=0.4)
    whole(mix, 47)
    mix.chord(
        HIT_S,
        (59, 62, 66, 71),
        lambda n: voice(n, 3.0, "saw", 1800.0, 700.0, 0.05, 1.0, unison=3, spread=0.01),
        0.05,
        0.6,
        room=0.6,
    )
    mix.add(
        HIT_S,
        voice(78, 3.0, "square", 2400.0, 1200.0, 0.03, 1.0, 1.5, 0.4, 2),
        0.09,
        room=0.5,
        echo=0.4,
    )
    return master(mix, 0.375, 1.6)


def fiesta() -> bytes:
    """90 beats a minute in A minor (Am, F, G, E), reggaeton: a kick on every
    beat and the dembow snare, a bass on the kick, a marimba and a plucked
    tune; a fill into the line, and A minor when the drawing is whole."""
    at = beats(90.0)
    mix = Mix()
    bars = [
        ((45, 57, 60, 64),),
        ((41, 57, 60, 65),),
        ((43, 59, 62, 67), (40, 56, 59, 64)),
    ]
    tune = (
        (0.5, 76, 0.5),
        (1.0, 76, 0.25),
        (1.5, 74, 0.5),
        (2.0, 72, 1.0),
        (3.0, 71, 0.5),
        (3.5, 72, 0.5),
        (4.5, 72, 0.5),
        (5.0, 72, 0.25),
        (5.5, 71, 0.5),
        (6.0, 69, 1.0),
        (7.0, 67, 1.0),
        (8.0, 71, 1.0),
        (9.0, 74, 1.0),
        (10.0, 71, 1.0),
        (11.0, 68, 1.0),
    )
    for bar, chords in enumerate(bars):
        start = 4 * bar
        for b in range(4):
            mix.kick(at(start + b), punch(), 0.8)
        for b in (0.75, 1.5, 2.75, 3.5):
            mix.add(at(start + b), snare(121, 0.06, 260.0), 0.4, 0.1, 0.15)
        for e in range(8):
            mix.add(at(start + e / 2.0), hat(), 0.11, 0.3)
        for s in range(16):
            mix.add(at(start + s / 4.0), shaker(), 0.06 if s % 2 else 0.03, -0.35)
        for k, (root, *notes) in enumerate(chords):
            half = 4 // len(chords)
            for beat, length in ((0.0, 0.75), (1.5, 0.5), (2.0, 0.75), (3.5, 0.5)):
                if beat < half:
                    time = at(start + half * k + beat)
                    mix.add(
                        time,
                        voice(
                            root,
                            length * 0.6667,
                            "saw",
                            1500.0,
                            400.0,
                            0.003,
                            0.05,
                            0.2,
                            0.4,
                        ),
                        0.25,
                    )
                    mix.add(
                        time,
                        voice(
                            root - 12, length * 0.6667, "sine", 300.0, None, 0.003, 0.05
                        ),
                        0.4,
                    )
            for beat in (0.0, 0.75, 1.5, 2.0, 2.75, 3.5):
                if beat < half:
                    time = at(start + half * k + beat)
                    mix.chord(
                        time,
                        notes,
                        lambda n: keys(n + 12, 0.3, 1.0, 4.0, 0.3),
                        0.06,
                        room=0.3,
                    )
            pad = half * 0.6667
            mix.chord(
                at(start + half * k),
                notes,
                lambda n, s=pad: voice(n, s, "saw", 1500.0, 900.0, 0.02, 0.2, unison=2),
                0.035,
                room=0.5,
            )
    for beat, note, length in tune:
        pluck = voice(
            note, length * 0.6667 + 0.1, "square", 2800.0, 900.0, 0.003, 0.06, 0.3, 0.3
        )
        mix.add(at(beat), pluck, 0.09, 0.15, 0.3, 0.35)
    roll(mix, at(-1.5), DRAW_S, 6, snare(122, 0.05, 250.0), 0.45)
    mix.add(0.0, riser(1.0, 123), 0.25, room=0.3)
    roll(mix, at(11), at(12), 4, snare(122, 0.05, 250.0), 0.45)
    whole(mix, 45, 0.9)
    mix.chord(
        HIT_S,
        (57, 60, 64, 69),
        lambda n: voice(n, 2.5, "saw", 2500.0, 700.0, 0.01, 0.8, 0.6, 0.25, 2),
        0.07,
        room=0.5,
    )
    mix.chord(
        HIT_S,
        (69, 72, 76),
        lambda n: keys(n, 1.5, 1.0, 4.0, 0.5),
        0.08,
        room=0.4,
        echo=0.3,
    )
    return master(mix, 0.5, 1.7)


# The tracks, in the order the app shows them.
TRACKS: dict[str, Callable[[], bytes]] = {
    "energy": energy,
    "chill": chill,
    "epic": epic,
    "sprint": sprint,
    "rock": rock,
    "funk": funk,
    "sunny": sunny,
    "trap": trap,
    "retro": retro,
    "fiesta": fiesta,
}


def box(kind: bytes, *parts: bytes) -> bytes:
    body = b"".join(parts)
    return struct.pack(">I", len(body) + 8) + kind + body


def full_box(kind: bytes, version: int, flags: int, *parts: bytes) -> bytes:
    return box(kind, struct.pack(">I", (version << 24) | flags), *parts)


def children(data: bytes, start: int, end: int) -> dict[bytes, tuple[int, int]]:
    """The boxes between `start` and `end`, by kind: where their content
    starts and ends (the first of each kind)."""
    found: dict[bytes, tuple[int, int]] = {}
    while start + 8 <= end:
        size = struct.unpack_from(">I", data, start)[0]
        kind = data[start + 4 : start + 8]
        if size < 8:
            raise ValueError("a box smaller than its header")
        found.setdefault(kind, (start + 8, start + size))
        start += size
    return found


def path(data: bytes, *kinds: bytes) -> tuple[int, int]:
    start, end = 0, len(data)
    for kind in kinds:
        start, end = children(data, start, end)[kind]
    return start, end


@dataclass(frozen=True)
class Encoded:
    """What the app's file needs of the encoder's M4A."""

    esds: bytes
    channels: int
    rate: int
    sizes: list[int]
    packets: bytes
    priming: int
    frames: int


STBL = (b"moov", b"trak", b"mdia", b"minf", b"stbl")


def read_encoded(data: bytes) -> Encoded:
    """The AAC packets of afconvert's M4A, with the priming and length it
    keeps in iTunSMPB."""
    start, end = path(data, *STBL, b"stsd")
    entry = start + 8
    if data[entry + 4 : entry + 8] != b"mp4a":
        raise ValueError("not AAC")
    channels, _, _, _, rate = struct.unpack_from(">HHHHI", data, entry + 24)
    esds_start, esds_end = children(data, entry + 36, end)[b"esds"]
    start, _ = path(data, *STBL, b"stsz")
    _, count = struct.unpack_from(">II", data, start + 4)
    sizes = list(struct.unpack_from(f">{count}I", data, start + 12))
    start, _ = path(data, *STBL, b"stco")
    (chunks,) = struct.unpack_from(">I", data, start + 4)
    offsets = struct.unpack_from(f">{chunks}I", data, start + 8)
    start, _ = path(data, *STBL, b"stsc")
    (runs,) = struct.unpack_from(">I", data, start + 4)
    table = [struct.unpack_from(">III", data, start + 8 + 12 * r) for r in range(runs)]
    per_chunk: list[int] = []
    for r, (first, samples, _) in enumerate(table):
        last = table[r + 1][0] if r + 1 < runs else chunks + 1
        per_chunk += [samples] * (last - first)
    packets = bytearray()
    sample = 0
    for chunk, offset in enumerate(offsets):
        for _ in range(per_chunk[chunk]):
            packets += data[offset : offset + sizes[sample]]
            offset += sizes[sample]
            sample += 1
    marker = data.find(b"iTunSMPB")
    if marker < 0:
        raise ValueError("no iTunSMPB")
    words = data[marker + 24 : marker + 24 + 80].decode("ascii").split()
    priming, frames = int(words[1], 16), int(words[3], 16)
    return Encoded(
        data[esds_start:esds_end],
        channels,
        rate >> 16,
        sizes,
        bytes(packets),
        priming,
        frames,
    )


IDENTITY = struct.pack(">9I", 0x0001_0000, 0, 0, 0, 0x0001_0000, 0, 0, 0, 0x4000_0000)


def roll_group(count: int) -> tuple[bytes, bytes]:
    """Every AAC packet needs the one before it to decode («roll» of -1),
    as AVAssetWriter writes it. Without it, AVFoundation leaves out the
    priming once more than the edit list says: the sound starts 2112
    samples early."""
    sgpd = full_box(b"sgpd", 1, 0, b"roll", struct.pack(">IIh", 2, 1, -1))
    sbgp = full_box(b"sbgp", 0, 0, b"roll", struct.pack(">III", 1, count, 1))
    return sgpd, sbgp


def app_file(encoded: Encoded) -> bytes:
    """The M4A the app keeps: one AAC track in one chunk, the encoder's
    priming left out by an edit list (ISO/IEC 14496-12), the index first."""
    count = len(encoded.sizes)
    mp4a = box(
        b"mp4a",
        bytes(6),
        struct.pack(">H", 1),  # data_reference_index
        bytes(8),
        struct.pack(">HHHH", encoded.channels, 16, 0, 0),
        struct.pack(">I", encoded.rate << 16),
        box(b"esds", encoded.esds),
    )
    sample_table = (
        full_box(b"stsd", 0, 0, struct.pack(">I", 1), mp4a),
        *roll_group(count),
        full_box(b"stts", 0, 0, struct.pack(">III", 1, count, 1024)),
        full_box(b"stsc", 0, 0, struct.pack(">IIII", 1, 1, count, 1)),
        full_box(b"stsz", 0, 0, struct.pack(f">II{count}I", 0, count, *encoded.sizes)),
    )
    mvhd = full_box(
        b"mvhd",
        0,
        0,
        bytes(8),
        struct.pack(">IIIH", encoded.rate, encoded.frames, 0x0001_0000, 0x0100),
        bytes(10),
        IDENTITY,
        bytes(24),
        struct.pack(">I", 2),  # next_track_ID
    )
    tkhd = full_box(
        b"tkhd",
        0,
        0x3,  # enabled, in the movie
        bytes(8),
        struct.pack(">III", 1, 0, encoded.frames),
        bytes(8),
        struct.pack(">HHHH", 0, 1, 0x0100, 0),  # layer, group, volume
        IDENTITY,
        bytes(8),
    )
    elst = full_box(
        b"elst", 0, 0, struct.pack(">IIIHH", 1, encoded.frames, encoded.priming, 1, 0)
    )
    mdhd = full_box(
        b"mdhd",
        0,
        0,
        bytes(8),
        struct.pack(">IIHH", encoded.rate, 1024 * count, 0x55C4, 0),
    )
    dinf = box(
        b"dinf", full_box(b"dref", 0, 0, struct.pack(">I", 1), full_box(b"url ", 0, 1))
    )

    def moov(offset: int) -> bytes:
        stco = full_box(b"stco", 0, 0, struct.pack(">II", 1, offset))
        minf = box(
            b"minf",
            full_box(b"smhd", 0, 0, bytes(4)),
            dinf,
            box(b"stbl", *sample_table, stco),
        )
        hdlr = full_box(b"hdlr", 0, 0, bytes(4), b"soun", bytes(12), b"Sound\0")
        return box(
            b"moov",
            mvhd,
            box(b"trak", tkhd, box(b"edts", elst), box(b"mdia", mdhd, hdlr, minf)),
        )

    ftyp = box(b"ftyp", b"M4A ", struct.pack(">I", 0), b"M4A ", b"mp42", b"isom")
    offset = len(ftyp) + len(moov(0)) + 8
    return ftyp + moov(offset) + box(b"mdat", encoded.packets)


def encode(pcm: bytes) -> bytes:
    """The samples in AAC with macOS's afconvert, as the app's M4A."""
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "track.wav"
        target = Path(folder) / "track.m4a"
        with wave.open(str(source), "wb") as out:
            out.setnchannels(2)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(pcm)
        command = ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE)]
        subprocess.run(command + ["-q", "127", str(source), str(target)], check=True)
        encoded = read_encoded(target.read_bytes())
    if encoded.frames != FRAMES or encoded.rate != RATE:
        raise ValueError(f"afconvert gave {encoded.frames} frames at {encoded.rate} Hz")
    return app_file(encoded)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def check() -> int:
    """Makes the samples again and compares them with music.json."""
    kept = json.loads(MANIFEST.read_text())
    wrong = [
        name
        for name, make in TRACKS.items()
        if sha256(make()) != kept[name]["pcm_sha256"]
    ]
    for name in wrong:
        print(f"{name}: the samples are not the ones in music.json")
    return 1 if wrong else 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="The music of a run's video.")
    parser.add_argument("--check", action="store_true", help="only the samples")
    args = parser.parse_args(argv)
    if args.check:
        return check()
    OUT.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, dict[str, str | int]] = {}
    for name, make in TRACKS.items():
        pcm = make()
        data = encode(pcm)
        (OUT / f"{name}.m4a").write_bytes(data)
        manifest[name] = {
            "file": f"{name}.m4a",
            "bytes": len(data),
            "pcm_sha256": sha256(pcm),
            "m4a_sha256": sha256(data),
        }
        print(f"{name}.m4a: {len(data)} bytes")
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
