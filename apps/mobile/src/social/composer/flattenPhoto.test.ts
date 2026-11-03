import { MAX_IMAGE_BYTES } from "@shaperoute/shared-types";
import { createRef } from "react";
import type { View } from "react-native";

import { flattenPhoto } from "./flattenPhoto";

jest.mock("expo-file-system");
jest.mock("react-native-view-shot");

function shown() {
  const view = createRef<View>();
  (view as { current: View | null }).current = {} as View;
  return view;
}

test("the picture is a 4:5 JPEG of 864 × 1080, whatever the phone's pixels", async () => {
  const capture = jest.fn(async () => "AAAA");
  await expect(flattenPhoto(shown(), capture)).resolves.toEqual({
    base64: "AAAA",
    width: 864,
    height: 1080,
  });
  expect(capture).toHaveBeenCalledWith(expect.anything(), {
    format: "jpg",
    quality: 0.8,
    width: 864,
    height: 1080,
    result: "base64",
  });
});

test("no picture when the view is not there, the capture fails or it is too large", async () => {
  const capture = jest.fn(async () => "AAAA");
  await expect(flattenPhoto(createRef<View>(), capture)).resolves.toBeNull();
  expect(capture).not.toHaveBeenCalled();
  const failing = jest.fn(async () => {
    throw new Error("no window");
  });
  await expect(flattenPhoto(shown(), failing)).resolves.toBeNull();
  const huge = jest.fn(async () => "A".repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8));
  await expect(flattenPhoto(shown(), huge)).resolves.toBeNull();
});
