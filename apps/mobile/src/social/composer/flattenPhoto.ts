import { MAX_IMAGE_BYTES } from "@shaperoute/shared-types";
import type { RefObject } from "react";
import type { View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { base64Bytes } from "../../route/pickImage";
import { DRAWING_PHOTO_QUALITY } from "../pickDrawingPhoto";
import { COMPOSED_RATIO, COMPOSED_WIDTH } from "./layoutFrame";

/** A photo made with the drawing inside it: a JPEG in base64, and its size. */
export type Flattened = { base64: string; width: number; height: number };

export type Capture = typeof captureRef;

/**
 * The picture of `view` (a ComposedPhoto), at COMPOSED_WIDTH × its 4:5
 * whatever the phone's pixels, as a JPEG like the phone's own photos
 * (TASK-348, ADR-0301: «Publish» flattens). Null when it could not be made
 * or would be larger than the API takes: the form says so and keeps the
 * photo as it was.
 */
export async function flattenPhoto(
  view: RefObject<View | null>,
  capture: Capture = captureRef,
): Promise<Flattened | null> {
  if (view.current === null) {
    return null;
  }
  const width = COMPOSED_WIDTH;
  const height = Math.round(COMPOSED_WIDTH * COMPOSED_RATIO);
  let base64: string;
  try {
    base64 = await capture(view, {
      format: "jpg",
      quality: DRAWING_PHOTO_QUALITY,
      width,
      height,
      result: "base64",
    });
  } catch {
    return null;
  }
  if (base64 === "" || base64Bytes(base64) > MAX_IMAGE_BYTES) {
    return null;
  }
  return { base64, width, height };
}
