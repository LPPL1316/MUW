import type { LatLon } from "@shaperoute/shared-types";

import { lineCamera } from "../feed/feedMapPage";
import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import {
  HILLSHADE,
  hillshadeOf,
  PITCH_3D,
  TERRAIN,
  TERRAIN_ATTRIBUTION,
  TERRAIN_MAX_ZOOM,
  TERRAIN_SPEC,
  TERRAIN_TILES_URL,
} from "../map/mapKindStyle";
import { mapStyleFor } from "../map/mapStyle";
import type { Palette } from "../theme/tokens";
import { NIGHT } from "./videoStyle";

/**
 * The map under a run's video (TASK-351, ADR-0303): the app's own map
 * style in the tone the video asks for, and the camera that lays it exactly
 * under the line the scene draws, as the Feed lays its map under a drawing
 * (ADR-0131). The hidden page draws it once, at the size of a phone's
 * screen times three, and composes every picture of the video over that
 * one picture.
 *
 * On «3D» (part D) the map leans on its hills, as the app's 3D map does
 * (TASK-264), and the page lays the run's line on them itself, picture by
 * picture: the camera turns a little around the run when a picture of the
 * leaning map costs the phone less than `FRAME_BUDGET_MS`, else the one
 * picture is zoomed slowly (the user's choice 4).
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
/** The credit of the hills' heights, with it on «3D» (the user's choice 6). */
export const TERRAIN_CREDIT = "Terrain Tiles";

/** On «3D» the camera turns from this many degrees before the drawing's
 * bearing to as many after it, over the whole video, slow at both ends. */
export const TURN_DEG = 10;
/** The most a picture of the turning map may cost on the phone, in
 * milliseconds, for the camera to turn: the page measures it on a dry run
 * before the video. Over it, the map stands still. */
export const FRAME_BUDGET_MS = 25;
/** The still picture zoomed slowly from 1 to this, about the drawing. */
export const STILL_ZOOM = 1.06;

/** Where the drawing lies on the map, in points: a box with its padding. */
export type MapBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  pad: number;
};

/** The run's line as the page lays it on the hills: each point as
 * longitude, then latitude, as MapLibre takes it. */
export type MapLine = [number, number][];

type MapStyle = ReturnType<typeof mapStyleFor>;

/** The map's style with the hills in it: a layer more, two sources more. */
export type ReliefStyle = Omit<MapStyle, "sources" | "layers"> & {
  sources: Record<string, unknown>;
  layers: readonly Record<string, unknown>[];
};

/** What the page needs to draw the map: the style, the size, the camera,
 * and on «3D» the hills, the turn and the line. */
export type VideoMap = {
  style: MapStyle | ReliefStyle;
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
  /** Points kept clear inside the box's edges: the line's own width. */
  pad: number;
  /** The hills under the map, as `map.setTerrain` takes them; null on a
   * flat map. */
  terrain: { source: string; exaggeration: number } | null;
  /** The camera's turn, in degrees about `camera.bearing`, from the first
   * picture to the last; null when the map stands still. */
  turn: { from: number; to: number } | null;
  /** The most a picture of the turning map may cost, in milliseconds. */
  budgetMs: number;
  /** The line the page lays on the hills itself; empty on a flat map,
   * where the scene's own pixels lie on the map. */
  line: MapLine;
  waitMs: number;
};

/**
 * `mapStyleFor` with the heights of the hills and their shading in it, as
 * the app's 3D map has them (mapKindStyle, TASK-264), in the colours of
 * `palette`: the shading over the land, under the roads and the names. Two
 * sources of the same heights, as there: MapLibre draws the shading poorly
 * from the one the terrain uses.
 */
export function reliefStyle(palette: Palette, language: Language): ReliefStyle {
  const base = mapStyleFor(palette, language);
  const heights = {
    type: "raster-dem",
    tiles: [TERRAIN_TILES_URL],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: TERRAIN_MAX_ZOOM,
    attribution: TERRAIN_ATTRIBUTION,
  };
  const layers: Record<string, unknown>[] = [...base.layers];
  const lastFill = layers.map((layer) => layer.type).lastIndexOf("fill");
  layers.splice(lastFill + 1, 0, {
    id: HILLSHADE,
    type: "hillshade",
    source: HILLSHADE,
    paint: hillshadeOf("dark", palette),
  });
  return {
    ...base,
    sources: { ...base.sources, [TERRAIN]: heights, [HILLSHADE]: heights },
    layers,
  };
}

/**
 * The map under `track` as the scene draws it in `box`, turned by
 * `bearing` (TASK-232), in the colours of `palette` and with the places
 * named in `language`. With `relief`, the map leans on its hills and the
 * page lays `relief.line` on them. Null when the track has nothing to
 * frame.
 */
export function videoMap(
  track: LatLon[],
  box: MapBox,
  bearing: number,
  palette: Palette = NIGHT,
  language: Language = appLanguage(),
  relief: { line: readonly LatLon[] } | null = null,
): VideoMap | null {
  const camera = lineCamera(track, box.width, box.height, box.pad, bearing);
  if (camera === null) {
    return null;
  }
  return {
    style:
      relief === null ? mapStyleFor(palette, language) : reliefStyle(palette, language),
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    pixelRatio: MAP_PIXEL_RATIO,
    camera: {
      center: camera.center,
      zoom: camera.zoom,
      bearing,
      pitch: relief === null ? 0 : PITCH_3D,
      padding: {
        top: box.top,
        bottom: MAP_HEIGHT - box.top - box.height,
        left: box.left,
        right: MAP_WIDTH - box.left - box.width,
      },
    },
    pad: box.pad,
    terrain: relief === null ? null : TERRAIN_SPEC,
    turn: relief === null ? null : { from: -TURN_DEG, to: TURN_DEG },
    budgetMs: FRAME_BUDGET_MS,
    line: relief === null ? [] : relief.line.map(([lat, lon]) => [lon, lat]),
    waitMs: MAP_WAIT_MS,
  };
}
