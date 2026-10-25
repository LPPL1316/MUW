import { color, onFoot, walk } from "../theme/tokens";
import { withKinds } from "./mapKindStyle";
import {
  buildMapPage,
  FOLLOW_ZOOM,
  HEADING_ARROW_SVG,
  isExternalUrl,
  MAP_BACKGROUND,
  MAP_STYLE,
  mapStyle,
  MAPLIBRE_CSS_SRI,
  MAPLIBRE_CSS_URL,
  MAPLIBRE_JS_SRI,
  MAPLIBRE_JS_URL,
  MAPLIBRE_VERSION,
  ON_FOOT_COLOR,
  ON_FOOT_DASH,
  ON_FOOT_WIDTH,
  POSITION_COLOR,
  OTHER_ROUTE_COLOR,
  OTHER_ROUTE_WIDTH,
  ROUTE_COLOR,
  ROUTE_WIDTH,
  START_HERE_COLOR,
  START_HERE_LABEL,
  TRACK_WIDTH,
  WALK_COLOR,
  WALK_DASH,
  WALK_WIDTH,
} from "./mapPage";

const page = buildMapPage();

/** Every colour the tokens name, the map's included. */
const tokenColours = new Set<string>(
  [...Object.values(color), ...Object.values(color.map)].flatMap((value) =>
    typeof value === "string" ? [value] : [],
  ),
);

test("loads a pinned MapLibre GL JS with SRI hashes", () => {
  expect(MAPLIBRE_JS_URL).toContain(`maplibre-gl@${MAPLIBRE_VERSION}/`);
  expect(MAPLIBRE_CSS_URL).toContain(`maplibre-gl@${MAPLIBRE_VERSION}/`);
  expect(page).toContain(`src="${MAPLIBRE_JS_URL}" integrity="${MAPLIBRE_JS_SRI}"`);
  expect(page).toContain(`href="${MAPLIBRE_CSS_URL}" integrity="${MAPLIBRE_CSS_SRI}"`);
  expect(MAPLIBRE_JS_SRI).toMatch(/^sha384-/);
  expect(MAPLIBRE_CSS_SRI).toMatch(/^sha384-/);
});

test("writes the dark style into the page, and no key", () => {
  // In the app's language, English under jest; the Feed's maps take it too.
  expect(MAP_STYLE).toEqual(mapStyle("en"));
  // With the photos and the hills hidden in it (TASK-264).
  expect(page).toContain(
    `style: ${JSON.stringify(withKinds(MAP_STYLE)).replace(/</g, "\\u003c")}`,
  );
  expect(page).not.toContain("styles/liberty");
  expect(page).not.toMatch(/key|token/i);
});

test("lets no string in the style close the script early", () => {
  // The attribution is HTML: its "</a>" must reach the page escaped.
  expect(JSON.stringify(MAP_STYLE)).toContain("</a>");
  expect(page).not.toContain("</a>");
});

test("paints the page behind the map dark, so it never flashes white", () => {
  expect(MAP_BACKGROUND).toBe(color.map.background);
  expect(page).toContain(`background: ${MAP_BACKGROUND};`);
});

test("takes every colour in the page from the tokens", () => {
  const used = page.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
  expect(used.length).toBeGreaterThan(0);
  for (const hex of used) {
    expect(tokenColours.has(hex)).toBe(true);
  }
});

test("reports tiles that cannot be described, not just a missing style", () => {
  expect(Object.keys(MAP_STYLE.sources)).toContain("openmaptiles");
  expect(page).toContain('event.sourceId === "openmaptiles" && !event.tile');
});

test("tells the app once the first tiles are drawn", () => {
  expect(page).toContain('map.once("idle"');
  expect(page).toContain('post({ type: "loaded" })');
});

test("keeps the attribution expanded", () => {
  expect(page).toContain("new maplibregl.AttributionControl({ compact: false })");
});

test("has no zoom buttons: the fingers zoom the map", () => {
  expect(page).not.toContain("NavigationControl");
  // MapLibre's pinch is on unless the page turns it off: only «Draw on the
  // map» does, and gives it back (TASK-281, mapPageCanvas.test.ts).
  expect(page.match(/touchZoomRotate/g)).toHaveLength(1);
});

