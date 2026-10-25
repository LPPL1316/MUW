import type { ImageOutline, OutlinePoint } from "@shaperoute/shared-types";
import { Image, type ImageSourcePropType } from "react-native";

import { tLater } from "../i18n";
import type { Picture } from "./pickImage";
import outlines from "./samplePictures.json";

/**
 * The ready-made pictures of «Draw» (TASK-280): sixteen silhouettes drawn by
 * us, no picture of anyone else, those whose routes came out recognisable in
 * eight cities (TASK-290). Each comes with the outline the engine traced from
 * it once, by `tools/sample_pictures.py`, which also draws them: the app shows
 * it at once, without asking the API, and «Draw route» sends it as it sends
 * the outline of a photo (ADR-0069).
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
  dinosaur: require("../../assets/pictures/dinosaur.png"),
  mushroom: require("../../assets/pictures/mushroom.png"),
  car: require("../../assets/pictures/car.png"),
  eiffel_tower: require("../../assets/pictures/eiffel_tower.png"),
  t_shirt: require("../../assets/pictures/t_shirt.png"),
  plane: require("../../assets/pictures/plane.png"),
  boot: require("../../assets/pictures/boot.png"),
  guitar: require("../../assets/pictures/guitar.png"),
  house: require("../../assets/pictures/house.png"),
  balloon: require("../../assets/pictures/balloon.png"),
  duck: require("../../assets/pictures/duck.png"),
  trophy: require("../../assets/pictures/trophy.png"),
  bone: require("../../assets/pictures/bone.png"),
  rocket: require("../../assets/pictures/rocket.png"),
  running_shoe: require("../../assets/pictures/running_shoe.png"),
  leaf: require("../../assets/pictures/leaf.png"),
};

const NAMES: Record<SamplePictureId, string> = {
  dinosaur: tLater("Dinosaur"),
  mushroom: tLater("Mushroom"),
  car: tLater("Car"),
  eiffel_tower: tLater("Eiffel Tower"),
  t_shirt: tLater("T-shirt"),
  plane: tLater("Plane"),
  boot: tLater("Boot"),
  guitar: tLater("Guitar"),
  house: tLater("House"),
  balloon: tLater("Balloon"),
  duck: tLater("Duck"),
  trophy: tLater("Trophy"),
  bone: tLater("Bone"),
  rocket: tLater("Rocket"),
  running_shoe: tLater("Running shoe"),
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
