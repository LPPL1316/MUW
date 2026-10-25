"""Makes the three music tracks of a run's video (TASK-301, ADR-0262).

Ours, written note by note here: «Energy», «Chill» and «Epic», 12 s each and
built on the video's times (ADR-0254): the intro until 1 s, the line drawing
itself until 9 s, a hit when the whole drawing shows, and the end at 12 s.

The sound is made with + - * / only (no sin or exp of the C library, whose
last digit may differ from one computer to another) and a fixed
pseudo-random noise, so the 16-bit samples are the same, byte for byte,
everywhere: `music.json` keeps their SHA-256, and `--check` makes them again
and compares. macOS's own `afconvert` then encodes them in AAC, and the file
is written again as a plain M4A for the app (one chunk, the encoder's
priming in an edit list): `music.json` keeps the SHA-256 of that too.

Run from the repository's root, on a Mac:

    python3 tools/video_music.py          # the three .m4a and music.json
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


def blep(t: float, dt: float) -> float:
    """The correction that takes the click out of a saw's jump (PolyBLEP)."""
    if t < dt:
        t /= dt
        return t + t - t * t - 1.0
    if t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


def taper(sound: list[float], seconds: float = 0.01) -> list[float]:
    """The end of a sound brought down to zero, so that it does not click."""
    n = min(len(sound), round(seconds * RATE))
    for i in range(n):
        sound[len(sound) - n + i] *= (n - i) / n
    return sound


def kick(
    seconds: float = 0.4,
    high: float = 150.0,
    low: float = 48.0,
    drop: float = 0.03,
    fade: float = 0.2,
    seed: int = 1,
) -> list[float]:
    """A drum with a falling pitch: kicks, toms, the boom of the hit."""
    n = round(seconds * RATE)
    out = [0.0] * n
    phase = 0.0
    pitch = 1.0
    level = 1.0
    keep_pitch = decay(drop)
    keep_level = decay(fade)
    span = high - low
    state = seed
    click = round(0.004 * RATE)
    for i in range(n):
        phase += (low + span * pitch) / RATE
        if phase >= 1.0:
            phase -= 1.0
        value = sine(phase) * level
        if i < click:
            state = (state * 1_664_525 + 1_013_904_223) & 0xFFFF_FFFF
            value += 0.3 * (state / 2_147_483_648.0 - 1.0) * (click - i) / click
        out[i] = value
        pitch *= keep_pitch
        level *= keep_level
    return taper(out)


def hiss(
    seconds: float,
    fade: float,
    low_cut: float,
    high_cut: float,
    seed: int,
    attack: float = 0.001,
    high_cut_end: float | None = None,
) -> list[float]:
    """Noise between two cutoffs that fades: hats, snares, crashes. With
    `high_cut_end`, the top cutoff moves there (a riser)."""
    n = round(seconds * RATE)
    out = [0.0] * n
    state = seed
    top = 0.0
    bottom = 0.0
    a_low = pole(low_cut)
    end_cut = high_cut if high_cut_end is None else high_cut_end
    level = 1.0
    keep = decay(fade)
    rise = max(1.0, attack * RATE)
    for i in range(n):
        state = (state * 1_664_525 + 1_013_904_223) & 0xFFFF_FFFF
        x = state / 2_147_483_648.0 - 1.0
        a_high = pole(high_cut + (end_cut - high_cut) * i / n)
        top += a_high * (x - top)
        bottom += a_low * (top - bottom)
        value = (top - bottom) * level
        if i < rise:
            value *= i / rise
        out[i] = value
        level *= keep
    return taper(out)


def snare(seed: int, fade: float = 0.09, body: float = 190.0) -> list[float]:
    """Noise and a short tone under it."""
    noise = hiss(0.32, fade, 1200.0, 9000.0, seed)
    tone = kick(0.18, body * 1.4, body, 0.01, 0.045, seed + 1)
    return [n + 0.5 * tone[i] if i < len(tone) else n for i, n in enumerate(noise)]


