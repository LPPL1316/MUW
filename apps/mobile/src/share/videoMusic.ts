import { Asset } from "expo-asset";
import type { AudioPlayer } from "expo-audio";
import { File } from "expo-file-system";

import { t } from "../i18n";
import { type AudioTrack, audioTrackOf } from "./m4a";

/**
 * The music of a run's video (TASK-301, ADR-0262): ten tracks of ours, made
 * by `tools/video_music.py`, 12 s each on the video's times (the line from
 * 1 s, the whole drawing at 9 s). The runner picks one in «Share your run»,
 * hears it there, and it goes into the video's file.
 */

/** The tracks, in the order «Share your run» shows them. */
export const MUSIC = [
  "energy",
  "chill",
  "epic",
  "sprint",
  "rock",
  "funk",
  "sunny",
  "trap",
  "retro",
  "fiesta",
] as const;

export type Music = (typeof MUSIC)[number];

const FILES: Readonly<Record<Music, number>> = {
  energy: require("../../assets/music/energy.m4a"),
  chill: require("../../assets/music/chill.m4a"),
  epic: require("../../assets/music/epic.m4a"),
  sprint: require("../../assets/music/sprint.m4a"),
  rock: require("../../assets/music/rock.m4a"),
  funk: require("../../assets/music/funk.m4a"),
  sunny: require("../../assets/music/sunny.m4a"),
  trap: require("../../assets/music/trap.m4a"),
  retro: require("../../assets/music/retro.m4a"),
  fiesta: require("../../assets/music/fiesta.m4a"),
};

/** The track's name, as its chip says it. */
export function musicName(music: Music): string {
  switch (music) {
    case "energy":
      return t("Energy");
    case "chill":
      return t("Chill");
    case "epic":
      return t("Epic");
    case "sprint":
      return t("Sprint");
    case "rock":
      return t("Rock");
    case "funk":
      return t("Funk");
    case "sunny":
      return t("Sunny");
    case "trap":
      return t("Trap");
    case "retro":
      return t("Retro");
    case "fiesta":
      return t("Fiesta");
  }
}

/** The track's packets, from the app's own file of it. */
export async function musicTrack(music: Music): Promise<AudioTrack> {
  const asset = Asset.fromModule(FILES[music]);
  await asset.downloadAsync();
  if (asset.localUri === null) {
    throw new Error("the music's file is not on the phone");
  }
  return audioTrackOf(await new File(asset.localUri).bytes());
}

/** The player of «Share your run»; null before the first track, or when
 * the phone cannot play. */
let player: AudioPlayer | null = null;
let cannotPlay = false;

/**
 * Plays `music` from its start, or stops with null. Best effort: a phone
 * that cannot play stays quiet, the video still gets the music. Like any
 * sound outside a run, it follows the silent switch (ADR-0225). expo-audio
 * is loaded at the first track, not with the app.
 */
export function hearMusic(music: Music | null): void {
  if (cannotPlay) {
    return;
  }
  try {
    if (music === null) {
      player?.pause();
      return;
    }
    if (player === null) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const audio = require("expo-audio") as typeof import("expo-audio");
      player = audio.createAudioPlayer(FILES[music]);
    } else {
      player.replace(FILES[music]);
    }
    const sound = player;
    void sound
      .seekTo(0)
      .catch(() => {})
      .then(() => sound.play());
  } catch {
    cannotPlay = true;
    player = null;
  }
}

/** Stops the track and lets the player go: «Share your run» has closed. */
export function endMusic(): void {
  try {
    player?.remove();
  } catch {
    // Already gone.
  }
  player = null;
}
