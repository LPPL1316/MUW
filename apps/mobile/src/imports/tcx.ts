import {
  type FilePoint,
  type FileTrack,
  isoTimeMs,
  positionOf,
  sportOfWord,
} from "./fileTrack";
import { attribute, childText, elements, numberOf } from "./xml";

/** Whether `text` is a TCX file: its root is <TrainingCenterDatabase>. */
export function isTcx(text: string): boolean {
  return /<(?:[\w.-]+:)?TrainingCenterDatabase[\s>]/.test(text.slice(0, 4096));
}

/**
 * A TCX file (TASK-312), as Garmin Connect and Strava export an activity:
 * every <Trackpoint>, in order, with its <Time> and its <Position> when it
 * has one (a treadmill run has none), and the Sport of the first
 * <Activity> («Running», «Biking»).
 */
export function readTcx(text: string): FileTrack {
  const points: FilePoint[] = [];
  for (const { body } of elements(text, "Trackpoint")) {
    const time = childText(body, "Time");
    points.push({
      point: positionOf(
        numberOf(childText(body, "LatitudeDegrees")),
        numberOf(childText(body, "LongitudeDegrees")),
      ),
      timeMs: time === null ? null : isoTimeMs(time),
    });
  }
  let sport: FileTrack["sport"] = null;
  for (const activity of elements(text, "Activity")) {
    const name = attribute(activity.attributes, "Sport");
    sport = name === null ? null : sportOfWord(name);
    break;
  }
  return { points, sport };
}
