/**
 * The composer of a post (TASK-348, ADR-0301): the map among up to 9
 * photos, in the post's order, the four layouts for a photo, and its
 * picture made at once.
 */
import type { LatLon } from "@shaperoute/shared-types";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { Flattened } from "./flattenPhoto";
import type { PickedPhotos } from "./pickPhotos";
import { type ComposerPhoto, PostComposer } from "./PostComposer";
import type { PostItem } from "./postOrder";

jest.mock("expo-file-system");
jest.mock("react-native-view-shot");

const DEGREE = 111_195;
const TRACK: LatLon[] = Array.from({ length: 21 }, (_, i): LatLon => [
  46.06 + (i * 50) / DEGREE,
  11.12,
]);
const DRAWING: PostItem = { kind: "drawing" };
const photoItem = (n: number): PostItem => ({ kind: "photo", n });
const photo = (n: number): ComposerPhoto => ({
  n,
  source: { uri: `data:image/jpeg;base64,P${n}` },
  layout: null,
  original: { uri: `data:image/jpeg;base64,P${n}` },
});
const MADE: Flattened = { base64: "MADE", width: 864, height: 1080 };

type Setup = Partial<Parameters<typeof PostComposer>[0]>;

async function shown(setup: Setup = {}) {
  const onOrder = jest.fn();
  const onAdd = jest.fn();
  const onRemove = jest.fn();
  const onLayout = jest.fn();
  await render(
    <PostComposer
      items={[DRAWING, photoItem(1), photoItem(2)]}
      photos={[photo(1), photo(2)]}
      onOrder={onOrder}
      onAdd={onAdd}
      onRemove={onRemove}
      onLayout={onLayout}
      track={TRACK}
      {...setup}
    />,
  );
  return { onOrder, onAdd, onRemove, onLayout };
}

test("the pages show in the post's order, the map among them", async () => {
  await shown({ items: [photoItem(2), DRAWING, photoItem(1)] });
  const labels = screen
    .getAllByLabelText(/^(Drawing|Photo \d)$/)
    .map((tile) => tile.props.accessibilityLabel as string);
  expect(labels).toEqual(["Photo 1", "Drawing", "Photo 2"]);
  expect(screen.getByText("Hold and drag to reorder")).toBeTruthy();
});

test("VoiceOver moves a page left and right, never off the row", async () => {
  const { onOrder } = await shown();
  await fireEvent(screen.getByTestId("tile-photo-1"), "accessibilityAction", {
    nativeEvent: { actionName: "moveLeft" },
  });
  expect(onOrder).toHaveBeenLastCalledWith([photoItem(1), DRAWING, photoItem(2)]);
  await fireEvent(screen.getByTestId("tile-drawing"), "accessibilityAction", {
    nativeEvent: { actionName: "moveLeft" },
  });
  expect(onOrder).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId("tile-drawing"), "accessibilityAction", {
    nativeEvent: { actionName: "moveRight" },
  });
  expect(onOrder).toHaveBeenLastCalledWith([photoItem(1), DRAWING, photoItem(2)]);
});

test("photos chosen together are added in the order tapped, up to the room left", async () => {
  const pick = jest.fn(async (): Promise<PickedPhotos> => ({
    kind: "picked",
    photos: [
      { base64: "A", width: 1, height: 1 },
      { base64: "B", width: 1, height: 1 },
    ],
    tooLarge: false,
  }));
  const { onAdd } = await shown({ pick });
  await fireEvent.press(screen.getByRole("button", { name: "Add photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Choose a picture" }));
  expect(pick).toHaveBeenCalledWith("library", 7);
  expect(onAdd).toHaveBeenCalledWith(["A", "B"]);
});

test("ten pages with the map: no more photos, and it says so", async () => {
  const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  await shown({ items: [DRAWING, ...ns.map(photoItem)], photos: ns.map(photo) });
  expect(screen.queryByRole("button", { name: "Add photo" })).toBeNull();
  expect(screen.getByText("Up to 10 in a post.")).toBeTruthy();
});

test("a photo tapped shows the four layouts; one chosen makes the picture", async () => {
  const flatten = jest.fn(async () => MADE);
  const { onLayout } = await shown({ flatten });
  expect(screen.queryByText("Layout")).toBeNull();
  await fireEvent.press(screen.getByTestId("tile-photo-2"));
  expect(screen.getByText("Layout")).toBeTruthy();
  for (const name of [
    "Drawing in the corner",
    "Line on the photo",
    "Half and half",
    "Photo in the corner",
  ]) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Half and half" }));
  // Drawn out of sight; once its photo is there, the picture is made.
  await act(async () => {
    screen.getByTestId("composed-photo").props.onLoad();
  });
  expect(flatten).toHaveBeenCalledTimes(1);
  expect(onLayout).toHaveBeenCalledWith(2, "half", MADE);
  expect(screen.queryByTestId("composed-photo")).toBeNull();
});

test("the layout it has, tapped again, gives the photo back as taken", async () => {
  const { onLayout } = await shown({
    photos: [photo(1), { ...photo(2), layout: "half" }],
  });
  await fireEvent.press(screen.getByTestId("tile-photo-2"));
  await fireEvent.press(screen.getByRole("button", { name: "Half and half" }));
  expect(onLayout).toHaveBeenCalledWith(2, null, null);
});

test("a picture that could not be made says so and changes nothing", async () => {
  const { onLayout } = await shown({ flatten: jest.fn(async () => null) });
  await fireEvent.press(screen.getByTestId("tile-photo-1"));
  await fireEvent.press(screen.getByRole("button", { name: "Line on the photo" }));
  await act(async () => {
    screen.getByTestId("composed-photo").props.onLoad();
  });
  expect(onLayout).not.toHaveBeenCalled();
  expect(screen.getByText("Could not prepare this photo. Try again.")).toBeTruthy();
});

test("no layouts without the run's line", async () => {
  await shown({ track: null });
  await fireEvent.press(screen.getByTestId("tile-photo-1"));
  expect(screen.queryByText("Layout")).toBeNull();
});

test("no layouts for a photo already made with one", async () => {
  await shown({ photos: [{ ...photo(1), original: null }, photo(2)] });
  await fireEvent.press(screen.getByTestId("tile-photo-1"));
  expect(screen.queryByText("Layout")).toBeNull();
});

test("× takes a photo off the post", async () => {
  const { onRemove } = await shown();
  await fireEvent.press(screen.getByRole("button", { name: "Remove photo 2" }));
  expect(onRemove).toHaveBeenCalledWith(2);
});
