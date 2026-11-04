import { t } from "../../i18n";

/**
 * The four ways a photo can carry the drawing of its run (TASK-348,
 * ADR-0301, the user's choice «Sì, i quattro»). The photo is made at
 * «Publish» with the drawing inside it, in a 4:5 picture.
 */
export const POST_LAYOUTS = [
  "drawing_corner",
  "line_on_photo",
  "half",
  "photo_corner",
] as const;
export type PostLayout = (typeof POST_LAYOUTS)[number];

/** The picture made is 4:5, 864 × 1080 px: the API keeps a photo at most
 * 1080 px on its longer side (drawing_photos.PHOTO_SIDE), as the phone's
 * own photos (DRAWING_PHOTO_SIDE). */
export const COMPOSED_WIDTH = 864;
export const COMPOSED_RATIO = 5 / 4;

export type Box = { left: number; top: number; width: number; height: number };

/** Where the photo and the drawing go in a picture `width` wide. */
export type LayoutFrame = {
  photo: Box;
  drawing: Box;
  /** The drawing on the yellow of MuW, as the shared post; else the line
   * alone on the photo. */
  panel: boolean;
  /** The photo over the drawing; else the drawing over the photo. */
  photoOnTop: boolean;
  /** How thick the line is. */
  line: number;
  /** Room between the line and the edge of its box. */
  pad: number;
};

/** A corner's side and its margin, as shares of the picture's width. */
const CORNER = 0.38;
const MARGIN = 0.04;

/** The frame of `layout` in a picture `width` wide and COMPOSED_RATIO tall. */
export function layoutFrame(layout: PostLayout, width: number): LayoutFrame {
  const height = width * COMPOSED_RATIO;
  const whole: Box = { left: 0, top: 0, width, height };
  const side = width * CORNER;
  const corner: Box = {
    left: width - width * MARGIN - side,
    top: height - width * MARGIN - side,
    width: side,
    height: side,
  };
  switch (layout) {
    case "drawing_corner":
      return {
        photo: whole,
        drawing: corner,
        panel: true,
        photoOnTop: false,
        line: side * 0.03,
        pad: side * 0.12,
      };
    case "line_on_photo":
      return {
        photo: whole,
        drawing: whole,
        panel: false,
        photoOnTop: false,
        line: width * 0.014,
        pad: width * 0.12,
      };
    case "half":
      return {
        photo: { left: 0, top: 0, width, height: height / 2 },
        drawing: { left: 0, top: height / 2, width, height: height / 2 },
        panel: true,
        photoOnTop: false,
        line: width * 0.012,
        pad: width * 0.08,
      };
    case "photo_corner":
      return {
        photo: corner,
        drawing: whole,
        panel: true,
        photoOnTop: true,
        line: width * 0.014,
        pad: width * 0.12,
      };
  }
}

/** The layout's name in the form. */
export function layoutName(layout: PostLayout): string {
  switch (layout) {
    case "drawing_corner":
      return t("Drawing in the corner");
    case "line_on_photo":
      return t("Line on the photo");
    case "half":
      return t("Half and half");
    case "photo_corner":
      return t("Photo in the corner");
  }
}
