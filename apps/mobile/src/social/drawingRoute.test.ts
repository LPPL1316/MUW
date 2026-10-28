import drawing from "@shaperoute/shared-types/fixtures/drawing.json";
import type { DrawingDetail } from "@shaperoute/shared-types";

import {
  drawingGpx,
  drawnOf,
  followable,
  followedOf,
  gpxFileName,
  gpxTitle,
} from "./drawingRoute";

const DRAWING = drawing as DrawingDetail;

test("a track of two points or more can be followed", () => {
  expect(followable(DRAWING)).toBe(true);
  expect(followable({ track: [[46.0671, 11.1239]] })).toBe(false);
  expect(followable({ track: [] })).toBe(false);
});

test("the run follows the track, with the score for its likeness", () => {
  expect(followedOf(DRAWING)).toEqual({ points: DRAWING.track, similarity: 0.87 });
  expect(followedOf({ ...DRAWING, score: null }).similarity).toBe(0);
});

test("a bike or water drawing is followed as it was made, turned as shown", () => {
  expect(followedOf({ ...DRAWING, activity: "cycling", rotation_deg: 45 })).toEqual({
    points: DRAWING.track,
    similarity: 0.87,
    activity: "cycling",
    rotation_deg: 45,
  });
  // Null and missing say the same: north up.
  expect(followedOf({ ...DRAWING, rotation_deg: null })).not.toHaveProperty(
    "rotation_deg",
  );
});

test("the run saved draws what the drawing draws", () => {
  expect(drawnOf(DRAWING)).toEqual({
    shape: "star",
    word: null,
    style: null,
    title: null,
  });
  expect(drawnOf({ ...DRAWING, shape: null, word: "CIAO", style: "round" })).toEqual({
    shape: null,
    word: "CIAO",
    style: "round",
    title: null,
  });
});

test("the file is named by its title, else by what it draws", () => {
  expect(gpxTitle(DRAWING)).toBe("Sunday heart by the river");
  expect(gpxTitle({ ...DRAWING, title: null })).toBe("Star");
  expect(gpxTitle({ ...DRAWING, title: "  ", shape: null, word: "CIAO" })).toBe("CIAO");
  expect(gpxTitle({ ...DRAWING, title: null, shape: null, route_title: "Duomo" })).toBe(
    "Duomo",
  );
  expect(gpxTitle({ ...DRAWING, title: null, shape: null })).toBe("MuW");
});

test("the file name has only letters, digits and dashes", () => {
  expect(gpxFileName(DRAWING)).toBe("muw-star-4km.gpx");
  expect(gpxFileName({ ...DRAWING, shape: "dog_head", distance_m: 12_600 })).toBe(
    "muw-dog-head-13km.gpx",
  );
  expect(gpxFileName({ ...DRAWING, shape: null, word: "PERÙ!" })).toBe(
    "muw-PERU-4km.gpx",
  );
  // A picture, a run without a route: the drawing; never 0 km.
  expect(gpxFileName({ ...DRAWING, shape: null, distance_m: 300 })).toBe(
    "muw-drawing-1km.gpx",
  );
});

test("the GPX is the track alone: no time, no author, seven decimals", () => {
  const gpx = drawingGpx({
    ...DRAWING,
    title: 'Tom & "Jerry" <3',
    track: [
      [46.0671, 11.123993],
      [46.06712345678, 11.1344],
    ],
  });
  expect(gpx).toBe(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="MuW" xmlns="http://www.topografix.com/GPX/1/1">',
      "  <metadata>",
      "    <name>Tom &amp; &quot;Jerry&quot; &lt;3</name>",
      "  </metadata>",
      "  <trk>",
      "    <name>Tom &amp; &quot;Jerry&quot; &lt;3</name>",
      "    <trkseg>",
      '      <trkpt lat="46.0671000" lon="11.1239930"/>',
      '      <trkpt lat="46.0671235" lon="11.1344000"/>',
      "    </trkseg>",
      "  </trk>",
      "</gpx>",
      "",
    ].join("\n"),
  );
  expect(gpx).not.toContain("<time>");
  expect(gpx).not.toContain(DRAWING.author.username);
});
