import {
  type FilePoint,
  type FileTrack,
  isoTimeMs,
  positionOf,
  sportOfWord,
} from "./fileTrack";
import { attribute, childText, elements, numberOf } from "./xml";

/** Whether `text` is a GPX file: its root element is <gpx>. */
export function isGpx(text: string): boolean {
  return /<(?:[\w.-]+:)?gpx[\s>]/.test(text.slice(0, 4096));
}

/**
 * A GPX file (TASK-312), as Strava, Garmin Connect, Komoot and most apps
 * export an activity: the points of its tracks (<trkpt lat lon> with
 * <time>), in order, and the <type> of the first track. A file with no
 * track gives its route's points (<rtept>) instead: they have no times, and
 * `importFile` says it is a route, not an activity.
 */
export function readGpx(text: string): FileTrack {
  let points = pointsOf(text, "trkpt");
  if (points.length === 0) {
    points = pointsOf(text, "rtept");
  }
  let sport: FileTrack["sport"] = null;
  for (const track of elements(text, "trk")) {
    const type = childText(track.body, "type");
    sport = type === null ? null : sportOfWord(type);
    break;
  }
  return { points, sport };
}

function pointsOf(text: string, name: string): FilePoint[] {
  const points: FilePoint[] = [];
  for (const { attributes, body } of elements(text, name)) {
    const time = childText(body, "time");
    points.push({
      point: positionOf(
        numberOf(attribute(attributes, "lat")),
        numberOf(attribute(attributes, "lon")),
      ),
      timeMs: time === null ? null : isoTimeMs(time),
    });
  }
  return points;
}
