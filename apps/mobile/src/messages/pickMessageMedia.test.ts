import type { ImagePickerAsset, ImagePickerResult } from "expo-image-picker";

import { pickMessageFile, videoOptions } from "./pickMessageMedia";

// A photo or a video of the library for a message (TASK-333): checked
// against the API's limits before anything goes, a photo made a JPEG.

function picker(result: ImagePickerResult | Error) {
  return {
    launchImageLibraryAsync: jest.fn(async () => {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }),
  };
}

function chosen(asset: Partial<ImagePickerAsset>): ImagePickerResult {
  return {
    canceled: false,
    assets: [
      { uri: "file:///cache/ImagePicker/a.mov", width: 960, height: 540, ...asset },
    ],
  };
}

const shrink = jest.fn(async () => ({
  uri: "file:///cache/ImageManipulator/a.jpg",
  width: 1080,
  height: 810,
}));

test("a photo is made a JPEG before it goes", async () => {
  const library = picker(chosen({ uri: "file:///a.heic", width: 4032, height: 3024 }));
  const picked = await pickMessageFile("photo", library, shrink);
  expect(picked).toEqual({
    kind: "picked",
    file: {
      kind: "photo",
      uri: "file:///cache/ImageManipulator/a.jpg",
      mimeType: "image/jpeg",
      width: 1080,
      height: 810,
      durationMs: null,
    },
  });
  expect(shrink).toHaveBeenCalledWith("file:///a.heic", 4032, 3024);
  expect(library.launchImageLibraryAsync.mock.calls[0]).toEqual([
    expect.objectContaining({ mediaTypes: ["images"], allowsEditing: false }),
  ]);
});

test("a video goes as the iPhone made it, at most a minute and 40 MB", async () => {
  const size = () => 12_000_000;
  const video = await pickMessageFile(
    "video",
    picker(chosen({ duration: 24_480, mimeType: "video/quicktime" })),
    shrink,
    size,
  );
  expect(video).toEqual({
    kind: "picked",
    file: {
      kind: "video",
      uri: "file:///cache/ImagePicker/a.mov",
      mimeType: "video/quicktime",
      width: 960,
      height: 540,
      durationMs: 24_480,
    },
  });
  expect(videoOptions()).toMatchObject({
    mediaTypes: ["videos"],
    videoMaxDuration: 60,
  });
  const long = await pickMessageFile(
    "video",
    picker(chosen({ duration: 60_500 })),
    shrink,
    size,
  );
  expect(long).toEqual({ kind: "too_long" });
  const large = await pickMessageFile(
    "video",
    picker(chosen({ duration: 30_000 })),
    shrink,
    () => 40_000_001,
  );
  expect(large).toEqual({ kind: "too_large" });
  const mp4 = await pickMessageFile(
    "video",
    picker(chosen({ uri: "file:///b.mp4", duration: 1000 })),
    shrink,
    size,
  );
  expect(mp4.kind === "picked" && mp4.file.mimeType).toBe("video/mp4");
});

test("cancelled or failed, nothing goes", async () => {
  expect(
    await pickMessageFile("photo", picker({ canceled: true, assets: null })),
  ).toEqual({
    kind: "cancelled",
  });
  expect(await pickMessageFile("photo", picker(new Error("no")))).toEqual({
    kind: "pick_failed",
  });
  const broken = jest.fn(async () => {
    throw new Error("not a picture");
  });
  expect(await pickMessageFile("photo", picker(chosen({})), broken)).toEqual({
    kind: "pick_failed",
  });
});