test("starts on Italy, with the bounds in MapLibre order", () => {
  expect(page).toContain("bounds: [[6.6,35.5],[18.6,47.1]]");
});

test("reports a script that did not load", () => {
  expect(page).toContain(`onerror="fail('MapLibre GL JS did not load')"`);
});

test.each([
  ["https://www.openstreetmap.org/copyright", true],
  ["http://example.org", true],
  ["about:blank", false],
  ["data:text/html,hello", false],
])("isExternalUrl(%s) is %s", (url, expected) => {
  expect(isExternalUrl(url)).toBe(expected);
});

test("has a yellow route line, and handles the route messages", () => {
  expect(ROUTE_COLOR).toBe(color.accent);
  expect(page).toContain('map.addSource("route"');
  expect(page).toContain(`"line-color": "${ROUTE_COLOR}"`);
  expect(page).toContain('message.type === "showRoute"');
  expect(page).toContain('message.type === "clearRoute"');
});

test("marks the start in a colour that is neither the route nor Start here", () => {
  expect(page).toContain(`new maplibregl.Marker({ color: "${POSITION_COLOR}" })`);
  expect(POSITION_COLOR).not.toBe(ROUTE_COLOR);
  expect(POSITION_COLOR).not.toBe(START_HERE_COLOR);
});

test("marks where a moved route begins, and frames it with the start", () => {
  expect(START_HERE_LABEL).toBe("Start here");
  expect(START_HERE_COLOR).toBe(color.startHere);
  expect(START_HERE_COLOR).not.toBe(ROUTE_COLOR);
  expect(page).toContain(`.setText("${START_HERE_LABEL}")`);
  expect(page).toContain(`new maplibregl.Marker({ color: "${START_HERE_COLOR}" })`);
  expect(page).toContain("setStartHere(message.startHere)");
  expect(page).toContain("bounds.extend(marker.getLngLat())");
  expect(page).toContain("setStartHere(null)");
});

test("the page follows the runner close up, without framing the route again", () => {
  const handler = page.slice(page.indexOf('message.type === "follow"'));
  expect(handler).toContain(`zoom: ${FOLLOW_ZOOM}`);
  expect(handler.slice(0, handler.indexOf("clearRoute"))).not.toContain("fitBounds");
});

test("while running the marker is an arrow turned to the heading (TASK-164)", () => {
  // In the marker's colour, with a dark edge to stand on the yellow route.
  expect(HEADING_ARROW_SVG).toContain(`fill="${POSITION_COLOR}"`);
  expect(HEADING_ARROW_SVG).toContain(`stroke="${color.map.background}"`);
  // In the page with no "<" that could close the script.
  expect(page).toContain(JSON.stringify(HEADING_ARROW_SVG).replace(/</g, "\\u003c"));
  // Turned with the map, so north of the arrow is north of the map.
  expect(page).toContain('rotationAlignment: "map"');
  expect(page).toContain("arrow.setRotation(heading)");
  const handler = page.slice(page.indexOf('message.type === "follow"'));
  const follow = handler.slice(0, handler.indexOf('message.type === "stopFollow"'));
  expect(follow).toContain("showArrow(message.lngLat, message.heading)");
  // Without a heading yet, the pin as before.
  expect(follow).toContain("showPin(message.lngLat)");
});

test("after the run the arrow is the position marker again", () => {
  const handler = page.slice(page.indexOf('message.type === "stopFollow"'));
  const stop = handler.slice(0, handler.indexOf('message.type === "showTrack"'));
  expect(stop).toContain("showPin(arrow.getLngLat())");
  expect(stop).not.toContain("fitBounds");
  // A new start is a pin too, never a stale arrow.
  const setPosition = page.slice(
    page.indexOf('message.type === "setPosition"'),
    page.indexOf('message.type === "showRoute"'),
  );
  expect(setPosition).toContain("showPin(message.lngLat)");
});

