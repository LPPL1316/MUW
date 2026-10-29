import { MESSAGE_VIDEO_MAX_BYTES, MESSAGE_VIDEO_MAX_S } from "@shaperoute/shared-types";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { DRAWING_PHOTO_QUALITY, shrunkSide } from "../social/pickDrawingPhoto";

/** A photo or a video of the phone, ready to be sent with a message. */
export type MessageFile = {
  kind: "photo" | "video";
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  /** A video's length. */
  durationMs: number | null;
};

export type PickedMessageFile =
  | { kind: "picked"; file: MessageFile }
  | { kind: "cancelled" }
  | { kind: "too_long" }
  | { kind: "too_large" }
  | { kind: "pick_failed" };

/**
 * From the library only: the system picker asks no permission on iOS. The
 * camera waits for the 1.0.1 build, whose permission texts will say so
 * (ADR-0289, point 12). A photo comes whole, made a JPEG below.
 */
export const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  base64: false,
  quality: 1,
  allowsEditing: false,
  exif: false,
};

/**
 * A video made smaller by the iPhone before it is handed over: 960 × 540,
 * about 3 Mbit/s (ADR-0289, point 7). Android hands it over as it is. Read
 * when a video is chosen, not before: a module that stands in for the
 * picker may not have the presets.
 */
export function videoOptions(): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ["videos"],
    allowsEditing: false,
    // Marked deprecated by expo-image-picker, and still the only way to make
    // the video smaller on iOS without a new module.
    videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540,
    videoMaxDuration: MESSAGE_VIDEO_MAX_S,
  };
}

export type ShrunkPhoto = { uri: string; width: number; height: number };

/** The photo at most 1080 px on its long side, a JPEG without EXIF, as
 * the photos of the drawings (TASK-208): the API would make the same. */
export async function shrinkToFile(
  uri: string,
  width: number,
  height: number,
): Promise<ShrunkPhoto> {
  const context = ImageManipulator.manipulate(uri);
  const side = shrunkSide(width, height);
  const image = await (side === null ? context : context.resize(side)).renderAsync();
  const saved = await image.saveAsync({
    compress: DRAWING_PHOTO_QUALITY,
    format: SaveFormat.JPEG,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

type Picker = Pick<typeof ImagePicker, "launchImageLibraryAsync">;

function sizeOf(asset: ImagePicker.ImagePickerAsset): number {
  if (typeof asset.fileSize === "number") {
    return asset.fileSize;
  }
  try {
    return new File(asset.uri).size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Lets the user choose a photo or a video from the library for a message,
 * and checks it against the API's limits before anything is sent: a video
 * of at most MESSAGE_VIDEO_MAX_S seconds and MESSAGE_VIDEO_MAX_BYTES. Never
 * throws.
 */
export async function pickMessageFile(
  kind: "photo" | "video",
  picker: Picker = ImagePicker,
  shrink: typeof shrinkToFile = shrinkToFile,
  size: (asset: ImagePicker.ImagePickerAsset) => number = sizeOf,
): Promise<PickedMessageFile> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await picker.launchImageLibraryAsync(
      kind === "photo" ? PHOTO_OPTIONS : videoOptions(),
    );
  } catch {
    return { kind: "pick_failed" };
  }
  if (result.canceled) {
    return { kind: "cancelled" };
  }
  const asset = result.assets[0];
  if (!asset) {
    return { kind: "pick_failed" };
  }
  if (kind === "video") {
    const durationMs = asset.duration ?? null;
    if (durationMs !== null && durationMs > MESSAGE_VIDEO_MAX_S * 1000) {
      return { kind: "too_long" };
    }
    if (size(asset) > MESSAGE_VIDEO_MAX_BYTES) {
      return { kind: "too_large" };
    }
    const mimeType =
      asset.mimeType === "video/quicktime" || /\.mov$/i.test(asset.uri)
        ? "video/quicktime"
        : "video/mp4";
    return {
      kind: "picked",
      file: {
        kind,
        uri: asset.uri,
        mimeType,
        width: asset.width,
        height: asset.height,
        durationMs,
      },
    };
  }
  try {
    const shrunk = await shrink(asset.uri, asset.width, asset.height);
    return {
      kind: "picked",
      file: { kind, mimeType: "image/jpeg", durationMs: null, ...shrunk },
    };
  } catch {
    return { kind: "pick_failed" };
  }
}
