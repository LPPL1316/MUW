/**
 * The Sgrava look, in one place (`docs/UI.md`).
 *
 * Nothing here knows about React Native or MapLibre: both the app's styles and
 * the map style (`../map/mapStyle`) read these values, so a colour is decided
 * once and the map never drifts from the panel above it.
 *
 * Adding a token is cheap; hard-coding a colour somewhere else is not.
 */

import {
  BRIGHTNESS_STEPS,
  loadToneChoice,
  stepOf,
  type Tone,
  type ToneChoice,
} from "./tone";

/** The colours that stay the same in every tone (TASK-263, ADR-0231). */
const FIXED = {
  /**
   * The brand yellow. In the app it means one thing only: the route, and the
   * control that produces it. Anything else that needs attention uses
   * `warning` — a second meaning would make the colour say nothing. One
   * exception, the user's choice: «Run without a route» (ADR-0183).
   */
  accent: "#FFD02B",
  /**
   * Text and icons ON `accent`. White fails the contrast minimum on yellow and
   * becomes unreadable in sunlight, which is where this app is used.
   */
  onAccent: "#0B0A08",

  /**
   * Someone waits for the user's answer: the number on the way to «Profile»
   * and on «Requests» (TASK-239). Red by the user's choice; nothing else is.
   */
  badge: "#E02D2D",
  /** The number on `badge`: 4.6:1. */
  onBadge: "#FFFFFF",

  /**
   * The dark laid over the app around the part the tour shows (TASK-266),
   * with an opacity: dark in both tones, so the part in the light stands
   * out on a light screen too.
   */
  scrim: "#0B0A08",
  /** The edge of the light on `scrim`. */
  onScrim: "#FFFFFF",

  /**
   * Strava's orange, for «Connect with Strava» only (TASK-187): Strava's
   * brand rules ask for it, and the user chose it. Nothing else of the app
   * is orange-filled.
   */
  strava: "#FC5200",
  /** Text on `strava`: white, as Strava's own button; semibold, 3:1. */
  onStrava: "#FFFFFF",
} as const;

/**
 * The colours a tone gives, and its brightness moves. The contrasts written
 * here are the dark tone's at its darkest; every tone at every step keeps
 * the minimums `palettes.test.ts` checks.
 */
export type Shade = {
  /** The app background: neutral, not blue. */
  readonly background: string;
  /** Cards, fields, the sheet over the map. */
  readonly surface: string;
  /** A surface that must sit above another one: the fill of a control. */
  readonly surfaceRaised: string;

  readonly border: string;
  /**
   * Borders that carry a control, not just a division: 4.3:1 on
   * `background`, so a button is seen as one in sunlight (TASK-086).
   */
  readonly borderStrong: string;

  readonly text: string;
  /** Labels and secondary lines; 7:1 on `background`. */
  readonly textMuted: string;
  /** The faintest readable text; 5.6:1 on `background`. Not for body copy. */
  readonly textFaint: string;

  /**
   * Something the user should know about the route that was produced — a
   * stretch without a pavement, a distance off target. Deliberately not
   * yellow, which already means "route".
   */
  readonly warning: string;
  /** A request that failed. */
  readonly error: string;

  /** Where a moved route begins (ADR-0040). Cyan, so it never reads as route. */
  readonly startHere: string;

  readonly map: {
    readonly background: string;
    readonly water: string;
    readonly waterLine: string;
    /** Parks, wood, grass: present but quiet. */
    readonly green: string;
    /** Built-up land, a shade off the background. */
    readonly builtUp: string;
    readonly building: string;
    /** Service roads and paths. */
    readonly roadFaint: string;
    /** Residential streets: most of what a route runs on. */
    readonly roadMinor: string;
    /** Secondary and tertiary. */
    readonly roadMedium: string;
    /** Trunk, primary, motorway. */
    readonly roadMajor: string;
    readonly label: string;
    readonly labelHalo: string;
  };
};

/** Every colour of the app, in the tone chosen. */
export type Palette = typeof FIXED &
  Shade & {
    /**
     * A division drawn as thin as the screen allows (`../ui/Hairline`): the
     * text at a fifth of its strength, so it sits on the background and on
     * a card alike. The one translucent colour; the map never uses it.
     */
    readonly hairline: string;
  };

