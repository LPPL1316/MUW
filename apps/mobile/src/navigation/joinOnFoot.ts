import { type Navigation, waitingToJoin } from "./navigator";
import {
  type BikeWords,
  moveOnFoot,
  ON_FOOT_SAID_M,
  type OnFoot,
  type OnFootStep,
} from "./onFootVoice";

/**
 * The bike on foot (TASK-206) along a closed route that the run joins
 * wherever it reaches it (TASK-273): nothing is said before the run joins
 * it, and when it joins away from the route's start the stretches are taken
 * from there round, as the route is. Along any other route, `moveOnFoot`.
 */
export function moveOnFootJoined(
  before: Navigation,
  after: Navigation,
  onFoot: OnFoot,
  words: BikeWords,
  accuracyM: number | null = null,
): OnFootStep {
  if (waitingToJoin(after)) {
    return { onFoot, cues: [] };
  }
  return moveOnFoot(
    joinedOnFoot(before, after, onFoot),
    after.alongM,
    words,
    accuracyM,
  );
}

/**
 * The stretches from where the run has just joined the route round to
 * there: a stretch over that point is two, one at the run's start and one
 * at its end, each said only when ON_FOOT_SAID_M or longer, as any other.
 */
function joinedOnFoot(before: Navigation, after: Navigation, onFoot: OnFoot): OnFoot {
  const joinM = after.joinedAtM;
  if (before.joinedAtM !== undefined || joinM === undefined || joinM === 0) {
    return onFoot;
  }
  const lengthM = after.along[after.along.length - 1] ?? 0;
  const turned = onFoot.spans.flatMap(({ fromM, toM }) => {
    if (fromM >= joinM) {
      return [{ fromM: fromM - joinM, toM: toM - joinM }];
    }
    if (toM <= joinM) {
      return [{ fromM: fromM + lengthM - joinM, toM: toM + lengthM - joinM }];
    }
    return [
      { fromM: 0, toM: toM - joinM },
      { fromM: fromM + lengthM - joinM, toM: lengthM },
    ];
  });
  return {
    spans: turned
      .filter((span) => span.toM - span.fromM >= ON_FOOT_SAID_M)
      .sort((a, b) => a.fromM - b.fromM),
    next: 0,
    said: false,
    endM: lengthM,
  };
}
