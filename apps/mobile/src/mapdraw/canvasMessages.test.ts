import { clearCanvas, parsePageMessage, setCanvas } from "../map/messages";

// The messages of «Draw on the map» between the app and the map page
// (TASK-281): points in MapLibre's order on the page, checked as they come.

test("the figure goes to the page as [lng, lat]", () => {
  expect(
    setCanvas({
      mode: "move",
      lines: [
        [
          [46, 11],
          [46.1, 11.2],
        ],
      ],
      links: [false],
      bendable: [0],
      marks: [[46, 11]],
      centre: [46.05, 11.1],
      shrink: 0.5,
      grow: 2,
      frame: false,
    }),
  ).toEqual({
    type: "setCanvas",
    mode: "move",
    lines: [
      [
        [11, 46],
        [11.2, 46.1],
      ],
    ],
    links: [false],
    bendable: [0],
    marks: [[11, 46]],
    centre: [11.1, 46.05],
    shrink: 0.5,
    grow: 2,
    frame: false,
  });
  expect(clearCanvas()).toEqual({ type: "clearCanvas" });
});

test("what the page tells is read only when it is what it should be", () => {
  expect(
    parsePageMessage('{"type":"drawn","line":[[11,46],[11.1,46.1]],"metresPerPx":2}'),
  ).toEqual({
    type: "drawn",
    line: [
      [11, 46],
      [11.1, 46.1],
    ],
    metresPerPx: 2,
  });
  expect(parsePageMessage('{"type":"drawn","line":[],"metresPerPx":2}')).toBeNull();
  expect(
    parsePageMessage('{"type":"drawn","line":[[11,"46"]],"metresPerPx":2}'),
  ).toBeNull();
  expect(parsePageMessage('{"type":"drawn","line":[[11,46]]}')).toBeNull();
  expect(
    parsePageMessage('{"type":"drawn","line":[[11,46]],"metresPerPx":0}'),
  ).toBeNull();
  // A line bent with «Move» (TASK-331 part B).
  expect(
    parsePageMessage('{"type":"bent","from":[11,46],"to":[11.1,46],"metresPerPx":1.5}'),
  ).toEqual({ type: "bent", from: [11, 46], to: [11.1, 46], metresPerPx: 1.5 });
  expect(
    parsePageMessage('{"type":"bent","from":[11,46],"metresPerPx":1.5}'),
  ).toBeNull();
  expect(
    parsePageMessage('{"type":"figure","centre":[11,46],"factor":1.5,"done":false}'),
  ).toEqual({ type: "figure", centre: [11, 46], factor: 1.5, done: false });
  expect(
    parsePageMessage('{"type":"figure","centre":[11,46],"factor":0,"done":true}'),
  ).toBeNull();
  expect(parsePageMessage('{"type":"figure","centre":[11,46],"factor":1}')).toBeNull();
  expect(parsePageMessage('{"type":"centre","lngLat":[11,46]}')).toEqual({
    type: "centre",
    lngLat: [11, 46],
  });
  expect(parsePageMessage('{"type":"centre","lngLat":[11]}')).toBeNull();
});
