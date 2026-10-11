import { BASE_LANGUAGE } from "../i18n/languages";
import { wordsOf } from "../voice/words";
import { moveOnFootJoined } from "./joinOnFoot";
import { type Navigation, onFix } from "./navigator";
import type { OnFoot } from "./onFootVoice";
import { movePen, type Pen } from "./penUp";
import type { TrackFix } from "./trackRecorder";

/**
 * A run that goes on with its track (trackStore, TASK-169) goes on with
 * its navigation too (TASK-253): the navigator, the pen of a word with the
 * pen up and the bike on foot are moved through the fixes already recorded,
 * saying nothing, so the next turn said is the one ahead of the runner,
 * not the first of the route, and the letters already drawn are not drawn
 * again. Before, «Keep running» and a run started again after the app was
 * closed restarted at the route's first metre, found nobody there, and
 * stayed off the route to the end. Along a closed shape the same fixes join
 * it where the run first did (TASK-273): the file needs nothing more.
 */

export type Followed = { navigation: Navigation; pen: Pen; onFoot: OnFoot };

/** `followed` moved through `fixes`, in their order; the cues of the way
 * are left unsaid. */
export function resumeFollowing(
  followed: Followed,
  fixes: readonly TrackFix[],
): Followed {
  let { navigation, pen, onFoot } = followed;
  const words = wordsOf(BASE_LANGUAGE);
  for (const fix of fixes) {
    if (navigation.arrived) {
      break;
    }
    const before = navigation;
    navigation = onFix(navigation, fix.point, {
      accuracyM: fix.accuracyM,
      timeMs: fix.timeMs,
    }).navigation;
    pen = movePen(pen, navigation.alongM, fix.accuracyM).pen;
    onFoot = moveOnFootJoined(before, navigation, onFoot, words, fix.accuracyM).onFoot;
  }
  return { navigation, pen, onFoot };
}
