import { t } from "../i18n";
import { BRIGHTNESS_STEPS } from "../theme/tone";
import { type Palette, paletteOf } from "../theme/tokens";

/**
 * The styles of a run's video (TASK-351, ADR-0303), chosen in «Share your
 * run» before «Export video»: «Night», the app's dark map at its darkest;
 * «Day», the light one at its brightest. Each is a palette of the tokens
 * at one of its ends, whatever tone the app is shown in, because the video
 * is for whoever watches it. The leaning map of «3D» comes with part D.
 */
export type VideoStyle = "night" | "day";

/** In the order the row offers them; the first is on when the post opens. */
export const VIDEO_STYLES: readonly VideoStyle[] = ["night", "day"];

/** The dark tone at its darkest. */
export const NIGHT: Palette = paletteOf({
  tone: "dark",
  dark: 0,
  light: BRIGHTNESS_STEPS - 1,
});

/** The light tone at its brightest. */
export const DAY: Palette = paletteOf({
  tone: "light",
  dark: 0,
  light: BRIGHTNESS_STEPS - 1,
});

/** The colours a style draws the map and the words with. */
export function stylePalette(style: VideoStyle): Palette {
  return style === "day" ? DAY : NIGHT;
}

/** The style's name, as the row shows it. */
export function styleName(style: VideoStyle): string {
  return style === "day" ? t("Day") : t("Night");
}
