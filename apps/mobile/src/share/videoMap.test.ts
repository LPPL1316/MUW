import type { LatLon } from "@shaperoute/shared-types";

import { PITCH_3D, TERRAIN_SPEC, TERRAIN_TILES_URL } from "../map/mapKindStyle";
import { BRIGHTNESS_STEPS } from "../theme/tone";
import { paletteOf, SHADES } from "../theme/tokens";
import {
  FRAME_BUDGET_MS,
  MAP_CREDIT,
  MAP_HEIGHT,
  MAP_PIXEL_RATIO,
  MAP_WAIT_MS,
  MAP_WIDTH,
  STILL_ZOOM,
  TERRAIN_CREDIT,
  TURN_DEG,
  videoMap,
} from "./videoMap";
import { NIGHT } from "./videoStyle";

/** A straight line north, a point every 50 m. */
function north(metres: number): LatLon[] {
  return Array.from({ length: metres / 50 + 1 }, (_, i): LatLon => [
    46.07 + (i * 50) / 111_195,
    11.12,
  ]);
}

/** The drawing's box of the video, in points of the map. */
const BOX = { left: 28.8, top: 128, width: 302.4, height: 320, pad: 7.2 };

describe("videoMap", () => {
  it("is the phone's screen three times over: the video's size", () => {
    expect(MAP_WIDTH * MAP_PIXEL_RATIO).toBe(1080);
    expect(MAP_HEIGHT * MAP_PIXEL_RATIO).toBe(1920);
  });

  it("frames the track in its box, keeping the rest of the map clear around it", () => {
    const map = videoMap(north(4800), BOX, 0);
    expect(map).not.toBeNull();
    expect(map?.camera.center[0]).toBeCloseTo(11.12, 6);
    expect(map?.camera.center[1]).toBeCloseTo(46.07 + 2400 / 111_195, 5);
    expect(map?.camera.zoom).toBeGreaterThan(11);
    expect(map?.camera.zoom).toBeLessThan(13);
    expect(map?.camera.bearing).toBe(0);
    expect(map?.camera.padding).toEqual({
      top: 128,
      bottom: MAP_HEIGHT - 128 - 320,
      left: 28.8,
      right: MAP_WIDTH - 28.8 - 302.4,
    });
    expect(map?.waitMs).toBe(MAP_WAIT_MS);
  });

  it("turns with the drawing", () => {
    expect(videoMap(north(4800), BOX, -90)?.camera.bearing).toBe(-90);
  });

  it("is null with nothing to frame", () => {
    expect(videoMap([], BOX, 0)).toBeNull();
    expect(videoMap([[46.07, 11.12]], BOX, 0)).toBeNull();
  });

  it("styles the map in the night, the places named in the language asked", () => {
    const map = videoMap(north(4800), BOX, 0, NIGHT, "de");
    const known = new Set<string>(Object.values(NIGHT.map));
    const used = JSON.stringify(map?.style).match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const hex of used) {
      expect(known.has(hex)).toBe(true);
    }
    expect(JSON.stringify(map?.style)).toContain('"name:de"');
    expect(JSON.stringify(map?.style)).not.toContain(NIGHT.accent);
  });

  it("takes another palette for another look", () => {
    const day = paletteOf({ tone: "light", dark: 0, light: BRIGHTNESS_STEPS - 1 });
    const map = videoMap(north(4800), BOX, 0, day, "en");
    expect(JSON.stringify(map?.style)).toContain(day.map.background);
    expect(JSON.stringify(map?.style)).not.toContain(NIGHT.map.background);
  });

  it("is the dark tone at its darkest, whatever tone the app is in", () => {
    expect(NIGHT.background).toBe(SHADES.dark.darkest.background);
    expect(NIGHT.map).toEqual(SHADES.dark.darkest.map);
    expect(NIGHT.text).toBe(SHADES.dark.darkest.text);
  });

  it("credits the map's makers, as their licences ask; on 3D the hills' heights too", () => {
    expect(MAP_CREDIT).toContain("OpenStreetMap");
    expect(MAP_CREDIT).toContain("OpenFreeMap");
    expect(TERRAIN_CREDIT).toBe("Terrain Tiles");
  });

  it("lies flat, with nothing for the page to lay on hills", () => {
    const map = videoMap(north(4800), BOX, 0);
    expect(map?.camera.pitch).toBe(0);
    expect(map?.terrain).toBeNull();
    expect(map?.turn).toBeNull();
    expect(map?.line).toEqual([]);
    expect(map?.pad).toBe(BOX.pad);
    expect(map?.budgetMs).toBe(FRAME_BUDGET_MS);
    expect(JSON.stringify(map?.style)).not.toContain("hillshade");
  });

  it("leans on its hills on 3D, the line given to the page as longitude and latitude", () => {
    const line = north(4800);
    const map = videoMap(line, BOX, -45, NIGHT, "en", { line });
    expect(map?.camera.pitch).toBe(PITCH_3D);
    expect(map?.camera.bearing).toBe(-45);
    expect(map?.camera.zoom).toBe(videoMap(line, BOX, -45)?.camera.zoom);
    expect(map?.terrain).toEqual(TERRAIN_SPEC);
    expect(map?.turn).toEqual({ from: -TURN_DEG, to: TURN_DEG });
    expect(STILL_ZOOM).toBeGreaterThan(1);
    expect(map?.line).toHaveLength(line.length);
    expect(map?.line[0]).toEqual([11.12, 46.07]);
    const style = map?.style as unknown as {
      sources: Record<string, { type: string; tiles?: string[]; encoding?: string }>;
      layers: { id: string; type: string }[];
    };
    expect(style.sources.terrain).toEqual(
      expect.objectContaining({
        type: "raster-dem",
        tiles: [TERRAIN_TILES_URL],
        encoding: "terrarium",
      }),
    );
    expect(style.sources.hillshade).toEqual(style.sources.terrain);
    // The shading over the land, under the roads and the names.
    const types = style.layers.map((layer) => layer.type);
    expect(types.indexOf("hillshade")).toBe(types.lastIndexOf("fill") + 1);
    expect(style.layers.filter((layer) => layer.type === "hillshade")).toHaveLength(1);
    // Its colours from the night's palette, nothing hand-written.
    const known = new Set<string>([
      ...Object.values(NIGHT.map),
      NIGHT.background,
      NIGHT.borderStrong,
    ]);
    for (const hex of JSON.stringify(style).match(/#[0-9A-Fa-f]{6}/g) ?? []) {
      expect(known.has(hex)).toBe(true);
    }
  });
});