def clap(seed: int) -> list[float]:
    """Three short bursts, then a tail."""
    out = hiss(0.3, 0.07, 1000.0, 7000.0, seed)
    for k, at in enumerate((0.0, 0.011, 0.022)):
        burst = hiss(0.012, 0.004, 1000.0, 7000.0, seed + 7 * (k + 1))
        start = round(at * RATE)
        for i, value in enumerate(burst):
            out[start + i] += 0.9 * value
    return out


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
    detune: float = 1.0,
) -> list[float]:
    """A note of a synthesizer: a saw, square, triangle or sine wave through a
    two-pole low-pass filter whose cutoff moves from `cutoff` to
    `cutoff_end`, with a straight attack, a fall to `sustain` over `fade`
    seconds and a straight release at the end."""
    n = round(seconds * RATE)
    out = [0.0] * n
    step = HZ[note] * detune / RATE
    phase = 0.0
    first = 0.0
    second = 0.0
    end_cut = cutoff if cutoff_end is None else cutoff_end
    rise = max(1.0, attack * RATE)
    fall = max(1.0, release * RATE)
    tail_from = n - fall
    keep = 1.0 if fade is None else decay(fade)
    above = 1.0
    for i in range(n):
        phase += step
        if phase >= 1.0:
            phase -= 1.0
        if shape == "saw":
            x = phase + phase - 1.0 - blep(phase, step)
        elif shape == "square":
            half = phase + 0.5 if phase < 0.5 else phase - 0.5
            x = (1.0 if phase < 0.5 else -1.0) + blep(phase, step) - blep(half, step)
        elif shape == "triangle":
            x = 4.0 * phase - 1.0 if phase < 0.5 else 3.0 - 4.0 * phase
        else:
            x = sine(phase)
        a = pole(cutoff + (end_cut - cutoff) * i / n)
        first += a * (x - first)
        second += a * (first - second)
        level = sustain + (1.0 - sustain) * above
        above *= keep
        if i < rise:
            level *= i / rise
        if i > tail_from:
            level *= (n - i) / fall
        out[i] = second * level
    return out


def keys(note: int, seconds: float, bright: float = 1.2) -> list[float]:
    """An electric piano: a sine bent by another at the same pitch (FM), the
    bend fading faster than the note."""
    n = round(seconds * RATE)
    out = [0.0] * n
    step = HZ[note] / RATE
    carrier = 0.0
    modulator = 0.0
    tine = 0.0
    level = 1.0
    index = bright
    keep_level = decay(1.1)
    keep_index = decay(0.25)
    keep_tine = decay(0.04)
    tine_level = 0.25
    fall = round(0.08 * RATE)
    for i in range(n):
        carrier += step
        if carrier >= 1.0:
            carrier -= 1.0
        modulator += step
        if modulator >= 1.0:
            modulator -= 1.0
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
    return out


def chord(
    notes: Sequence[int], make: Callable[[int], list[float]]
) -> list[list[float]]:
    return [make(note) for note in notes]


