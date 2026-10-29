import myDetails from "@shaperoute/shared-types/fixtures/my-drawing-details.json";
import type { DrawingPhoto, MyDrawing } from "@shaperoute/shared-types";

import { API_KEY_HEADER } from "./apiUrl";
import { drawingPhotoSource } from "./drawings";

const URL = "http://api";
const TOKEN = "the-token";
const PHOTO = (myDetails as MyDrawing).photos?.[0] as DrawingPhoto;

test("a photo on a server with a key is asked with the key and the token", () => {
  // Without the key such a server answers 401 and the photo stays blank,
  // in «Feed», on a profile and in a drawing opened (TASK-330).
  expect(drawingPhotoSource(URL, TOKEN, PHOTO, "secret-key-for-tests")).toEqual({
    uri: `http://api${PHOTO.url}`,
    headers: {
      [API_KEY_HEADER]: "secret-key-for-tests",
      Authorization: `Bearer ${TOKEN}`,
    },
  });
});

test("without a key a photo is asked with the token alone", () => {
  expect(drawingPhotoSource(URL, TOKEN, PHOTO, null).headers).toEqual({
    Authorization: `Bearer ${TOKEN}`,
  });
});

test("the key of the app is the one sent when none is given", () => {
  const was = process.env.EXPO_PUBLIC_API_KEY;
  process.env.EXPO_PUBLIC_API_KEY = "key-of-the-app";
  try {
    expect(drawingPhotoSource(URL, TOKEN, PHOTO).headers[API_KEY_HEADER]).toBe(
      "key-of-the-app",
    );
  } finally {
    if (was === undefined) {
      delete process.env.EXPO_PUBLIC_API_KEY;
    } else {
      process.env.EXPO_PUBLIC_API_KEY = was;
    }
  }
});
