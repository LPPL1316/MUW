import {
  type Activity,
  type EditReason,
  type ImageReason,
  IMAGE_REASONS,
  MAX_IMAGE_BYTES,
} from "@shaperoute/shared-types";

import { decimal, t, tLater } from "../i18n";
import { nearestTenths, tenthsToM, unitsNumber } from "../units/distanceInput";
import { METRES_PER_MILE } from "../units/format";
import { appUnits, type Units } from "../units/units";
import {
  APP_DISTANCE_LIMITS_KM,
  APP_DISTANCE_LIMITS_MI,
  offeredDistanceM,
} from "./distance";
import { shapeList } from "./shapeWords";
import type { EditProblem, ImageProblem } from "./useImageOutline";
import type { RouteProblem } from "./useRouteRequest";
import type { DrawKind } from "./wordInput";

/** What the route draws: a shape, a word, or the outline of an image. A
 * figure drawn by hand is drawn on the map (TASK-331). */
export type ChoiceKind = DrawKind | "image";

/**
 * What the screen says: what happened and what to do, then details. The
 * way out, when there is one to tap (TASK-031): a distance the shape fits,
 * or the shapes of the catalogue.
 */
export type ProblemText = {
  text: string;
  /** For whoever develops the app: the API's words, an address, a code.
   * Only in a development build (TASK-256). */
  detail?: string;
  tryDistanceM?: number;
  pickShape?: boolean;
  /** The same request may well go through a second time: «Try again»
   * (TASK-256). Not for a shape that does not fit, nor a key refused. */
  retry?: boolean;
};

/** `text` as a `detail`: in a development build; nothing on a phone. */
export function devDetail(text: string | undefined): string | undefined {
  return __DEV__ ? text : undefined;
}

/** Something the app did not expect from the API: the words for the runner,
 * who can do nothing about it but try again. */
function ourSide(detail: string): ProblemText {
  return {
    text: t("Something went wrong on our side. Try again in a moment."),
    detail: devDetail(detail),
    retry: true,
  };
}

/**
 * The distance the API says the shape fits at, as the app offers it: only
 * within the distances «Draw» offers for `activity`. In km as it is. With
 * «Miles» (TASK-182) the nearest whole mile within the limits; when that is
 * the distance just `asked`, the nearest tenth of a mile ("3.1 mi" after 3
 * mi), and none when that is it too: a «Try» never asks again for what
 * just failed. On the water the API's distance is the most that fits
 * (ADR-0164): `atMost` rounds down to the whole mile, never up.
 */
export function fitsAtM(
  fits: number | null | undefined,
  activity: Activity,
  units: Units = appUnits(),
  asked: number | null = null,
  atMost = false,
): number | null {
  const [lowest, highest] = APP_DISTANCE_LIMITS_KM[activity];
  if (fits == null || fits < lowest * 1000 || fits > highest * 1000) {
    return null;
  }
  if (units === "km") {
    return fits;
  }
  const [least, most] = APP_DISTANCE_LIMITS_MI[activity];
  if (atMost) {
    const miles = Math.min(most, Math.floor(fits / METRES_PER_MILE));
    const metres = tenthsToM(miles * 10, "mi");
    return miles < least || metres === asked ? null : metres;
  }
  const whole = offeredDistanceM(fits, activity, "mi");
  if (whole !== asked) {
    return whole;
  }
  const tenths = nearestTenths(fits, "mi");
  const metres = tenthsToM(tenths, "mi");
  return tenths < least * 10 || tenths > most * 10 || metres === asked ? null : metres;
}

/** "This shape does not fit…" with the distance it fits at, for what the
 * route draws: in km as the app always said it, in miles with «Miles». */
function fitsAtText(kind: ChoiceKind, fits: number, units: Units): string {
  if (units === "km") {
    const km = { km: fits / 1000 };
    switch (kind) {
      case "word":
        return t(
          "This word does not fit the roads here at this distance. It fits at about {km} km.",
          km,
        );
      case "image":
        return t(
          "This image does not fit the roads here at this distance. It fits at about {km} km.",
          km,
        );
      default:
        return t(
          "This shape does not fit the roads here at this distance. It fits at about {km} km.",
          km,
        );
    }
  }
  const miles = { mi: unitsNumber(fits, "mi") };
  switch (kind) {
    case "word":
      return t(
        "This word does not fit the roads here at this distance. It fits at about {mi} mi.",
        miles,
      );
    case "image":
      return t(
        "This image does not fit the roads here at this distance. It fits at about {mi} mi.",
        miles,
      );
    default:
      return t(
        "This shape does not fit the roads here at this distance. It fits at about {mi} mi.",
        miles,
      );
  }
}