@dataclass
class Mix:
    """Where the sounds go: left and right, a part ducked under the kick
    («pumped»), and what is sent to the room and to the echo."""

    left: list[float]
    right: list[float]
    pumped_left: list[float]
    pumped_right: list[float]
    room: list[float]
    echo: list[float]

    @classmethod
    def empty(cls) -> Mix:
        return cls(*([0.0] * FRAMES for _ in range(6)))

    def add(
        self,
        at: float,
        sound: Sequence[float],
        gain: float,
        pan: float = 0.0,
        room: float = 0.0,
        echo: float = 0.0,
        pumped: bool = False,
    ) -> None:
        """`sound` from `at` seconds; `pan` from -1 (left) to 1 (right)."""
        start = round(at * RATE)
        end = min(FRAMES, start + len(sound))
        left = self.pumped_left if pumped else self.left
        right = self.pumped_right if pumped else self.right
        to_left = gain * (1.0 - pan)
        to_right = gain * (1.0 + pan)
        for i in range(max(0, start), end):
            value = sound[i - start]
            left[i] += value * to_left
            right[i] += value * to_right
        for send, amount in ((self.room, room), (self.echo, echo)):
            if amount > 0.0:
                level = gain * amount
                for i in range(max(0, start), end):
                    send[i] += sound[i - start] * level

    def pump(self, kicks: Sequence[float], depth: float, fade: float) -> None:
        """Ducks the pumped part at each kick, then lets it back up, and puts
        it in with the rest."""
        keep = decay(fade)
        hits = sorted(round(at * RATE) for at in kicks)
        duck = 0.0
        k = 0
        for i in range(FRAMES):
            if k < len(hits) and i >= hits[k]:
                duck = 1.0
                k += 1
            gain = 1.0 - depth * duck
            self.left[i] += self.pumped_left[i] * gain
            self.right[i] += self.pumped_right[i] * gain
            duck *= keep


def reverb(send: Sequence[float]) -> tuple[list[float], list[float]]:
    """A small room (Schroeder): four damped combs, then two all-pass filters
    for each side."""
    combs = [[0.0] * size for size in (1557, 1617, 1491, 1422)]
    places = [0, 0, 0, 0]
    stores = [0.0, 0.0, 0.0, 0.0]
    passes = (
        [[0.0] * 556, [0.0] * 441],
        [[0.0] * 579, [0.0] * 464],
    )
    pass_places = [[0, 0], [0, 0]]
    feedback = 0.8
    damp = 0.3
    out = ([0.0] * FRAMES, [0.0] * FRAMES)
    for i in range(FRAMES):
        x = send[i] * 0.2
        wet = 0.0
        for c in range(4):
            line = combs[c]
            at = places[c]
            value = line[at]
            stores[c] = value * (1.0 - damp) + stores[c] * damp
            line[at] = x + stores[c] * feedback
            places[c] = at + 1 if at + 1 < len(line) else 0
            wet += value
        for side in range(2):
            y = wet
            for p in range(2):
                line = passes[side][p]
                at = pass_places[side][p]
                held = line[at]
                line[at] = y + held * 0.5
                y = held - y
                pass_places[side][p] = at + 1 if at + 1 < len(line) else 0
            out[side][i] = y
    return out


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


def limit(x: float) -> float:
    """A soft limit: tanh, near enough, with + - * / only."""
    if x > 3.0:
        return 1.0
    if x < -3.0:
        return -1.0
    return x * (27.0 + x * x) / (27.0 + 9.0 * x * x)


def master(mix: Mix, echo_s: float, drive: float) -> bytes:
    """Everything together: the room and the echo, a soft limit, the loudest
    sample at PEAK, the start and the end faded, as 16-bit stereo."""
    room_left, room_right = reverb(mix.room)
    echo_left, echo_right = ping_pong(mix.echo, echo_s, 0.35)
    left = [0.0] * FRAMES
    right = [0.0] * FRAMES
    for i in range(FRAMES):
        left[i] = limit((mix.left[i] + room_left[i] + echo_left[i]) * drive)
        right[i] = limit((mix.right[i] + room_right[i] + echo_right[i]) * drive)
    loudest = max(max(map(abs, left)), max(map(abs, right)))
    scale = PEAK / loudest
    fade_in = round(0.004 * RATE)
    fade_out = round(FADE_S * RATE)
    samples = array("h", bytes(4 * FRAMES))
    for i in range(FRAMES):
        gain = scale
        if i < fade_in:
            gain *= i / fade_in
        left_end = FRAMES - i
        if left_end < fade_out:
            share = left_end / fade_out
            gain *= share * share
        samples[2 * i] = round(left[i] * gain * 32767.0)
        samples[2 * i + 1] = round(right[i] * gain * 32767.0)
    if sys.byteorder == "big":
        samples.byteswap()
    return samples.tobytes()