/**
 * Each tone at its darkest step and at its brightest (TASK-263, ADR-0231);
 * the steps between are mixed from the two, colour by colour. The dark
 * tone at its darkest is the app as it always was (ADR-0046), its greys
 * warmed a touch towards the yellow (TASK-339, ADR-0293: a grey with no hue
 * reads cold beside it); at its brightest, anthracite. The light tone goes
 * from a warm light grey to white; its warnings, errors and «Start here»
 * are darker, to read on it.
 */
export const SHADES: Readonly<
  Record<Tone, { readonly darkest: Shade; readonly brightest: Shade }>
> = {
  dark: {
    darkest: {
      background: "#0B0A08",
      surface: "#161411",
      surfaceRaised: "#2C2924",
      border: "#3D3934",
      borderStrong: "#7B746B",
      text: "#F6F3EC",
      textMuted: "#A49D93",
      textFaint: "#908980",
      warning: "#FF7A59",
      error: "#FF6B6B",
      startHere: "#4DD2FF",
      map: {
        background: "#100F0C",
        water: "#101F29",
        waterLine: "#1D3C4E",
        green: "#141A12",
        builtUp: "#131210",
        building: "#1A1915",
        roadFaint: "#1F1D19",
        roadMinor: "#292722",
        roadMedium: "#34312B",
        roadMajor: "#3F3B34",
        label: "#908980",
        labelHalo: "#100F0C",
      },
    },
    brightest: {
      background: "#2D2B27",
      surface: "#38352F",
      surfaceRaised: "#4D4942",
      border: "#5D5951",
      borderStrong: "#A09A90",
      text: "#F6F3EC",
      textMuted: "#C8C3BA",
      textFaint: "#BAB4AB",
      warning: "#FF9478",
      error: "#FF8A8A",
      startHere: "#6EDBFF",
      map: {
        background: "#2B2925",
        water: "#1F3A4B",
        waterLine: "#30586E",
        green: "#28332A",
        builtUp: "#2E2C28",
        building: "#37352F",
        roadFaint: "#3C3A34",
        roadMinor: "#484540",
        roadMedium: "#55524B",
        roadMajor: "#625E56",
        label: "#BAB4AB",
        labelHalo: "#2B2925",
      },
    },
  },
  light: {
    darkest: {
      background: "#DDDAD3",
      surface: "#D1CEC7",
      surfaceRaised: "#C4C0B9",
      border: "#ADA9A2",
      borderStrong: "#6B655D",
      text: "#0B0A08",
      textMuted: "#4A4640",
      textFaint: "#55504A",
      warning: "#9A330A",
      error: "#A1221B",
      startHere: "#006E94",
      map: {
        background: "#DAD7CF",
        water: "#9CC2D8",
        waterLine: "#6E9FBD",
        green: "#C6D6BC",
        builtUp: "#D2D0C9",
        building: "#C6C3BB",
        roadFaint: "#C9C7C0",
        roadMinor: "#BDBAB2",
        roadMedium: "#AFACA4",
        roadMajor: "#A19E95",
        label: "#5A554E",
        labelHalo: "#DAD7CF",
      },
    },
    brightest: {
      background: "#FFFFFF",
      surface: "#F4F2ED",
      surfaceRaised: "#EAE7E1",
      border: "#D9D5CE",
      borderStrong: "#7B746B",
      text: "#0B0A08",
      textMuted: "#5C564F",
      textFaint: "#68625A",
      warning: "#B23C0B",
      error: "#B3261E",
      startHere: "#007BA3",
      map: {
        background: "#F5F4F0",
        water: "#B5D6E8",
        waterLine: "#86B6D2",
        green: "#DDE9D4",
        builtUp: "#EEEDE8",
        building: "#E2E0D9",
        roadFaint: "#E3E1DB",
        roadMinor: "#D6D4CD",
        roadMedium: "#C9C6BE",
        roadMajor: "#BBB8AF",
        label: "#68625A",
        labelHalo: "#F5F4F0",
      },
    },
  },
};

