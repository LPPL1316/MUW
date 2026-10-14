"""Makes the short sound between two stretching exercises (TASK-285 part B).

A bell-like «ding», ours: two sine waves (a note and its harmonic) that
fade out over a third of a second, written as a 16-bit mono WAV with the
standard library only. Run from the repository's root:

    python3 tools/stretch_chime.py

The file goes to apps/mobile/assets/stretch/ding.wav, which the app
bundles like its images.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

RATE = 22_050
SECONDS = 0.35
NOTE_HZ = 880.0
HARMONIC_HZ = 1760.0
PEAK = 0.6
OUT = Path(__file__).resolve().parents[1] / "apps" / "mobile" / "assets" / "stretch" / "ding.wav"


def sample(t: float) -> float:
    """The sound at `t` seconds, from -1 to 1: a struck note that fades."""
    attack = min(1.0, t / 0.004)
    fade = math.exp(-t * 9.0)
    note = math.sin(2 * math.pi * NOTE_HZ * t)
    harmonic = 0.35 * math.sin(2 * math.pi * HARMONIC_HZ * t) * math.exp(-t * 14.0)
    return PEAK * attack * fade * (note + harmonic) / 1.35


def main() -> None:
    frames = int(RATE * SECONDS)
    data = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, sample(i / RATE))) * 32767))
        for i in range(frames)
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(data)
    print(f"{OUT} ({OUT.stat().st_size} bytes, {SECONDS} s)")


if __name__ == "__main__":
    main()
