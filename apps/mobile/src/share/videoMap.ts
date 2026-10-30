import type { LatLon } from "@shaperoute/shared-types";

import { lineCamera } from "../feed/feedMapPage";
import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import { mapStyleFor } from "../map/mapStyle";
import { BRIGHTNESS_STEPS } from "../theme/tone";
import { type Palette, paletteOf } from "../theme/tokens";

/**
 * The map under a run's video (TASK-351, ADR-0303): the app's own map
 * style in the tone the video asks for, and the camera that lays it exactly
 * under the line the scene draws, as the Feed lays its map under a drawing
 * (ADR-0131). The hidden page draws it once, at the size of a phone's
 * screen times three, and composes every picture of the video over that
 * one picture.
 */

/** The map's size in points, and its pixel ratio: 360 × 640 at 3 is the
 * video, with the names as large as on a phone's screen. */
export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 640;
export const MAP_PIXEL_RATIO = 3;

/** How long the page waits for every tile in view before the video goes on
 * without the map, on the yellow of the post (a condition of TASK-351). */
export const MAP_WAIT_MS = 15_000;

/** The credit the map's licences ask for wherever the map shows: the last
 * line of the video. */
export const MAP_CREDIT = "© OpenStreetMap contributors · OpenFreeMap";

/** The dark tone at its darkest: the night of the video, whatever tone the
 * app is shown in, since the video is for whoever watches it. */
export const NIGHT: Palette = paletteOf({
  tone: "dark",
  dark: 0,
  light: BRIGHTNESS_STEPS - 1,
});

/** Where the drawing lies on the map, in points: a box with its padding. */
export type MapBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  pad: number;
};

/** What the page needs to draw the map: the style, the size, the camera. */
export type VideoMap = {
  style: ReturnType<typeof mapStyleFor>;
  width: number;
  height: number;
  pixelRatio: number;
  camera: {
    /** Longitude, then latitude, as MapLibre takes it. */
    center: [number, number];
    zoom: number;
    /** Degrees clockwise from north. */
    bearing: number;
    pitch: number;
    /** Points kept clear on each side: the centre sits in the middle of
     * what is left, so the drawing lies in its box. */
    padding: { top: number; bottom: number; left: number; right: number };
  };
  waitMs: number;
};

/**
 * The map under `track` as the scene draws it in `box`, turned by
 * `bearing` (TASK-232), in the colours of `palette` and with the places
 * named in `language`. Null when the track has nothing to frame.
 */
export function videoMap(
  track: LatLon[],
  box: MapBox,
  bearing: number,
  palette: Palette = NIGHT,
  language: Language = appLanguage(),
): VideoMap | null {
  const camera = lineCamera(track, box.width, box.height, box.pad, bearing);
  if (camera === null) {
    return null;
  }
  return {
    style: mapStyleFor(palette, language),
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    pixelRatio: MAP_PIXEL_RATIO,
    camera: {
      center: camera.center,
      zoom: camera.zoom,
      bearing,
      pitch: 0,
      padding: {
        top: box.top,
        bottom: MAP_HEIGHT - box.top - box.height,
        left: box.left,
        right: MAP_WIDTH - box.left - box.width,
      },
    },
    waitMs: MAP_WAIT_MS,
  };
}