/** `from` and `to` mixed: 0 is `from`, 1 is `to`. */
function mixHex(from: string, to: string, share: number): string {
  const channel = (at: number) =>
    Math.round(
      parseInt(from.slice(at, at + 2), 16) * (1 - share) +
        parseInt(to.slice(at, at + 2), 16) * share,
    )
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function mixShade(from: Shade, to: Shade, share: number): Shade {
  const mixed = {} as Record<string, unknown>;
  for (const key of Object.keys(from) as (keyof Shade)[]) {
    const [a, b] = [from[key], to[key]];
    mixed[key] =
      typeof a === "string" && typeof b === "string"
        ? mixHex(a, b, share)
        : mixShade(a as unknown as Shade, b as unknown as Shade, share);
  }
  return mixed as Shade;
}

/** Every colour of the app in `choice`'s tone, at its step. */
export function paletteOf(choice: ToneChoice): Palette {
  const { darkest, brightest } = SHADES[choice.tone];
  const share = stepOf(choice) / (BRIGHTNESS_STEPS - 1);
  const shade = mixShade(darkest, brightest, share);
  // `#RRGGBBAA`: the text at 20 %.
  return { ...FIXED, ...shade, hairline: `${shade.text}33` };
}

/**
 * The tone chosen in «Settings», read once as the app loads: the styles
 * take their colours when their files load, so a new choice shows when the
 * app is opened again (`../settings/ToneSetting`).
 */
export const tone: ToneChoice = loadToneChoice();

export const color: Palette = paletteOf(tone);

/**
 * The phone's status bar: light on the dark tone, dark on the light one, so
 * the clock and the battery read.
 */
export const statusBarStyle: "light" | "dark" = tone.tone === "dark" ? "light" : "dark";

/** Spacing, in the 4 px steps the layouts are built on. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  /** A card whose face is a photo or a drawing (TASK-339). */
  xl: 20,
  /** Sheets that rise from the bottom edge. */
  sheet: 26,
  pill: 999,
} as const;

export const fontSize = {
  /** Section labels, uppercase and letter-spaced. */
  label: 11,
  detail: 12,
  small: 13,
  body: 15,
  input: 16,
  /** A title over a photo, the first line of an empty state (`font.heading`). */
  heading: 20,
  title: 25,
  /** The distance on the result: the number people look for. */
  display: 40,
  /** The kilometres of a run in progress, read at arm's length while
   * running (TASK-169). */
  hero: 88,
} as const;

export const fontWeight = {
  light: "300",
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

/**
 * Letter-spacing by size (TASK-339, ADR-0293): large text is set a little
 * tighter, as display faces are; the uppercase labels a little wider, so
 * they read as labels and not as shouting. In points.
 */
export const tracking = {
  display: -1,
  title: -0.6,
  heading: -0.3,
  cardTitle: -0.2,
  label: 1.2,
} as const;

/**
 * The text styles of the app (TASK-339, ADR-0293): a size, a weight, its
 * tracking and its line height together, so a screen spreads one and adds
 * the colour. Titles are large and light, not bold: the weight is kept for
 * the yellow controls and for the kilometres of a run, read at arm's length
 * (`fontSize.hero`). Numbers that must line up add `fontVariant:
 * ["tabular-nums"]` where they are drawn.
 */
export const font = {
  /** The number people look for: the distance on the result. */
  display: {
    fontSize: 44,
    fontWeight: fontWeight.light,
    letterSpacing: tracking.display,
    lineHeight: 50,
  },
  /** The name of a page: the header, the top of a sub-page. */
  title: {
    fontSize: 30,
    fontWeight: fontWeight.regular,
    letterSpacing: tracking.title,
    lineHeight: 36,
  },
  /** A title over a photo, the first line of an empty state. */
  heading: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.heading,
    lineHeight: 26,
  },
  /** The title of a card. */
  cardTitle: {
    fontSize: 17,
    fontWeight: fontWeight.medium,
    letterSpacing: tracking.cardTitle,
    lineHeight: 22,
  },
  body: { fontSize: fontSize.body, fontWeight: fontWeight.regular, lineHeight: 22 },
  small: { fontSize: fontSize.small, fontWeight: fontWeight.regular, lineHeight: 18 },
  detail: { fontSize: fontSize.detail, fontWeight: fontWeight.regular, lineHeight: 16 },
  /** Section labels; uppercase where they are written, as before. */
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: tracking.label,
    lineHeight: 14,
  },
} as const;

/**
 * How the app moves (TASK-339, ADR-0293; springs TASK-388, ADR-0329): short,
 * and what moves settles on a spring that passes its mark by a hair, as
 * iOS does, never elastic. Durations in milliseconds.
 */