def beats(bpm: float) -> Callable[[float], float]:
    """The time of a beat, counted from when the line starts (beat 0)."""
    length = 60.0 / bpm

    def at(beat: float) -> float:
        return DRAW_S + beat * length

    return at


def energy() -> bytes:
    """120 beats a minute in A minor (Am, F, C, G): four on the floor, a
    pumping bass and a plucked arpeggio; a snare roll and a riser into the
    line, a crash and the A minor chord ringing when the drawing is whole."""
    at = beats(120.0)
    mix = Mix.empty()
    bars = [
        (45, (57, 60, 64)),
        (41, (57, 60, 65)),
        (48, (55, 60, 64)),
        (43, (55, 59, 62)),
    ]
    kicks = [at(b) for b in range(16)]
    for time in kicks:
        mix.add(time, kick(), 0.9)
    for bar in range(4):
        for b in (1, 3):
            mix.add(at(4 * bar + b), clap(100 + 10 * bar + b), 0.35, room=0.25)
        for b in range(4):
            open_hat = b == 3
            hat = hiss(
                0.25 if open_hat else 0.06,
                0.09 if open_hat else 0.018,
                7000.0,
                16000.0,
                300 + 4 * bar + b,
            )
            mix.add(at(4 * bar + b + 0.5), hat, 0.28 if open_hat else 0.22, pan=0.2)
        if bar >= 2:
            for s in range(16):
                if s % 2 == 0:
                    tick = hiss(0.03, 0.01, 8000.0, 16000.0, 400 + 16 * bar + s)
                    mix.add(at(4 * bar + s / 4.0), tick, 0.08 + 0.01 * bar, pan=-0.3)
        root, notes = bars[bar]
        for e in range(8):
            note = root + (12 if e in (2, 5) else 0)
            bass = voice(note, 0.24, "saw", 1400.0, 250.0, 0.003, 0.03, 0.12, 0.3)
            sub = voice(note - 12, 0.24, "sine", 400.0, None, 0.003, 0.03)
            time = at(4 * bar + e / 2.0)
            mix.add(time, bass, 0.32, pumped=True)
            mix.add(time, sub, 0.4, pumped=True)
        for sound in chord(
            notes,
            lambda n: voice(n, 2.1, "saw", 1100.0, 1600.0, 0.06, 0.3, detune=1.003),
        ):
            mix.add(at(4 * bar), sound, 0.07, room=0.4, pumped=True)
        arpeggio = [0, 1, 2, 1, 3, 1, 2, 4, 0, 1, 2, 3, 4, 3, 2, 1]
        tones = [
            notes[0] + 12,
            notes[1] + 12,
            notes[2] + 12,
            notes[0] + 24,
            notes[1] + 24,
        ]
        for s, k in enumerate(arpeggio):
            pluck = voice(
                tones[k], 0.16, "square", 3200.0, 500.0, 0.002, 0.05, 0.09, 0.0
            )
            pan = -0.35 if s % 2 == 0 else 0.35
            mix.add(
                at(4 * bar + s / 4.0),
                pluck,
                0.09 + 0.015 * bar,
                pan,
                room=0.2,
                echo=0.3,
            )
    # Into the line: a snare roll and a riser over the first second.
    for k in range(8):
        mix.add(k * 0.125, snare(500 + k, 0.06), 0.06 + 0.04 * k, room=0.2)
    mix.add(0.0, hiss(1.0, 10.0, 200.0, 400.0, 600, 0.9, 9000.0), 0.35, room=0.3)
    # The drawing is whole: crash, boom, the chord ringing out.
    mix.add(HIT_S, hiss(3.0, 0.9, 3500.0, 15000.0, 700), 0.35, room=0.4)
    mix.add(HIT_S, kick(1.6, 120.0, 40.0, 0.05, 0.6), 1.0)
    mix.add(HIT_S, voice(33, 3.0, "saw", 600.0, 150.0, 0.005, 0.5, 0.8, 0.2), 0.35)
    mix.add(HIT_S, voice(33, 3.0, "sine", 300.0, None, 0.005, 0.5, 1.0, 0.0), 0.5)
    for sound in chord(
        (57, 60, 64, 71),
        lambda n: voice(n, 3.0, "saw", 1800.0, 500.0, 0.01, 0.6, 1.2, 0.2, 1.003),
    ):
        mix.add(HIT_S, sound, 0.09, room=0.6)
    for s, note in enumerate((81, 76, 72, 69, 76, 72)):
        pluck = voice(note, 0.3, "square", 2600.0, 500.0, 0.002, 0.1, 0.15, 0.0)
        mix.add(
            HIT_S + s * 0.25,
            pluck,
            0.1 * (1.0 - s / 7.0),
            (-0.3, 0.3)[s % 2],
            room=0.3,
            echo=0.4,
        )
    mix.pump(kicks, 0.65, 0.1)
    return master(mix, 0.375, 1.3)


