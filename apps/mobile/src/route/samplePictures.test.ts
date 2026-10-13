import imageOutline from "@shaperoute/shared-types/fixtures/image-outline.json";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { Picked } from "./pickImage";
import { SAMPLE_PICTURES, sampleOf, samplePicture } from "./samplePictures";
import { useImageOutline } from "./useImageOutline";

/**
 * The ready-made pictures of «Draw» (TASK-280): the twelve the user chose,
 * each with an outline as the API checks one (ADR-0069) and as the image
 * panel draws it.
 */

test("twelve pictures, in the order the user chose them", () => {
  expect(SAMPLE_PICTURES.map((picture) => picture.name)).toEqual([
    "Bike",
    "Running shoe",
    "Dinosaur",
    "Guitar",
    "Eiffel Tower",
    "Rocket",
    "Heart with arrow",
    "Anchor",
    "Plane",
    "Ice cream",
    "Balloon",
    "Leaf",
  ]);
});

test.each(SAMPLE_PICTURES.map((picture) => [picture.id, picture]))(
  "the outline of «%s» is one the API takes",
  (_id, { outline }) => {
    const { points, image_points } = outline;
    // From 4 to 101 points, closed, in [-1, 1] (images.py).
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(points.length).toBeLessThanOrEqual(101);
    expect(points.at(-1)).toEqual(points[0]);
    for (const [x, y] of points) {
      expect(Math.abs(x)).toBeLessThanOrEqual(1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
    // The same corners over the square picture, inside it.
    expect(image_points).toHaveLength(points.length);
    for (const [x, y] of image_points) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(1);
    }
    expect(outline.aspect).toBe(1);
    // One subject each: nothing joined to it.
    expect(outline.strokes).toEqual([]);
    expect(outline.image_strokes).toEqual([]);
  },
);

test("a picture shown is known again, a photo is none of them", () => {
  const [bike, rocket] = ["bike", "rocket"].map((id) =>
    SAMPLE_PICTURES.find((picture) => picture.id === id)!,
  );
  expect(sampleOf(samplePicture(bike))).toBe("bike");
  expect(sampleOf(samplePicture(rocket))).toBe("rocket");
  expect(samplePicture(rocket)).toBe(samplePicture(rocket));
  expect(sampleOf({ ...samplePicture(rocket) })).toBeNull();
  expect(sampleOf({ uri: "file:///apple.jpg", width: 800, height: 600 })).toBeNull();
});

test("shown, a picture is traced at once, without the API, and its edits start again", async () => {
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  const picked: Picked = {
    kind: "picked",
    picture: { uri: "file:///apple.jpg", width: 800, height: 600 },
    base64: "aGVsbG8=",
  };
  fetchSpy.mockResolvedValueOnce(Response.json(imageOutline));
  const { result } = await renderHook(() =>
    useImageOutline("http://pc:8000", async () => picked),
  );
  await act(async () => result.current.choose("library"));
  await waitFor(() => expect(result.current.state.status).toBe("traced"));

  const leaf = SAMPLE_PICTURES.find((picture) => picture.id === "leaf")!;
  await act(async () => result.current.show(samplePicture(leaf), leaf.outline));
  expect(result.current.state).toEqual({
    status: "traced",
    picture: samplePicture(leaf),
    outline: leaf.outline,
  });
  expect(result.current.edits).toEqual({ earlier: [], edit: { status: "idle" } });
  // Only the photo was sent to be traced.
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  fetchSpy.mockRestore();
});
