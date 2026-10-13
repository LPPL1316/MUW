import type { ImageOutline, OutlinePoint } from "@shaperoute/shared-types";
import { Image, type ImageSourcePropType } from "react-native";

import { tLater } from "../i18n";
import type { Picture } from "./pickImage";
import outlines from "./samplePictures.json";

/**
 * The ready-made pictures of «Draw» (TASK-280): twelve silhouettes drawn by
 * us, the user's choice of 2026-10-13, no picture of anyone else. Each comes
 * with the outline the engine traced from it once, by
 * `tools/sample_pictures.py`, which also draws them: the app shows it at
 * once, without asking the API, and «Draw route» sends it as it sends the
 * outline of a photo (ADR-0069).
 */

export type SamplePictureId = keyof typeof outlines;

export type SamplePicture = {
  id: SamplePictureId;
  /** Its name, for the tile and VoiceOver. */
  name: string;
  source: ImageSourcePropType;
  outline: ImageOutline;
};

// In the order of the row, as the tool writes them.
const SOURCES: Record<SamplePictureId, ImageSourcePropType> = {
  bike: require("../../assets/pictures/bike.png"),
  running_shoe: require("../../assets/pictures/running_shoe.png"),
  dinosaur: require("../../assets/pictures/dinosaur.png"),
  guitar: require("../../assets/pictures/guitar.png"),
  eiffel_tower: require("../../assets/pictures/eiffel_tower.png"),
  rocket: require("../../assets/pictures/rocket.png"),
  heart_with_arrow: require("../../assets/pictures/heart_with_arrow.png"),
  anchor: require("../../assets/pictures/anchor.png"),
  plane: require("../../assets/pictures/plane.png"),
  ice_cream: require("../../assets/pictures/ice_cream.png"),
  balloon: require("../../assets/pictures/balloon.png"),
  leaf: require("../../assets/pictures/leaf.png"),
};

const NAMES: Record<SamplePictureId, string> = {
  bike: tLater("Bike"),
  running_shoe: tLater("Running shoe"),
  dinosaur: tLater("Dinosaur"),
  guitar: tLater("Guitar"),
  eiffel_tower: tLater("Eiffel Tower"),
  rocket: tLater("Rocket"),
  heart_with_arrow: tLater("Heart with arrow"),
  anchor: tLater("Anchor"),
  plane: tLater("Plane"),
  ice_cream: tLater("Ice cream"),
  balloon: tLater("Balloon"),
  leaf: tLater("Leaf"),
};

/** The side of every picture, in pixels: the side the engine analyses. */
export const PICTURE_SIDE = 640;

/** An outline as JSON reads it: its points are lists of numbers. */
type Written = {
  points: number[][];
  image_points: number[][];
  aspect: number;
  strokes: number[][][];
  image_strokes: number[][][];
};

function pair(point: number[]): OutlinePoint {
  return [point[0], point[1]];
}

function outlineOf(written: Written): ImageOutline {
  return {
    points: written.points.map(pair),
    image_points: written.image_points.map(pair),
    aspect: written.aspect,
    strokes: written.strokes.map((stroke) => stroke.map(pair)),
    image_strokes: written.image_strokes.map((stroke) => stroke.map(pair)),
  };
}

export const SAMPLE_PICTURES: readonly SamplePicture[] = (
  Object.keys(outlines) as SamplePictureId[]
).map((id) => ({
  id,
  name: NAMES[id],
  source: SOURCES[id],
  outline: outlineOf(outlines[id]),
}));

// One picture each, made the first time it is asked for: the image panel
// keeps it, and it is known again by being that same one.
const pictures = new Map<SamplePictureId, Picture>();

/** The picture as the image panel shows it, like one chosen from the phone. */
export function samplePicture(sample: SamplePicture): Picture {
  const made = pictures.get(sample.id);
  if (made !== undefined) {
    return made;
  }
  const resolved = Image.resolveAssetSource(sample.source);
  const picture = {
    uri: resolved?.uri ?? "",
    width: resolved?.width ?? PICTURE_SIDE,
    height: resolved?.height ?? PICTURE_SIDE,
  };
  pictures.set(sample.id, picture);
  return picture;
}

/** The ready-made picture `picture` is, when it is one. */
export function sampleOf(picture: Picture): SamplePictureId | null {
  for (const [id, made] of pictures) {
    if (made === picture) {
      return id;
    }
  }
  return null;
}