/** `kind`: what the route draws; a word that does not fit is not offered
 * the shapes, but a shorter word (TASK-057). `activity`: the request's, whose
 * distances «Draw» offers (TASK-190); a run's unless said. `asked`: the
 * distance of the request, in metres, when there is one: with «Miles» a
 * distance offered is never the one that just failed (TASK-182). */
export function problemText(
  problem: RouteProblem,
  kind: ChoiceKind = "shape",
  activity: Activity = "running",
  asked: number | null = null,
  units: Units = appUnits(),
): ProblemText {
  switch (problem.kind) {
    case "api_error":
      switch (problem.code) {
        case "shape_not_drawable": {
          if (activity === "paddling") {
            return waterProblemText(
              problem.message,
              fitsAtM(problem.suggested_distance_m, activity, units, asked, true),
              units,
            );
          }
          // Offered only within the distances «Draw» offers for it.
          const fits = fitsAtM(problem.suggested_distance_m, activity, units, asked);
          if (fits !== null) {
            return {
              text: fitsAtText(kind, fits, units),
              detail: devDetail(problem.message),
              tryDistanceM: fits,
            };
          }
          if (kind === "word") {
            return {
              text: t(
                "This word does not fit the roads here. Try a shorter word, or another start.",
              ),
              detail: devDetail(problem.message),
            };
          }
          if (kind === "image") {
            return {
              text: t(
                "This outline does not fit the roads here. Try another distance, another start, or a simpler picture.",
              ),
              detail: devDetail(problem.message),
            };
          }
          return {
            text: t(
              "This shape does not fit the roads here. Try another shape, or another start:",
            ),
            detail: devDetail(problem.message),
            pickShape: true,
          };
        }
        case "map_data_unavailable":
          return {
            text: t("Map data for this area could not be downloaded. Try again later."),
            detail: devDetail(problem.message),
            retry: true,
          };
        case "engine_error":
          return {
            text: t("The route could not be drawn. Try again, or try another start."),
            detail: devDetail(problem.message),
            retry: true,
          };
        case "image_not_usable":
          return {
            text: isImageReason(problem.reason)
              ? t(REASON_TEXT[problem.reason])
              : t("The route engine cannot find one clear outline in this picture."),
            detail: devDetail(problem.message),
          };
        case "outline_edit_rejected":
          return {
            text:
              problem.reason && problem.reason in EDIT_REASON_TEXT
                ? t(EDIT_REASON_TEXT[problem.reason as EditReason])
                : t("This line cannot be added to the outline. Draw it again."),
            detail: devDetail(problem.message),
          };
        case "ai_unavailable":
          return {
            text: t("This word cannot be read right now. Try one of these: {list}.", {
              list: shapeList(),
            }),
            detail: devDetail(problem.message),
          };
        // The key and the limit of an API reached from outside (TASK-081). A
        // key refused is an app older than its service: nothing to retry.
        case "unauthorized":
          return {
            text: t("This version of the app is no longer allowed in. Update the app."),
            detail: devDetail(problem.message),
          };
        case "too_many_requests":
          return {
            text: t(
              "Too many requests to the API in the last minute. Wait a minute, then try again.",
            ),
            detail: devDetail(problem.message),
          };
        default:
          return ourSide(`${problem.code}: ${problem.message}`);
      }
    case "bad_answer":
      return ourSide(`unexpected answer, HTTP ${problem.status}`);
    case "unreachable":
      return {
        text: t("No connection. Check the network and try again."),
        detail: devDetail(`Cannot reach the API at ${problem.url}.`),
        retry: true,
      };
    case "timeout":
      return {
        text: t(
          "Drawing this route is taking too long. Try again later, or a shorter distance.",
        ),
        retry: true,
      };
    case "lost":
      return {
        text: t("This request was lost. Try again."),
        retry: true,
      };
    case "no_sharing":
      return { text: t("This phone cannot open the share sheet.") };
    case "share_failed":
      return { text: t("The GPX could not be saved on the phone. Try again.") };
    // An app built without the address of its service (TASK-256): on a
    // phone, only one older than the service.
    case "no_api_url":
      return {
        text: t("The app cannot reach the service. Update the app."),
        detail: devDetail(
          "The app has no API address: open it from the QR code of npm run mobile.",
        ),
      };
  }
}

