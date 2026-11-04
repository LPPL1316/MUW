import { MAX_IMAGE_BYTES } from "@shaperoute/shared-types";
import type * as ImagePicker from "expo-image-picker";

import { pickPhotos } from "./pickPhotos";

jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: {} }));

const asset = (uri: string) => ({ uri, width: 2000, height: 1500 });

function picker(result: Partial<ImagePicker.ImagePickerResult>) {
  return {
    launchImageLibraryAsync: jest.fn(
      async () => result as ImagePicker.ImagePickerResult,
    ),
    launchCameraAsync: jest.fn(
      async () =>
        ({
          canceled: false,
          assets: [asset("camera")],
        }) as ImagePicker.ImagePickerResult,
    ),
    requestCameraPermissionsAsync: jest.fn(
      async () => ({ granted: true }) as ImagePicker.CameraPermissionResponse,
    ),
  };
}

const shrink = jest.fn(async (uri: string) => ({
  base64: `s-${uri}`,
  width: 1080,
  height: 810,
}));

beforeEach(() => shrink.mockClear());

test("up to the room left from the library, in the order tapped, each shrunk", async () => {
  const fake = picker({
    canceled: false,
    assets: [asset("a"), asset("b"), asset("c")],
  });
  const picked = await pickPhotos("library", 2, fake, shrink);
  expect(fake.launchImageLibraryAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      allowsMultipleSelection: true,
      selectionLimit: 2,
      orderedSelection: true,
    }),
  );
  expect(picked).toEqual({
    kind: "picked",
    photos: [
      { base64: "s-a", width: 1080, height: 810 },
      { base64: "s-b", width: 1080, height: 810 },
    ],
    tooLarge: false,
  });
});

test("a picture too large even shrunk is left out and said", async () => {
  const huge = "A".repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
  const fake = picker({ canceled: false, assets: [asset("a"), asset("big")] });
  const big = jest.fn(async (uri: string) => ({
    base64: uri === "big" ? huge : "small",
    width: 1,
    height: 1,
  }));
  const picked = await pickPhotos("library", 5, fake, big);
  expect(picked).toEqual({
    kind: "picked",
    photos: [{ base64: "small", width: 1, height: 1 }],
    tooLarge: true,
  });
  const only = picker({ canceled: false, assets: [asset("big")] });
  await expect(pickPhotos("library", 5, only, big)).resolves.toEqual({
    kind: "too_large",
  });
});

test("the camera takes one, and a cancelled library is nothing", async () => {
  const fake = picker({ canceled: true, assets: null });
  await expect(pickPhotos("camera", 5, fake, shrink)).resolves.toEqual({
    kind: "picked",
    photos: [{ base64: "s-camera", width: 1080, height: 810 }],
    tooLarge: false,
  });
  await expect(pickPhotos("library", 5, fake, shrink)).resolves.toEqual({
    kind: "cancelled",
  });
});
