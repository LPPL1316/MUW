import { COMPOSED_RATIO, layoutFrame, layoutName, POST_LAYOUTS } from "./layoutFrame";

const WIDTH = 400;
const HEIGHT = WIDTH * COMPOSED_RATIO;

const inside = (box: { left: number; top: number; width: number; height: number }) =>
  box.left >= 0 &&
  box.top >= 0 &&
  box.left + box.width <= WIDTH + 1e-9 &&
  box.top + box.height <= HEIGHT + 1e-9;

test("the four layouts the user chose, each with its name", () => {
  expect(POST_LAYOUTS).toEqual(["drawing_corner", "line_on_photo", "half", "photo_corner"]);
  expect(POST_LAYOUTS.map(layoutName)).toEqual([
    "Drawing in the corner",
    "Line on the photo",
    "Half and half",
    "Photo in the corner",
  ]);
});

test("every layout keeps the photo and the drawing inside the 4:5 picture", () => {
  for (const layout of POST_LAYOUTS) {
    const frame = layoutFrame(layout, WIDTH);
    expect(inside(frame.photo)).toBe(true);
    expect(inside(frame.drawing)).toBe(true);
    expect(frame.line).toBeGreaterThan(0);
    expect(2 * frame.pad).toBeLessThan(Math.min(frame.drawing.width, frame.drawing.height));
  }
});

test("drawing in the corner: the photo whole, the drawing small at the bottom right", () => {
  const frame = layoutFrame("drawing_corner", WIDTH);
  expect(frame.photo).toEqual({ left: 0, top: 0, width: WIDTH, height: HEIGHT });
  expect(frame.drawing.width).toBeCloseTo(WIDTH * 0.38);
  expect(frame.drawing.left + frame.drawing.width).toBeCloseTo(WIDTH * 0.96);
  expect(frame.drawing.top + frame.drawing.height).toBeCloseTo(HEIGHT - WIDTH * 0.04);
  expect(frame.panel).toBe(true);
  expect(frame.photoOnTop).toBe(false);
});

test("line on the photo: the line alone, over the whole photo", () => {
  const frame = layoutFrame("line_on_photo", WIDTH);
  expect(frame.drawing).toEqual(frame.photo);
  expect(frame.panel).toBe(false);
});

test("half and half: the photo above, the drawing below, each half the picture", () => {
  const frame = layoutFrame("half", WIDTH);
  expect(frame.photo).toEqual({ left: 0, top: 0, width: WIDTH, height: HEIGHT / 2 });
  expect(frame.drawing).toEqual({ left: 0, top: HEIGHT / 2, width: WIDTH, height: HEIGHT / 2 });
});

test("photo in the corner: the drawing whole, the photo small over it", () => {
  const frame = layoutFrame("photo_corner", WIDTH);
  expect(frame.drawing).toEqual({ left: 0, top: 0, width: WIDTH, height: HEIGHT });
  expect(frame.photo).toEqual(layoutFrame("drawing_corner", WIDTH).drawing);
  expect(frame.photoOnTop).toBe(true);
});

test("the same layout at another width is the same picture, scaled", () => {
  for (const layout of POST_LAYOUTS) {
    const small = layoutFrame(layout, 100);
    const large = layoutFrame(layout, 300);
    expect(large.drawing.left).toBeCloseTo(small.drawing.left * 3);
    expect(large.photo.height).toBeCloseTo(small.photo.height * 3);
    expect(large.line).toBeCloseTo(small.line * 3);
  }
});