/** The engine's words for a start with no water near it
 * (route_engine/water_fit.py, NoWaterError): the API passes them on. */
const NO_WATER = "no lake or sea";

/**
 * A shape not drawn on the water (TASK-191, ADR-0169), said for the water
 * and not the roads: no lake or sea near the start, or a shape that does not
 * fit within 1 km of the shore. There only shapes of the catalogue are
 * drawn. The distance the API offers is rounded down to the half km
 * (ADR-0164), "It fits at about 2.5 km"; `fits` is that distance as the app
 * offers it (fitsAtM), or null.
 */
function waterProblemText(
  message: string,
  fits: number | null,
  units: Units,
): ProblemText {
  if (message.includes(NO_WATER)) {
    return {
      // The engine looks within 2 km: a mile from the water is within them.
      text:
        units === "mi"
          ? t(
              "There is no lake or sea near this start. Start from the shore, within 1 mile of the water.",
            )
          : t(
              "There is no lake or sea near this start. Start from the shore, within 2 km of the water.",
            ),
      detail: devDetail(message),
    };
  }
  if (fits !== null) {
    return {
      text:
        units === "mi"
          ? t(
              "This shape does not fit on the water here at this distance. It fits at about {mi} mi.",
              { mi: unitsNumber(fits, "mi") },
            )
          : t(
              "This shape does not fit on the water here at this distance. It fits at about {km} km.",
              { km: fits / 1000 },
            ),
      detail: devDetail(message),
      tryDistanceM: fits,
    };
  }
  return {
    text: t(
      "This shape does not fit on the water here. Try a shorter distance, another shape, or another start:",
    ),
    detail: devDetail(message),
    pickShape: true,
  };
}

/**
 * Why the engine found no outline, in plain words and with what to do
 * (the reasons of route_engine/image_outline.py, ADR-0068). In English:
 * translated where shown, with t() (TASK-210).
 */
export const REASON_TEXT: Record<ImageReason, string> = {
  format: tLater("Only PNG and JPEG pictures work. Choose another one."),
  unreadable: tLater("This picture could not be read. Choose another one."),
  background: tLater(
    "The background is too busy. Use one subject on a plain background, like a drawing on white paper or an object on a bare table.",
  ),
  no_subject: tLater(
    "Nothing stands out from the background. Use a subject much darker or brighter than what is around it.",
  ),
  scattered: tLater(
    "The picture shows more than 4 separate things. Use a picture with 4 subjects at most.",
  ),
  edge: tLater(
    "The subject touches the edge of the picture. Leave some background all around it.",
  ),
  small: tLater("The subject is too small. Get closer, or use a bigger picture."),
  jagged: tLater("The outline is too jagged to run on roads. Try a simpler subject."),
};

function isImageReason(reason: unknown): reason is ImageReason {
  return (IMAGE_REASONS as readonly unknown[]).includes(reason);
}

/**
 * Why a line drawn on the outline was refused, in plain words and with what
 * to do (the reasons of route_engine/outline_edits.py, TASK-079).
 */
export const EDIT_REASON_TEXT: Record<EditReason, string> = {
  short: tLater("This line is too short to add. Draw a longer one."),
  covers_detail: tLater(
    "This part covers where a detail starts. Undo the detail first, or draw the part elsewhere.",
  ),
  too_many_corners: tLater(
    "That is too much for one route. Undo something, or draw simpler lines.",
  ),
};

/** Under the picture: why a drawn line was not added (TASK-079). */
export function editProblemText(problem: EditProblem): ProblemText {
  return problemText(problem, "image");
}

/** Under the picture: why there is no outline to draw. */
export function imageProblemText(problem: ImageProblem): ProblemText {
  switch (problem.kind) {
    case "denied":
      return {
        text: t(
          "The camera is off for this app. Allow it in Settings, or choose a picture instead.",
        ),
      };
    case "too_large":
      return {
        text: t(
          "This picture is too large: {mb} MB, at most {most} MB. Choose a smaller one.",
          { mb: decimal(problem.bytes / 1e6), most: MAX_IMAGE_BYTES / 1e6 },
        ),
      };
    case "pick_failed":
      return {
        text: t("The picture could not be opened. Try again, or choose another one."),
      };
    default:
      return problemText(problem, "image");
  }
}
