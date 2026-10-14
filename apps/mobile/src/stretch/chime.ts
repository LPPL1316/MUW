import type { AudioPlayer } from "expo-audio";

/**
 * The short sound between two stretches (TASK-285 part B): a bell of ours,
 * `assets/stretch/ding.wav`, made by `tools/stretch_chime.py`. Best effort:
 * a phone that cannot play it goes on in silence, the timer says enough.
 * expo-audio is loaded at the first ring, not with the app: a build
 * without it, or a test that never rings, never asks for it.
 */

let player: AudioPlayer | null | undefined;

export function chime(): void {
  try {
    if (player === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const audio = require("expo-audio") as typeof import("expo-audio");
      player = audio.createAudioPlayer(require("../../assets/stretch/ding.wav"));
    }
    if (player === null) {
      return;
    }
    const sound = player;
    void sound
      .seekTo(0)
      .catch(() => {})
      .then(() => sound.play());
  } catch {
    player = null;
  }
}
