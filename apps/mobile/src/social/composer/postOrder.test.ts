import {
  drawingIndex,
  dropIndex,
  itemsOf,
  moved,
  orderOf,
  type PostItem,
  renumbered,
} from "./postOrder";

const photo = (n: number): PostItem => ({ kind: "photo", n });
const DRAWING: PostItem = { kind: "drawing" };

test("no order: the map first and the photos by place, as before ADR-0301", () => {
  expect(itemsOf(null, [3, 1])).toEqual([DRAWING, photo(1), photo(3)]);
  expect(itemsOf(undefined, [])).toEqual([DRAWING]);
});

test("an order puts the map among the photos, as the API answers it", () => {
  const items = itemsOf(["photo:3", "drawing", "photo:1"], [1, 3]);
  expect(items).toEqual([photo(3), DRAWING, photo(1)]);
  expect(orderOf(items)).toEqual(["photo:3", "drawing", "photo:1"]);
  expect(drawingIndex(items)).toBe(1);
});

test("a place emptied leaves the order; a photo it does not name comes last", () => {
  expect(itemsOf(["photo:4", "drawing", "photo:2"], [2, 3])).toEqual([
    DRAWING,
    photo(2),
    photo(3),
  ]);
  // Anything else in it is not a page: twice, unknown, or without the map.
  expect(itemsOf(["photo:2", "photo:2", "video:1", "photo:x"], [2])).toEqual([
    DRAWING,
    photo(2),
  ]);
});

test("a tile moves to where it is dropped, the others keep their order", () => {
  expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  expect(moved(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  expect(moved(["a", "b"], 1, 9)).toEqual(["a", "b"]);
  expect(moved(["a", "b"], 5, 0)).toEqual(["a", "b"]);
});

test("a drag lands on the nearest tile, never off the row", () => {
  expect(dropIndex(1, 0, 80, 4)).toBe(1);
  expect(dropIndex(1, 41, 80, 4)).toBe(2);
  expect(dropIndex(1, 39, 80, 4)).toBe(1);
  expect(dropIndex(1, -500, 80, 4)).toBe(0);
  expect(dropIndex(1, 500, 80, 4)).toBe(3);
  expect(dropIndex(2, 50, 0, 4)).toBe(2);
});

test("a run not saved yet gives its photos the places of the post's order", () => {
  const { order, photos } = renumbered([
    { kind: "photo", photo: "C" },
    { kind: "drawing" },
    { kind: "photo", photo: "A" },
  ]);
  expect(photos).toEqual(["C", "A"]);
  expect(order).toEqual(["photo:1", "drawing", "photo:2"]);
});