test("the run is a line of its own, over the route and thinner", () => {
  const page = buildMapPage();
  expect(page).toContain('message.type === "showTrack"');
  expect(page).toContain('message.type === "clearTrack"');
  expect(page.indexOf('id: "track"')).toBeGreaterThan(page.indexOf('id: "route"'));
  expect(TRACK_WIDTH).toBeLessThan(ROUTE_WIDTH);
  // Showing the run does not move the map: the route has framed it.
  const handler = page.slice(page.indexOf('message.type === "showTrack"'));
  expect(handler.slice(0, handler.indexOf("clearRoute"))).not.toContain("fitBounds");
});

test("the other routes are thin and grey, under the route (TASK-093)", () => {
  const page = buildMapPage();
  expect(page).toContain('message.type === "showOthers"');
  expect(page.indexOf('id: "others"')).toBeLessThan(page.indexOf('id: "route"'));
  expect(OTHER_ROUTE_WIDTH).toBeLessThan(ROUTE_WIDTH);
  expect(OTHER_ROUTE_COLOR).not.toBe(ROUTE_COLOR);
  const handler = page.slice(page.indexOf('message.type === "showOthers"'));
  expect(handler.slice(0, handler.indexOf("clearTrack"))).not.toContain("fitBounds");
});

test("the walks of a word with the pen up are dashed, under the route (TASK-198)", () => {
  const page = buildMapPage();
  expect(WALK_COLOR).toBe(walk.color);
  expect(tokenColours.has(WALK_COLOR)).toBe(true);
  // Not yellow: only the letters are the drawing.
  expect(WALK_COLOR).not.toBe(ROUTE_COLOR);
  expect(WALK_WIDTH).toBeLessThan(ROUTE_WIDTH);
  expect(page).toContain('map.addSource("walks"');
  expect(page).toContain(`"line-dasharray": ${JSON.stringify(WALK_DASH)}`);
  expect(page.indexOf('id: "others"')).toBeLessThan(page.indexOf('id: "walks"'));
  expect(page.indexOf('id: "walks"')).toBeLessThan(page.indexOf('id: "route"'));
  // With walks the route is its letters; without, one line as before.
  const handler = page.slice(page.indexOf('message.type === "showRoute"'));
  const shown = handler.slice(0, handler.indexOf('message.type === "follow"'));
  expect(shown).toContain('{ type: "MultiLineString", coordinates: message.letters }');
  expect(shown).toContain('{ type: "LineString", coordinates: points }');
  expect(shown).toContain("setWalks(");
  const cleared = page.slice(page.indexOf('message.type === "clearRoute"'));
  expect(cleared).toContain("setWalks(noRoute)");
});

test("the stretches with the bike on foot are dashed over the route (TASK-206)", () => {
  const page = buildMapPage();
  expect(ON_FOOT_COLOR).toBe(onFoot.color);
  expect(tokenColours.has(ON_FOOT_COLOR)).toBe(true);
  // Not yellow, which stays under them whole, nor the grey of the walks.
  expect(ON_FOOT_COLOR).not.toBe(ROUTE_COLOR);
  expect(ON_FOOT_COLOR).not.toBe(WALK_COLOR);
  expect(ON_FOOT_WIDTH).toBeLessThan(ROUTE_WIDTH);
  expect(page).toContain('map.addSource("on-foot"');
  expect(page).toContain(`"line-dasharray": ${JSON.stringify(ON_FOOT_DASH)}`);
  // Over the route, under the places of a themed route and the run.
  expect(page.indexOf('id: "route"')).toBeLessThan(page.indexOf('id: "on-foot"'));
  expect(page.indexOf('id: "on-foot"')).toBeLessThan(page.indexOf('id: "stops"'));
  expect(page.indexOf('id: "on-foot"')).toBeLessThan(page.indexOf('id: "track"'));
  const handler = page.slice(page.indexOf('message.type === "showRoute"'));
  const shown = handler.slice(0, handler.indexOf('message.type === "follow"'));
  expect(shown).toContain("setOnFoot(");
  expect(shown).toContain('{ type: "MultiLineString", coordinates: message.onFoot }');
  const cleared = page.slice(page.indexOf('message.type === "clearRoute"'));
  expect(cleared).toContain("setOnFoot(noRoute)");
});