def chill() -> bytes:
    """90 beats a minute in F (Fmaj7, Am7, B♭maj7 and C9): a soft swung beat,
    a round bass and an electric piano; the chord swells in before the
    line, and F major 9 rings when the drawing is whole."""
    at = beats(90.0)
    mix = Mix.empty()
    bars = [
        ((41,), (57, 60, 64, 65)),
        ((45,), (55, 60, 64, 67)),
        ((46, 48), (57, 62, 65, 69), (58, 62, 64, 67)),
    ]
    swing = 0.17
    for bar, (roots, *voicings) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 2.5):
            mix.add(at(start + b), kick(0.35, 110.0, 50.0, 0.03, 0.15), 0.6)
        for b in (1, 3):
            mix.add(
                at(start + b),
                snare(800 + 2 * bar + b, 0.05, 330.0),
                0.18,
                0.15,
                room=0.35,
            )
        for e in range(8):
            time = at(start + e / 2.0 + (swing if e % 2 else 0.0))
            shake = hiss(0.07, 0.025, 5000.0, 12000.0, 900 + 8 * bar + e, 0.012)
            mix.add(time, shake, 0.09 if e % 2 else 0.05, -0.35)
        if len(roots) == 1:
            mix.add(
                at(start),
                voice(roots[0], 1.6, "triangle", 900.0, 400.0, 0.01, 0.2, 0.9, 0.5),
                0.5,
            )
            mix.add(
                at(start + 2.5),
                voice(
                    roots[0] + 7, 0.8, "triangle", 900.0, 400.0, 0.01, 0.15, 0.6, 0.5
                ),
                0.4,
            )
        else:
            for k, root in enumerate(roots):
                mix.add(
                    at(start + 2 * k),
                    voice(root, 1.3, "triangle", 900.0, 400.0, 0.01, 0.2, 0.9, 0.5),
                    0.5,
                )
        for k, notes in enumerate(voicings):
            hit = start + 2 * k
            length = 2.6 if len(voicings) == 1 else 1.3
            for n, note in enumerate(notes):
                mix.add(
                    at(hit) + 0.012 * n,
                    keys(note, length),
                    0.1,
                    (-0.25, 0.25)[n % 2],
                    room=0.45,
                    echo=0.12,
                )
            if len(voicings) == 1:
                for n, note in enumerate(notes[1:3]):
                    mix.add(
                        at(start + 2.5),
                        keys(note + 12, 0.9, 0.8),
                        0.05,
                        (0.3, -0.3)[n],
                        room=0.5,
                        echo=0.2,
                    )
            for note in notes:
                pad = voice(
                    note,
                    2.7 if len(voicings) == 1 else 1.4,
                    "saw",
                    700.0,
                    900.0,
                    0.4,
                    0.4,
                    detune=1.002,
                )
                mix.add(at(hit), pad, 0.035, room=0.5)
    # A small tune over the second and third bars.
    for beat, note, length in (
        (4.0, 76, 1.0),
        (5.5, 74, 0.5),
        (6.0, 72, 1.5),
        (8.0, 74, 1.0),
        (9.5, 72, 0.5),
        (10.0, 69, 1.8),
    ):
        mix.add(
            at(beat),
            keys(note, length * 0.6667 + 0.3, 0.9),
            0.09,
            0.1,
            room=0.5,
            echo=0.35,
        )
    # Before the line: the first chord swells in.
    for note in (53, 57, 60, 64):
        mix.add(
            0.0,
            voice(note, 1.2, "saw", 300.0, 1200.0, 0.9, 0.2, detune=1.002),
            0.05,
            room=0.5,
        )
    mix.add(0.0, hiss(1.0, 10.0, 300.0, 500.0, 950, 0.95, 6000.0), 0.12, room=0.4)
    # The drawing is whole: F major 9, the bass, a shimmer.
    mix.add(HIT_S, kick(0.4, 110.0, 48.0, 0.03, 0.2), 0.6)
    mix.add(HIT_S, voice(41, 3.0, "triangle", 700.0, 300.0, 0.01, 0.8, 1.2, 0.3), 0.6)
    for n, note in enumerate((57, 60, 64, 67, 72)):
        mix.add(
            HIT_S + 0.015 * n,
            keys(note, 3.0, 1.0),
            0.1,
            (-0.3, 0.3)[n % 2],
            room=0.55,
            echo=0.15,
        )
    for note in (53, 57, 60, 64, 67):
        mix.add(
            HIT_S,
            voice(note, 3.0, "saw", 900.0, 400.0, 0.05, 1.0, detune=1.002),
            0.035,
            room=0.6,
        )
    mix.add(HIT_S, hiss(2.5, 0.8, 6000.0, 14000.0, 990, 0.3), 0.08, room=0.5)
    for s, note in enumerate((84, 79, 76)):
        mix.add(
            HIT_S + 0.5 + 0.45 * s,
            keys(note, 1.2, 0.6),
            0.06,
            (0.3, -0.3, 0.0)[s],
            room=0.6,
            echo=0.4,
        )
    return master(mix, 0.5, 1.4)


