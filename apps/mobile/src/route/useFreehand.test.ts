import { act, renderHook } from "@testing-library/react-native";

import type { BoardPoint } from "./freehand";
import { useFreehand } from "./useFreehand";

/**
 * The figure of the board as the app keeps it (TASK-320): the lines drawn,
 * what «Undo» takes back, a figure set to start from; and nothing asked
 * of the network, ever.
 */

function stroke(a: BoardPoint, b: BoardPoint, steps = 20): BoardPoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  });
}

const SQUARE: BoardPoint[] = [
  ...stroke([0.2, 0.2], [0.8, 0.2]),
  ...stroke([0.8, 0.2], [0.8, 0.8]).slice(1),
  ...stroke([0.8, 0.8], [0.2, 0.8]).slice(1),
  ...stroke([0.2, 0.8], [0.2, 0.22]).slice(1),
];

let fetchSpy: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("the first line is the outline, the next a detail; Undo takes them back in turn", async () => {
  const { result } = await renderHook(() => useFreehand());
  expect(result.current.figure).toBeNull();
  expect(result.current.canUndo).toBe(false);
  await act(async () => result.current.addLine(SQUARE));
  const outline = result.current.figure?.outline;
  expect(outline).toHaveLength(5);
  expect(result.current.canUndo).toBe(true);
  await act(async () => result.current.addLine(stroke([0.5, 0.5], [0.5, 0.78])));
  expect(result.current.figure?.details).toHaveLength(1);
  await act(async () => result.current.undo());
  expect(result.current.figure?.details).toEqual([]);
  expect(result.current.figure?.outline).toBe(outline);
  await act(async () => result.current.undo());
  expect(result.current.figure).toBeNull();
  expect(result.current.canUndo).toBe(false);
});

test("a line that gives nothing says why, until a line that does", async () => {
  const { result } = await renderHook(() => useFreehand());
  await act(async () => result.current.addLine(stroke([0.1, 0.5], [0.9, 0.5])));
  expect(result.current.problem).toBe("open");
  expect(result.current.figure).toBeNull();
  // Nothing to undo: no line was kept.
  expect(result.current.canUndo).toBe(false);
  await act(async () => result.current.addLine(SQUARE));
  expect(result.current.problem).toBeNull();
  // A tap says nothing, and changes nothing.
  await act(async () => result.current.addLine([[0.5, 0.5]]));
  expect(result.current.problem).toBeNull();
  expect(result.current.canUndo).toBe(true);
});

test("Erase takes the line under the finger, and Undo puts it back", async () => {
  const { result } = await renderHook(() => useFreehand());
  await act(async () => result.current.addLine(SQUARE));
  await act(async () => result.current.addLine(stroke([0.5, 0.5], [0.5, 0.78])));
  const before = result.current.figure;
  await act(async () => result.current.erase([0.51, 0.6]));
  expect(result.current.figure?.details).toEqual([]);
  await act(async () => result.current.undo());
  expect(result.current.figure).toBe(before);
  // The outline: everything goes.
  await act(async () => result.current.erase([0.8, 0.5]));
  expect(result.current.figure).toBeNull();
  // Erasing on nothing changes nothing.
  await act(async () => result.current.erase([0.5, 0.5]));
  expect(result.current.canUndo).toBe(true);
  await act(async () => result.current.undo());
  expect(result.current.figure).toBe(before);
});

test("a figure set to start from forgets the steps before it", async () => {
  const { result } = await renderHook(() => useFreehand());
  await act(async () => result.current.addLine(SQUARE));
  const figure = result.current.figure;
  if (figure === null) throw new Error("no figure");
  await act(async () => result.current.set({ outline: figure.outline, details: [] }));
  expect(result.current.canUndo).toBe(false);
  await act(async () => result.current.set(null));
  expect(result.current.figure).toBeNull();
  expect(result.current.problem).toBeNull();
});
