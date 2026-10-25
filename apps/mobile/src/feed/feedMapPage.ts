import type { LatLon } from "@shaperoute/shared-types";

import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";
import { type LngLat, toLngLat } from "../map/coordinates";
import {
  MAP_BACKGROUND,
  MAPLIBRE_JS_SRI,
  MAPLIBRE_JS_URL,
  mapStyle,
} from "../map/mapPage";
import { turnedLine, unturnedPoint } from "./turnedLine";

/**
 * The map under a drawing of «Feed» (TASK-162, ADR-0131). A card is not a
 * map to move: it is a picture. One page, out of sight, frames each drawing
 * in turn with the app's own style and hands back a picture of it; the card
 * lays it under its line.
 */

/** How wide MapLibre's world is at zoom 0, in points. */
const WORLD = 512;

/**
 * Where the map looks to lie exactly under a line drawn by `thumbSegments`.
 * `bearing`, degrees clockwise from north, only for a map that is turned.
 */
export type Camera = { center: LngLat; zoom: number; bearing?: number };

/**
 * The camera that puts the map under `line` as `thumbSegments` draws it in a
 * box `width` × `height` with `pad`: the same fit, said the way MapLibre
 * wants it. A drawing is a few kilometres wide: over that, the map's
 * projection and the flat one of the line differ by less than a point.
 * With a `bearing` the map is turned (TASK-232), and lies under
 * `turnedLine(line, bearing)` drawn the same way.
 */
export function lineCamera(
  line: LatLon[],
  width: number,
  height: number,
  pad: number,
  bearing: number = 0,
): Camera | null {
  if (line.length < 2) {
    return null;
  }
  if (bearing !== 0) {
    // The fit of the line turned, then its middle back where it is.
    const turned = lineCamera(turnedLine(line, bearing), width, height, pad);
    if (turned === null) {
      return null;
    }
    const [lon, lat] = turned.center;
    return {
      center: toLngLat(unturnedPoint([lat, lon], line, bearing)),
      zoom: turned.zoom,
      bearing,
    };
  }
  const midLat = line.reduce((sum, [lat]) => sum + lat, 0) / line.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const lats = line.map(([lat]) => lat);
  const lons = line.map(([, lon]) => lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const spanX = Math.max((maxLon - minLon) * k, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);
  // Points for a degree of latitude, as in `thumbSegments`.
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  return {
    center: [(minLon + maxLon) / 2, (minLat + maxLat) / 2],
    // At zoom z a degree of longitude is WORLD · 2^z / 360 points.
    zoom: Math.log2((scale * k * 360) / WORLD),
  };
}

/** From the app to the page: the map to take a picture of, and how large. */
export type Shoot = {
  type: "shoot";
  key: string;
  center: LngLat;
  zoom: number;
  /** Degrees clockwise from north; without it, north up. */
  bearing?: number;
  width: number;
  height: number;
};

/** From the page to the app. */
export type FromFeedMapPage =
  | { type: "ready" }
  /** The picture, as a `data:` address an `Image` can show. */
  | { type: "shot"; key: string; image: string }
  /** A tile did not come: no picture is better than half a map. */
  | { type: "miss"; key: string }
  | { type: "error"; message: string };

/** JavaScript that hands a message to the page. */
export function feedMapScript(message: Shoot): string {
  // The trailing `true` is what injectJavaScript expects as a result.
  return `window.shaperoute && window.shaperoute.receive(${JSON.stringify(message)}); true;`;
}

/** Reads a message posted by the page; anything unexpected gives null. */
export function parseFeedMapMessage(data: string): FromFeedMapPage | null {
  let message: unknown;
  try {
    message = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return null;
  }
  if (message.type === "ready") {
    return { type: "ready" };
  }
  if (
    message.type === "error" &&
    "message" in message &&
    typeof message.message === "string"
  ) {
    return { type: "error", message: message.message };
  }
  if (!("key" in message) || typeof message.key !== "string") {
    return null;
  }
  if (message.type === "miss") {
    return { type: "miss", key: message.key };
  }
  if (
    message.type === "shot" &&
    "image" in message &&
    typeof message.image === "string" &&
    message.image.startsWith("data:image/")
  ) {
    return { type: "shot", key: message.key, image: message.image };
  }
  return null;
}

/** As in `mapPage`: `<` escaped, so no string of the style closes the script. */
function toScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * The page that takes the pictures: MapLibre GL JS as in `mapPage`, the same
 * style, nothing to touch and no controls. The map is made at the first
 * picture asked for, so it never loads a place nobody looks at. The places
 * are named in `language`, as on the app's map (TASK-210, part H).
 */
export function buildFeedMapPage(language: Language = appLanguage()): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body, #map { margin: 0; background: ${MAP_BACKGROUND}; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }
</script>
<script src="${MAPLIBRE_JS_URL}" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"
  onerror="post({ type: 'error', message: 'MapLibre GL JS did not load' })"></script>
<script>
  (function () {
    if (!window.maplibregl) {
      return;
    }
    var box = document.getElementById("map");
    var map = null;
    var missed = false;
    var asked = null;
    function shoot(message) {
      missed = false;
      asked = message.key;
      // North up unless the picture is asked turned: the map before may have been.
      var bearing = message.bearing || 0;
      // The picture is as large as the drawing it goes under.
      box.style.width = message.width + "px";
      box.style.height = message.height + "px";
      if (map) {
        map.resize();
        map.jumpTo({ center: message.center, zoom: message.zoom, bearing: bearing });
        // A camera that did not move draws nothing, and nothing would answer.
        map.triggerRepaint();
      } else {
        map = new maplibregl.Map({
          container: "map",
          style: ${toScript(mapStyle(language))},
          center: message.center,
          zoom: message.zoom,
          bearing: bearing,
          interactive: false,
          attributionControl: false,
          fadeDuration: 0,
          // Without it the canvas is empty by the time it is read.
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
        map.on("error", function () {
          missed = true;
        });
      }
      // Every tile in view is drawn, or has failed.
      map.once("idle", function () {
        if (asked !== message.key) {
          // Given up on: the app has asked for another one since.
          return;
        }
        if (missed) {
          post({ type: "miss", key: message.key });
        } else {
          post({
            type: "shot",
            key: message.key,
            image: map.getCanvas().toDataURL("image/jpeg", 0.85),
          });
        }
      });
    }
    window.shaperoute = {
      receive: function (message) {
        if (message.type === "shoot") {
          shoot(message);
        }
      },
    };
    post({ type: "ready" });
  })();
</script>
</body>
</html>
`;
}