def epic() -> bytes:
    """120 beats a minute in D minor (Dm, B♭, Gm, A): big drums, strings
    playing eighths and a horn tune; a drum roll into the line, and D major
    when the drawing is whole."""
    at = beats(120.0)
    mix = Mix.empty()
    bars = [
        (38, (50, 57, 62, 65), (69, 74)),
        (34, (50, 58, 62, 65), (77, 74)),
        (31, (50, 55, 62, 70), (70, 74)),
        (33, (49, 57, 61, 64), (73, 76)),
    ]
    melody_lengths = [(2.0, 2.0), (3.0, 1.0), (2.0, 2.0), (2.0, 2.0)]
    for bar, (root, notes, tune) in enumerate(bars):
        start = 4 * bar
        for b in (0.0, 1.5, 2.0):
            drum = kick(0.7, 140.0, 62.0, 0.06, 0.3, 1000 + 3 * bar)
            mix.add(at(start + b), drum, 0.75, room=0.3)
        mix.add(at(start + 2), snare(1100 + bar, 0.12, 170.0), 0.3, room=0.6)
        if bar == 3:
            for e in range(8):
                tom = kick(0.4, 180.0, 90.0, 0.05, 0.2, 1200 + e)
                mix.add(
                    at(start + e / 2.0),
                    tom,
                    0.2 + 0.05 * e,
                    (-0.3, 0.3)[e % 2],
                    room=0.4,
                )
            for s in range(4):
                mix.add(
                    at(start + 3 + s / 4.0),
                    snare(1300 + s, 0.05, 200.0),
                    0.1 + 0.05 * s,
                    room=0.5,
                )
        pattern = [0, 0, 12, 0, 7, 0, 12, 7]
        for e, step in enumerate(pattern):
            string = voice(
                root + 12 + step, 0.2, "saw", 2400.0, 700.0, 0.01, 0.06, 0.12, 0.3
            )
            mix.add(at(start + e / 2.0), string, 0.12, (-0.2, 0.2)[e % 2], room=0.35)
        mix.add(
            at(start), voice(root, 2.1, "saw", 500.0, 300.0, 0.02, 0.2, 1.5, 0.6), 0.25
        )
        mix.add(at(start), voice(root, 2.1, "sine", 300.0, None, 0.02, 0.2), 0.35)
        for n, note in enumerate(notes):
            pad = voice(
                note,
                2.15,
                "saw",
                900.0,
                1300.0,
                0.15,
                0.3,
                detune=(1.003, 0.997)[n % 2],
            )
            mix.add(at(start), pad, 0.05, (-0.4, 0.4)[n % 2], room=0.6)
        beat = 0.0
        for note, length in zip(tune, melody_lengths[bar], strict=True):
            seconds = length * 0.5 + 0.08
            horn = voice(note, seconds, "saw", 700.0, 2400.0, 0.08, 0.15, detune=1.0)
            low = voice(
                note - 12, seconds, "saw", 500.0, 1500.0, 0.08, 0.15, detune=1.002
            )
            mix.add(at(start + beat), horn, 0.11, room=0.5, echo=0.1)
            mix.add(at(start + beat), low, 0.07, room=0.5)
            beat += length
    # Into the line: a drum roll growing, and a riser.
    for k in range(16):
        drum = kick(0.3, 120.0, 70.0, 0.05, 0.12, 1400 + k)
        mix.add(k / 16.0, drum, 0.08 + 0.035 * k, (-0.2, 0.2)[k % 2], room=0.4)
    mix.add(0.0, hiss(1.0, 10.0, 200.0, 400.0, 1500, 0.95, 8000.0), 0.3, room=0.4)
    # The drawing is whole: the boom, a crash and D major.
    mix.add(HIT_S, kick(2.5, 110.0, 36.0, 0.1, 0.8, 1600), 1.1, room=0.3)
    mix.add(HIT_S, hiss(3.0, 1.0, 3000.0, 14000.0, 1700), 0.4, room=0.5)
    mix.add(HIT_S, voice(26, 3.0, "saw", 500.0, 150.0, 0.01, 0.8, 1.2, 0.3), 0.3)
    mix.add(HIT_S, voice(26, 3.0, "sine", 300.0, None, 0.01, 0.8, 1.5, 0.0), 0.45)
    for n, note in enumerate((50, 57, 62, 66, 69)):
        sound = voice(
            note, 3.0, "saw", 1500.0, 600.0, 0.04, 1.0, 1.5, 0.3, (1.003, 0.997)[n % 2]
        )
        mix.add(HIT_S, sound, 0.07, (-0.4, 0.4)[n % 2], room=0.6)
    for note in (74, 78):
        horn = voice(note, 3.0, "saw", 900.0, 1800.0, 0.05, 1.0, 1.8, 0.4)
        mix.add(HIT_S, horn, 0.1, room=0.6, echo=0.1)
    return master(mix, 0.375, 1.2)


