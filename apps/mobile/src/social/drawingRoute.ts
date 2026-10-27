import type { DrawingDetail, LatLon } from "@shaperoute/shared-types";

import type { Drawn } from "../activities/recordedRun";
import { shapeName } from "../i18n/shapeNames";

/**
 * A drawing opened on the map as a route to run or take away (TASK-307):
 * its track as the map shows it, the only line the API gives of a run,
 * never its first and last DRAWING_CUT_M metres nor its times. The track is
 * where the runner went, not a planned route on the graph: it is followed
 * without turn directions.
 */

/** The fields of a drawing these need. */
type Followed = Pick<
  DrawingDetail,
  | "title"
  | "shape"
  | "word"
  | "style"
  | "route_title"
  | "distance_m"
  | "score"
  | "activity"
  | "rotation_deg"
  | "track"
>;

/** The GPX says it was written by the app, never by a person. */
const CREATOR = "MuW";

/** As the engine's GPX (GPX.md): about a centimetre. */
const DECIMALS = 7;

/** Whether there is a line to follow: two points at least. */
export function followable(drawing: Pick<DrawingDetail, "track">): boolean {
  return drawing.track.length >= 2;
}

/** What the drawing draws, for the run that follows it: «My activities»
 * and its post say it as the drawing does. */
export function drawnOf(drawing: Followed): Drawn {
  return {
    shape: drawing.shape,
    word: drawing.word,
    style: drawing.style,
    title: drawing.route_title,
  };
}

/** The run along the drawing's track, as App.tsx follows a route. The
 * likeness of the track to its shape is not known: the score of the run
 * stands for it, as for an example of «Feed» (TASK-188). Followed by bike
 * or on the water as it was made; turned as it is shown (TASK-232). */
export function followedOf(drawing: Followed): {
  points: LatLon[];
  similarity: number;
  activity?: DrawingDetail["activity"];
  rotation_deg?: number;
} {
  return {
    points: drawing.track,
    similarity: (drawing.score ?? 0) / 100,
    ...(drawing.activity !== undefined ? { activity: drawing.activity } : {}),
    ...(drawing.rotation_deg != null ? { rotation_deg: drawing.rotation_deg } : {}),
  };
}

/** The name in the file: the owner's title, else what it draws, else the app's. */
export function gpxTitle(drawing: Followed): string {
  if (drawing.title !== null && drawing.title.trim() !== "") {
    return drawing.title.trim();
  }
  if (drawing.shape !== null) {
    return shapeName(drawing.shape);
  }
  return drawing.word ?? drawing.route_title ?? CREATOR;
}

/** Only letters, digits and dashes: some apps refuse other names (GPX.md). */
function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** «muw-heart-5km.gpx», «muw-CIAO-12km.gpx», «muw-drawing-4km.gpx»: what
 * it draws by the catalogue's name, and the km of the run, whole. */
export function gpxFileName(drawing: Followed): string {
  const what = slug(drawing.shape ?? drawing.word ?? "") || "drawing";
  const km = Math.max(1, Math.round(drawing.distance_m / 1000));
  return `muw-${what}-${km}km.gpx`;
}

function escaped(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The track as GPX 1.1: one `<trk>`, one `<trkseg>`, as the engine writes a
 * route (GPX.md). No time anywhere, no author, no elevation, no OSM credit:
 * the line is the runner's GPS, not data of OpenStreetMap.
 */
export function drawingGpx(drawing: Followed): string {
  const name = escaped(gpxTitle(drawing));
  const points = drawing.track.map(
    ([lat, lon]) =>
      `      <trkpt lat="${lat.toFixed(DECIMALS)}" lon="${lon.toFixed(DECIMALS)}"/>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${CREATOR}" xmlns="http://www.topografix.com/GPX/1/1">`,
    "  <metadata>",
    `    <name>${name}</name>`,
    "  </metadata>",
    "  <trk>",
    `    <name>${name}</name>`,
    "    <trkseg>",
    ...points,
    "    </trkseg>",
    "  </trk>",
    "</gpx>",
    "",
  ].join("\n");
}
