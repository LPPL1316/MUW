import type { Language } from "../i18n/languages";
import { color, type Palette } from "../theme/tokens";

/**
 * A dark MapLibre style for Sgrava, written here instead of fetched.
 *
 * `mapPage.ts` currently points at OpenFreeMap's "liberty" style, which is
 * light: a yellow route on it is close to invisible, and the app's own dark
 * chrome sits on a white map. Liberty is also somebody else's file, so its
 * colours can change under us.
 *
 * This style uses the same tiles — OpenFreeMap's OpenMapTiles vector source,
 * no key needed — and decides every colour from `theme/tokens`. The map and
 * the panel above it can no longer drift apart.
 *
 * Source schema: OpenMapTiles. The `source-layer` names below (water, park,
 * landcover, landuse, building, transportation, place) are that schema's, not
 * ours: renaming them breaks the map silently.
 */

/** TileJSON for OpenFreeMap's planet-wide vector tiles. */
export const TILE_SOURCE_URL = "https://tiles.openfreemap.org/planet";

/**
 * Glyphs for the labels. The font stack must be one OpenFreeMap actually
 * serves: a name it does not have means labels quietly do not draw, while the
 * rest of the map is fine. Check the labels on the phone, not in a test.
 */
export const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const LABEL_FONT = ["Noto Sans Regular"];

/**
 * The credit line the tile provider asks for, word for word from its TileJSON:
 * OpenFreeMap, the OpenMapTiles schema (CC-BY) and the OpenStreetMap data
 * (ODbL) all require it to stay visible. A source's own `attribution` replaces
 * the TileJSON's in MapLibre, so leaving any of the three out here drops it
 * from the map.
 */
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/** Roads grouped the way they should look, not the way OSM tags them. */
const FAINT_ROADS = ["path", "track", "service"];
const MINOR_ROADS = ["minor"];
const MEDIUM_ROADS = ["secondary", "tertiary"];
const MAJOR_ROADS = ["motorway", "trunk", "primary"];

function roadFilter(classes: readonly string[]) {
  return ["match", ["get", "class"], [...classes], true, false];
}

/** Line width by zoom: hairlines when far out, walkable streets when close. */
function roadWidth(far: number, mid: number, near: number) {
  return ["interpolate", ["linear"], ["zoom"], 10, far, 14, mid, 18, near];
}

/**
 * A place's name in `language` (TASK-210 F): «München» in German, "Munich"
 * in English, and the name on the spot where the map has none in it. The
 * tiles carry OpenStreetMap's `name:xx` for each of the app's languages.
 */
export function placeName(language: Language) {
  return ["coalesce", ["get", `name:${language}`], ["get", "name"]];
}

/**
 * The style with the places named in `language`, in the colours of
 * `palette`: the app's own palette for the map on screen, another tone's for
 * a run's video (TASK-351), which is for whoever watches it.
 */
export function mapStyleFor(palette: Palette, language: Language) {
  return {
    version: 8,
    name: "MuW Dark",
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: {
        type: "vector",
        url: TILE_SOURCE_URL,
        attribution: ATTRIBUTION,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": palette.map.background },
      },
      {
        id: "landuse-built-up",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landuse",
        filter: [
          "match",
          ["get", "class"],
          ["residential", "suburb", "neighbourhood"],
          true,
          false,
        ],
        paint: { "fill-color": palette.map.builtUp },
      },
      {
        id: "landcover-green",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "grass", "farmland"], true, false],
        paint: { "fill-color": palette.map.green },
      },
      {
        id: "park",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "park",
        paint: { "fill-color": palette.map.green },
      },
      {
        id: "water",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        paint: { "fill-color": palette.map.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "openmaptiles",
        "source-layer": "waterway",
        minzoom: 9,
        paint: {
          "line-color": palette.map.waterLine,
          "line-width": roadWidth(0.4, 1, 2.5),
        },
      },
      {
        id: "building",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: { "fill-color": palette.map.building, "fill-opacity": 0.85 },
      },
      // Roads, faintest first: the later a layer is listed, the higher it draws.
      {
        id: "road-faint",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 13,
        filter: roadFilter(FAINT_ROADS),
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": palette.map.roadFaint,
          "line-width": roadWidth(0.3, 0.8, 3),
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        minzoom: 11,
        filter: roadFilter(MINOR_ROADS),
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": palette.map.roadMinor,
          "line-width": roadWidth(0.4, 1.2, 5),
        },
      },
      {
        id: "road-medium",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: roadFilter(MEDIUM_ROADS),
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": palette.map.roadMedium,
          "line-width": roadWidth(0.7, 2, 7),
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "openmaptiles",
        "source-layer": "transportation",
        filter: roadFilter(MAJOR_ROADS),
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": palette.map.roadMajor,
          "line-width": roadWidth(1, 3, 10),
        },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        filter: ["match", ["get", "class"], ["city", "town", "village"], true, false],
        layout: {
          "text-field": placeName(language),
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 14, 15],
          "text-letter-spacing": 0.08,
          "text-max-width": 8,
        },
        paint: {
          "text-color": palette.map.label,
          "text-halo-color": palette.map.labelHalo,
          "text-halo-width": 1.2,
        },
      },
    ],
  } as const;
}

/** The style with the places named in `language`, in the tone the app is shown in. */
export const darkMapStyle = (language: Language) => mapStyleFor(color, language);