# The tracks, in the order the app shows them.
TRACKS: dict[str, Callable[[], bytes]] = {
    "energy": energy,
    "chill": chill,
    "epic": epic,
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


def read_encoded(data: bytes) -> Encoded:
    """The AAC packets of afconvert's M4A, with the priming and length it
    keeps in iTunSMPB."""
    stbl = (b"moov", b"trak", b"mdia", b"minf", b"stbl")
    start, end = path(data, *stbl, b"stsd")
    entry = start + 8
    if data[entry + 4 : entry + 8] != b"mp4a":
        raise ValueError("not AAC")
    channels, _, _, _, rate = struct.unpack_from(">HHHHI", data, entry + 8 + 16)
    rate >>= 16
    esds_start, esds_end = children(data, entry + 36, end)[b"esds"]
    esds = data[esds_start:esds_end]
    start, _ = path(data, *stbl, b"stsz")
    _, count = struct.unpack_from(">II", data, start + 4)
    sizes = list(struct.unpack_from(f">{count}I", data, start + 12))
    start, _ = path(data, *stbl, b"stco")
    (chunks,) = struct.unpack_from(">I", data, start + 4)
    offsets = struct.unpack_from(f">{chunks}I", data, start + 8)
    start, _ = path(data, *stbl, b"stsc")
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
    priming, _, frames = int(words[1], 16), int(words[2], 16), int(words[3], 16)
    return Encoded(esds, channels, rate, sizes, bytes(packets), priming, frames)


def app_file(encoded: Encoded) -> bytes:
    """The M4A the app keeps: one AAC track in one chunk, the encoder's
    priming left out by an edit list (ISO/IEC 14496-12), the index first."""
    count = len(encoded.sizes)
    media = 1024 * count
    mp4a = box(
        b"mp4a",
        bytes(6),
        struct.pack(">H", 1),  # data_reference_index
        bytes(8),
        struct.pack(">HHHH", encoded.channels, 16, 0, 0),
        struct.pack(">I", encoded.rate << 16),
        box(b"esds", encoded.esds),
    )

    def moov(offset: int) -> bytes:
        return box(
            b"moov",
            full_box(
                b"mvhd",
                0,
                0,
                bytes(8),
                struct.pack(">II", encoded.rate, encoded.frames),
                struct.pack(">IH", 0x0001_0000, 0x0100),
                bytes(10),
                struct.pack(
                    ">9I", 0x0001_0000, 0, 0, 0, 0x0001_0000, 0, 0, 0, 0x4000_0000
                ),
                bytes(24),
                struct.pack(">I", 2),
            ),
            box(
                b"trak",
                full_box(
                    b"tkhd",
                    0,
                    0x3,
                    bytes(8),
                    struct.pack(">II", 1, 0),
                    struct.pack(">I", encoded.frames),
                    bytes(8),
                    struct.pack(">HHHH", 0, 1, 0x0100, 0),
                    struct.pack(
                        ">9I", 0x0001_0000, 0, 0, 0, 0x0001_0000, 0, 0, 0, 0x4000_0000
                    ),
                    struct.pack(">II", 0, 0),
                ),
                box(
                    b"edts",
                    full_box(
                        b"elst",
                        0,
                        0,
                        struct.pack(">IIIHH", 1, encoded.frames, encoded.priming, 1, 0),
                    ),
                ),
                box(
                    b"mdia",
                    full_box(
                        b"mdhd",
                        0,
                        0,
                        bytes(8),
                        struct.pack(">IIHH", encoded.rate, media, 0x55C4, 0),
                    ),
                    full_box(b"hdlr", 0, 0, bytes(4), b"soun", bytes(12), b"Sound\0"),
                    box(
                        b"minf",
                        full_box(b"smhd", 0, 0, bytes(4)),
                        box(
                            b"dinf",
                            full_box(
                                b"dref",
                                0,
                                0,
                                struct.pack(">I", 1),
                                full_box(b"url ", 0, 1),
                            ),
                        ),
                        box(
                            b"stbl",
                            full_box(b"stsd", 0, 0, struct.pack(">I", 1), mp4a),
                            full_box(
                                b"stts", 0, 0, struct.pack(">III", 1, count, 1024)
                            ),
                            full_box(
                                b"stsc", 0, 0, struct.pack(">IIII", 1, 1, count, 1)
                            ),
                            full_box(
                                b"stsz",
                                0,
                                0,
                                struct.pack(">II", 0, count),
                                struct.pack(f">{count}I", *encoded.sizes),
                            ),
                            full_box(b"stco", 0, 0, struct.pack(">II", 1, offset)),
                        ),
                    ),
                ),
            ),
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
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(BITRATE), "-q", "127"]
            + [str(source), str(target)],
            check=True,
        )
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
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="only compare the samples")
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
