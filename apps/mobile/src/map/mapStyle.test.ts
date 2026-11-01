import { BRIGHTNESS_STEPS } from "../theme/tone";
import { color, paletteOf } from "../theme/tokens";

import {
  ATTRIBUTION,
  darkMapStyle,
  GLYPHS_URL,
  mapStyleFor,
  placeName,
  TILE_SOURCE_URL,
} from "./mapStyle";

const sgravaDarkStyle = darkMapStyle("en");

/**
 * These tests catch the mistakes that make a MapLibre style fail *silently*:
 * a vector layer without `source-layer`, a layer pointing at a source that is
 * not declared, a duplicate id. None of them throws — the map just comes up
 * missing a layer, which is easy to miss on a phone.
 *
 * What they cannot check is whether the tiles and glyphs actually answer: that
 * needs the network and a real map. See `docs/tasks/TASK-046.md`.
 */

const vectorLayers = sgravaDarkStyle.layers.filter(
  (layer) => layer.type !== "background",
);

describe("sgravaDarkStyle", () => {
  it("is a version 8 style with one declared source", () => {
    expect(sgravaDarkStyle.version).toBe(8);
    expect(Object.keys(sgravaDarkStyle.sources)).toEqual(["openmaptiles"]);
    expect(sgravaDarkStyle.sources.openmaptiles.url).toBe(TILE_SOURCE_URL);
    expect(sgravaDarkStyle.glyphs).toBe(GLYPHS_URL);
  });

  it("keeps the OpenStreetMap attribution, which the licence requires", () => {
    expect(sgravaDarkStyle.sources.openmaptiles.attribution).toBe(ATTRIBUTION);
    expect(ATTRIBUTION).toContain("openstreetmap.org/copyright");
  });

  it("also credits the tile provider and the tile schema", () => {
    // The source's attribution overrides the TileJSON's, so it must carry all three.
    expect(ATTRIBUTION).toContain("openfreemap.org");
    expect(ATTRIBUTION).toContain("OpenMapTiles");
  });

  it("gives every data layer a source and a source-layer", () => {
    for (const layer of vectorLayers) {
      expect(layer).toHaveProperty("source", "openmaptiles");
      expect(typeof (layer as { "source-layer"?: unknown })["source-layer"]).toBe(
        "string",
      );
    }
  });

  it("has no duplicate layer ids", () => {
    const ids = sgravaDarkStyle.layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("draws bigger roads after smaller ones, so they sit on top", () => {
    const ids = sgravaDarkStyle.layers.map((layer) => layer.id);
    expect(ids.indexOf("road-faint")).toBeLessThan(ids.indexOf("road-minor"));
    expect(ids.indexOf("road-minor")).toBeLessThan(ids.indexOf("road-medium"));
    expect(ids.indexOf("road-medium")).toBeLessThan(ids.indexOf("road-major"));
  });

  it("takes every colour from the tokens, so the map cannot drift", () => {
    const known = new Set<string>(Object.values(color.map));
    const used = JSON.stringify(sgravaDarkStyle).match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const hex of used) {
      expect(known.has(hex)).toBe(true);
    }
  });

  it("never paints anything in the brand yellow: that is the route's alone", () => {
    expect(JSON.stringify(sgravaDarkStyle)).not.toContain(color.accent);
  });
});

describe("the names on the map (TASK-210 F)", () => {
  const labels = (language: Parameters<typeof darkMapStyle>[0]) =>
    darkMapStyle(language).layers.find((layer) => layer.id === "place-label");

  it.each(["en", "de", "it", "es", "fr"] as const)(
    "are in «%s», or the place's own name where the map has none",
    (language) => {
      expect(placeName(language)).toEqual([
        "coalesce",
        ["get", `name:${language}`],
        ["get", "name"],
      ]);
      expect(labels(language)).toHaveProperty(
        ["layout", "text-field"],
        placeName(language),
      );
    },
  );

  it("are no longer Italian whatever the language", () => {
    expect(JSON.stringify(darkMapStyle("de"))).not.toContain("name:it");
    // Only the names change: the rest of the style is the same.
    const without = (language: Parameters<typeof darkMapStyle>[0]) =>
      JSON.stringify(darkMapStyle(language)).replace(`name:${language}`, "");
    expect(without("de")).toBe(without("fr"));
  });
});

describe("mapStyleFor", () => {
  it("is the app's style in the app's own palette", () => {
    expect(mapStyleFor(color, "en")).toEqual(darkMapStyle("en"));
  });

  it("takes every colour from the palette it is given (TASK-351)", () => {
    const light = paletteOf({ tone: "light", dark: 0, light: BRIGHTNESS_STEPS - 1 });
    const style = mapStyleFor(light, "it");
    const known = new Set<string>(Object.values(light.map));
    const used = JSON.stringify(style).match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(used.length).toBeGreaterThan(0);
    for (const hex of used) {
      expect(known.has(hex)).toBe(true);
    }
    expect(JSON.stringify(style)).toContain('"name:it"');
  });
});
