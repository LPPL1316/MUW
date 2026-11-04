import { MAX_IMAGE_BYTES } from "@shaperoute/shared-types";
import * as ImagePicker from "expo-image-picker";

import { base64Bytes, type ImageSource } from "../../route/pickImage";
import {
  DRAWING_PHOTO_OPTIONS,
  pickDrawingPhoto,
  type PickedDrawingPhoto,
  type Shrink,
  type Shrunk,
  shrinkPhoto,
} from "../pickDrawingPhoto";

/** Photos chosen for a post, each shrunk as one photo of a run is. */
export type PickedPhotos =
  | { kind: "picked"; photos: Shrunk[]; tooLarge: boolean }
  | Exclude<PickedDrawingPhoto, { kind: "picked" }>;

/**
 * Lets the user choose up to `limit` pictures at once from the library, in
 * the order tapped, or take one photo (TASK-348): each made a JPEG of at
 * most 1080 px as pickDrawingPhoto does. A picture too large even then is
 * left out and said. Never throws.
 */
export async function pickPhotos(
  source: ImageSource,
  limit: number,
  picker: Pick<
    typeof ImagePicker,
    "launchImageLibraryAsync" | "launchCameraAsync" | "requestCameraPermissionsAsync"
  > = ImagePicker,
  shrink: Shrink = shrinkPhoto,
): Promise<PickedPhotos> {
  if (source === "camera" || limit <= 1) {
    const one = await pickDrawingPhoto(source, picker, shrink);
    if (one.kind !== "picked") {
      return one;
    }
    const { base64, width, height } = one;
    return { kind: "picked", photos: [{ base64, width, height }], tooLarge: false };
  }
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await picker.launchImageLibraryAsync({
      ...DRAWING_PHOTO_OPTIONS,
      allowsMultipleSelection: true,
      selectionLimit: limit,
      orderedSelection: true,
    });
  } catch {
    return { kind: "pick_failed" };
  }
  if (result.canceled) {
    return { kind: "cancelled" };
  }
  const photos: Shrunk[] = [];
  let tooLarge = false;
  for (const asset of result.assets.slice(0, limit)) {
    let shrunk: Shrunk;
    try {
      shrunk = await shrink(asset.uri, asset.width, asset.height);
    } catch {
      return photos.length > 0
        ? { kind: "picked", photos, tooLarge }
        : { kind: "pick_failed" };
    }
    if (base64Bytes(shrunk.base64) > MAX_IMAGE_BYTES) {
      tooLarge = true;
      continue;
    }
    photos.push(shrunk);
  }
  if (photos.length === 0) {
    return tooLarge ? { kind: "too_large" } : { kind: "pick_failed" };
  }
  return { kind: "picked", photos, tooLarge };
}