export const motion = {
  /** A control under the finger (`../ui/Tap`): this much smaller and dimmer,
   * in `pressMs`; let go, it comes back on `spring.snappy`. */
  pressScale: 0.97,
  pressOpacity: 0.85,
  pressMs: 120,
  /** The release before the springs: `Tap` no longer uses it; it goes once
   * the pull requests still open that read it are in (TASK-388). */
  releaseMs: 180,
  /**
   * The app's springs, for `Animated.spring` through `../ui/motion` only: no
   * screen makes up its own. Mass 1. In the words of SwiftUI, `response` is
   * 2π/√stiffness and the damping fraction damping/(2√stiffness):
   * - `snappy`, ~0.38 s, passes its mark by ~2.5%: a control let go, the
   *   tab bar's capsule, an icon taking its tab;
   * - `smooth`, ~0.48 s, passes by less than 0.1%: a sheet, a page;
   * - `island`, ~0.5 s, passes by ~1.7%: the island opening and closing.
   */
  spring: {
    snappy: { stiffness: 270, damping: 25, mass: 1 },
    smooth: { stiffness: 170, damping: 24, mass: 1 },
    island: { stiffness: 160, damping: 20, mass: 1 },
    /** ~0.39 s, critically damped, never passes its mark: the tab bar,
     * where a bounce at every change of page read as clunky (TASK-388 A2).
     * It has taken over from `snappy` there. */
    glide: { stiffness: 256, damping: 32, mass: 1 },
  },
  /** Something arriving on screen: a fade, rising this many points. */
  appearMs: 220,
  appearRise: 6,
  /** A sheet rising from the bottom edge. */
  sheetMs: 280,
} as const;

/**
 * The smallest a control may be. Anything the user taps while moving, with wet
 * fingers, is at least this tall.
 */
export const MIN_TAP_SIZE = 44;

/** The run drawn over its route (TASK-113): thin and light, so the yellow
 * of the plan shows on both sides where the run followed it. */
export const track = {
  color: color.text,
  width: 2,
  opacity: 0.9,
} as const;

/** The places a themed route passes by (TASK-129): light dots with their
 * name; those it does not reach, fainter and unnamed. */
export const stop = {
  passed: color.text,
  missed: color.textFaint,
  outline: color.map.background,
  radius: 6,
  label: color.text,
  halo: color.map.background,
} as const;

/** The other routes to choose from (TASK-093): thin and grey, under the
 * chosen one, so yellow still means the route that will be run. */
export const otherRoute = {
  color: color.textFaint,
  width: 2.5,
  opacity: 0.8,
} as const;

/** The route drawn on the map. */
export const route = {
  color: color.accent,
  width: 5,
  opacity: 0.95,
} as const;

/** A dark line under the route's, wider, so it shows as an edge. */
export type RouteCasing = {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
};

/**
 * The route's edge in a tone (TASK-263, ADR-0231): on the light map the
 * yellow is as light as the streets and does not read alone, so it runs
 * on a dark edge, the dark of text on yellow. The dark map needs none.
 */
export function routeCasingOf(shown: Tone): RouteCasing | null {
  return shown === "light"
    ? { color: color.onAccent, width: route.width + 3, opacity: 0.85 }
    : null;
}

/** The route's edge in the tone the app is shown in. */
export const routeCasing = routeCasingOf(tone.tone);

/** The route still to run while running it (TASK-224): the route's yellow
 * and width, dashed, blinking in steps between bright and dim. Never off,
 * so the way ahead reads in the dim beat too; the part run stays `route`.
 * Yellow and blinking, unlike the grey walks between letters (`walk`) and
 * the dark on-foot dashes (`onFoot`), which keep still. */
export const routeAhead = {
  color: route.color,
  width: route.width,
  opacity: route.opacity,
  /** The opacity of the dim beat. */
  dimOpacity: 0.3,
  /** Dash and gap, in line widths (MapLibre's `line-dasharray`). */
  dash: [2, 1.5],
  /** How long each beat lasts, bright or dim, in milliseconds. */
  beatMs: 700,
} as const;

/** The walks of a word with the pen up (TASK-198): the way from one letter
 * to the next, followed but not drawn. Dashed and grey, under the route, so
 * the letters alone are yellow and the word still reads. */
export const walk = {
  color: color.textMuted,
  width: 3,
  opacity: 0.9,
  /** Dash and gap, in line widths (MapLibre's `line-dasharray`). */
  dash: [2, 1.5],
} as const;

/** The stretches of a bike route walked with the bike on foot (TASK-206,
 * ADR-0167): dark dashes over the yellow route, which stays whole, since
 * they are part of the drawing. Dark as text on yellow (`onAccent`), and
 * not grey, the colour of the walks between letters. */
export const onFoot = {
  color: color.onAccent,
  width: 2,
  opacity: 0.9,
  /** Dash and gap, in line widths (MapLibre's `line-dasharray`). */
  dash: [1.5, 1.5],
} as const;
