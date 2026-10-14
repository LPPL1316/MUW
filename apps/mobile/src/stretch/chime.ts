import { type AudioPlayer, createAudioPlayer } from "expo-audio";

/**
 * The short sound between two stretches (TASK-285 part B): a bell of ours,
 * `assets/stretch/ding.wav`, made by `tools/stretch_chime.py`. Best effort:
 * a phone that cannot play it goes on in silence, the timer says enough.
 */

let player: AudioPlayer | null | undefined;

export function chime(): void {
  try {
    if (player === undefined) {
      player = createAudioPlayer(require("../../assets/stretch/ding.wav"));
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
