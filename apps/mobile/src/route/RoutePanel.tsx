import {
  type Activity,
  type LetterStyle,
  MAX_SHAPE_TEXT_LENGTH,
  type RouteResult,
  type Shape,
  SHAPES,
} from "@shaperoute/shared-types";
import type { Signal } from "@shaperoute/shared-types/src/signals";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { isImageRequest } from "../api/routes";
import { drawnOf, sendSignal } from "../api/signals";
import { decimal, t, tLater, tPlural } from "../i18n";
import { isDrawnOutline } from "../mapdraw/canvasRequest";
import { Segmented } from "../screens/Segmented";
import { milesAtLeast, tenthsToM, unitsNumber } from "../units/distanceInput";
import { distanceLabel, inUnits, METRES_PER_MILE } from "../units/format";
import { appUnits, type Units } from "../units/units";
import { useUnits } from "../units/useUnits";
import {
  betterDistanceM,
  betterDistanceText,
  type Left,
  tryText,
} from "./betterDistance";
import {
  distanceField,
  distanceLimits,
  LONG_DISTANCE_KM,
  switchDistance,
} from "./distance";
import { DistanceStepper } from "./DistanceStepper";
import { ImageChoice } from "./ImageChoice";
import { LoadingBar, ReadingBar } from "./LoadingBar";
import { penUpHint } from "./penUpHint";
import { offersPenUp } from "./penUpShapes";
import type { ImageSource } from "./pickImage";
import { type ChoiceKind, problemText } from "./problems";
import { RouteTiles } from "./RouteTiles";
import { ShapeTiles } from "./ShapeTiles";
import { shapeList, shapeName } from "./shapeWords";
import type { ExportState } from "./useGpxExport";
import type { ImageState } from "./useImageOutline";
import type { AnyRouteRequest, RouteProblem, RouteState } from "./useRouteRequest";
import type { ShapeReadingState } from "./useShapeReading";
import { penSplit } from "./walks";
import { type Note, shownNotes, toNotes } from "./warnings";
import { WhileRouting } from "./WhileRouting";
import {
  MAX_WORD_FIELD_LENGTH,
  routeName,
  type WordCheck,
  wordDistanceM,
} from "./wordInput";

// Translated where shown, with t() (TASK-210). «Freehand» first (TASK-340,
// the user's choice of 2026-10-29): it opens the map to draw on, and the
// switch never stays on it.
const FREEHAND = { value: "freehand", label: tLater("Freehand") } as const;
const DRAW_KINDS = [
  { value: "shape", label: tLater("Shape") },
  { value: "word", label: tLater("Word") },
  { value: "image", label: tLater("Image") },
] as const;

// The letters of a word (TASK-080, ADR-0075): "block" is square in the API.
const LETTER_STYLE_OPTIONS = [
  { value: "round", label: tLater("Round") },
  { value: "block", label: tLater("Square") },
] as const;

/** The options with their labels in the app's language. */
function translated<T extends string>(
  options: readonly { value: T; label: string }[],
): { value: T; label: string }[] {
  return options.map((option) => ({ ...option, label: t(option.label) }));
}

type ChoiceProps = {
  /** A shape, a word or an image: one of them, and the switch shows which. */
  kind: ChoiceKind;
  onKind: (kind: ChoiceKind) => void;
  /** The shape field as typed, and the shape it names (null: none). */
  shapeText: string;
  shape: Shape | null;
  onShapeText: (text: string) => void;
  /** The AI's reading of words the table does not know; null otherwise. */
  reading: ShapeReadingState | null;
  /** The user is done typing the shape: the AI may read it. */
  onShapeDone: () => void;
  /** The word field as typed, and whether it can be sent (wordInput.ts). */
  wordText: string;
  onWordText: (text: string) => void;
  wordCheck: WordCheck;
  /** Round or square letters for the word (TASK-080). */
  letterStyle: LetterStyle;
  onLetterStyle: (style: LetterStyle) => void;
  /** The pen lifted between the letters of the word (TASK-198), and between
   * the pieces of a shape that has them (TASK-223): the switch shows only
   * with a way to change it. */
  penUp?: boolean;
  onPenUp?: (on: boolean) => void;
  /** The picture chosen and its outline (TASK-073), and how to choose one. */
  image: ImageState;
  onChooseImage: (source: ImageSource) => void;
  /** The distance field as typed, km or with «Miles» miles (the text says
   * which: `units/distanceInput`), and what it means in metres (null: not
   * valid). */
  distanceText: string;
  distanceM: number | null;
  onDistanceText: (text: string) => void;
  /** Whose distances the field offers (TASK-190): a run's unless said. On
   * the water only shapes are drawn (TASK-191): no word, no picture. */
  activity?: Activity;
  /** «Freehand», first in the switch off the water (TASK-340): the map of
   * the start, to draw on (TASK-281). Without it the switch has three. */
  onFreehand?: () => void;
};

/**
 * What to draw (TASK-051): the shapes as tiles and a field for any other word,
 * or a word written letter by letter (TASK-057), or the outline of a picture
 * (TASK-073); then the distance. "Draw
 * route" sits apart, at the foot of the screen.
 */
export function RouteChoice({
  kind,
  onKind,
  shapeText,
  shape,
  onShapeText,
  reading,
  onShapeDone,
  wordText,
  onWordText,
  wordCheck,
  letterStyle,
  onLetterStyle,
  penUp = false,
  onPenUp,
  image,
  onChooseImage,
  distanceText,
  distanceM,
  onDistanceText,
  activity = "running",
  onFreehand,
}: ChoiceProps) {
  // The distance is asked in the app's units, at once (TASK-182).
  const units = useUnits();
  const [lowest, highest] = distanceLimits(activity, units);
  // «Settings» changed the units: the distance typed stays the same, to
  // the nearest whole km or mile within the limits.
  const typedIn = useRef(units);
  useEffect(() => {
    if (typedIn.current !== units) {
      typedIn.current = units;
      onDistanceText(switchDistance(distanceText, activity, units));
    }
  }, [units, distanceText, activity, onDistanceText]);
  const shapesOnly = activity === "paddling";
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{t("DRAW")}</Text>
      {shapesOnly ? (
        <Text style={styles.note}>{t("On the water, a shape of the catalogue.")}</Text>
      ) : (
        <Segmented<ChoiceKind | "freehand">
          options={translated(onFreehand ? [FREEHAND, ...DRAW_KINDS] : DRAW_KINDS)}
          value={kind}
          onChange={(value) => (value === "freehand" ? onFreehand?.() : onKind(value))}
          style={styles.kinds}
        />
      )}
      {kind === "shape" || shapesOnly ? (
        <>
          <ShapeTiles chosen={shape} onPick={onShapeText} />
          <TextInput
            style={styles.field}
            value={shapeText}
            onChangeText={onShapeText}
            onEndEditing={onShapeDone}
            maxLength={MAX_SHAPE_TEXT_LENGTH}
            placeholder={t("heart, star, horse…")}
            placeholderTextColor={color.textFaint}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            selectTextOnFocus
            accessibilityLabel={t("Shape")}
          />
          <ShapeNote text={shapeText} shape={shape} reading={reading} />
          {onPenUp && !shapesOnly && offersPenUp(shape) && (
            <PenSwitch
              label={t("Lift the pen between parts")}
              on={penUp}
              onChange={onPenUp}
            />
          )}
        </>
      ) : kind === "image" ? (
        <ImageChoice state={image} onChoose={onChooseImage} />
      ) : (
        <>
          <TextInput
            style={[styles.field, styles.wordField]}
            value={wordText}
            onChangeText={onWordText}
            maxLength={MAX_WORD_FIELD_LENGTH}
            placeholder="CIAO"
            placeholderTextColor={color.textFaint}
            keyboardAppearance="dark"
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            returnKeyType="done"
            accessibilityLabel={t("Word")}
          />
          <WordNote
            text={wordText}
            check={wordCheck}
            units={units}
            onDistance={(metres) => onDistanceText(distanceField(metres, units))}
          />
          <Text style={[styles.label, styles.section]}>{t("LETTERS")}</Text>
          <Segmented
            options={translated(LETTER_STYLE_OPTIONS)}
            value={letterStyle}
            onChange={onLetterStyle}
            style={styles.kinds}
          />
          {letterStyle === "block" && (
            <Text style={styles.note}>
              {t("Square letters follow the street grid: best for short words.")}
            </Text>
          )}
          {onPenUp && (
            <PenSwitch
              label={t("Lift the pen between letters")}
              on={penUp}
              onChange={onPenUp}
            />
          )}
        </>
      )}
      <Text style={[styles.label, styles.section]}>{t("DISTANCE")}</Text>
      <DistanceStepper
        text={distanceText}
        onText={onDistanceText}
        editable
        activity={activity}
      />
      {distanceM === null ? (
        <Text style={styles.problem}>
          {units === "mi"
            ? t("Enter a distance between {lowest} and {highest} mi.", {
                lowest,
                highest,
              })
            : t("Enter a distance between {lowest} and {highest} km.", {
                lowest,
                highest,
              })}
        </Text>
      ) : (
        distanceM > LONG_DISTANCE_KM * 1000 && (
          <Text style={styles.note}>
            {t("Long routes take longer: up to a few minutes.")}
          </Text>
        )
      )}
    </View>
  );
}

/** The one yellow control: it makes the route, and the route is yellow. */
export function DrawButton({
  enabled,
  onDraw,
}: {
  enabled: boolean;
  onDraw: () => void;
}) {
  return (
    <Pressable
      style={[styles.draw, !enabled && styles.off]}
      onPress={onDraw}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      <Text style={styles.drawText}>{t("Draw route")}</Text>
    </Pressable>
  );
}

type OutcomeProps = {
  /** The state of the request for the current start, shape and distance. */
  view: RouteState;
  onCancel: () => void;
  /** The GPX export of the route on screen. */
  exporting: ExportState;
  onExport: () => void;
  /** Ways out of a dead end (TASK-031): draw again at a distance the shape
   * fits, or choose a shape of the catalogue. */
  onTryDistance: (distanceM: number) => void;
  onPickShape: (shape: Shape) => void;
  /** Turn-by-turn along the route on screen (TASK-049). */
  onStart: () => void;
  /** On the water, when the route says where its shape is (TASK-238):
   * «Move the shape» lets the user drag it on the map. */
  onMove?: () => void;
  /** The moved shape did not fit where it was left: the panel says so. */
  movedElsewhere?: boolean;
  /** The routes to choose from and the one on screen (TASK-093); `view`
   * shows the one chosen. None: the route alone, as before. */
  choices?: RouteResult[];
  chosen?: number;
  onChoose?: (index: number) => void;
  /** Tells the API the route taken among A, B, C, and a way out taken
   * (TASK-142); POST /signals. */
  onSignal?: (signal: Signal) => void;
  /** Sends the request that failed again, as it was (TASK-256): «Try
   * again» under an error that may well not happen twice. Without it no
   * button is offered. */
  onRetry?: () => void;
  /** Another figure for the route on screen (TASK-286): a row of tiles
   * above «Start», once the route has come. */
  figures?: ReactNode;
  /** The same word again with the pen up (TASK-311 B): «Lift the pen»
   * under a word in one line that did not come out (penUpHint.ts). Without
   * it no line is offered. */
  onLiftPen?: () => void;
};

/** Under the map: the wait, the route, or why there is none. */
export function RouteOutcome({
  view,
  onCancel,
  exporting,
  onExport,
  onTryDistance,
  onPickShape,
  onStart,
  onMove,
  movedElsewhere = false,
  choices = [],
  chosen = 0,
  onChoose = () => {},
  onSignal = (signal) => void sendSignal(signal),
  onRetry,
  figures,
  onLiftPen,
}: OutcomeProps) {
  // The distances are written in the app's units, at once (TASK-182).
  const units = useUnits();
  // Each route of an answer counts once as chosen, by its first use: a
  // second export of it is no second choice.
  const told = useRef<{ of: RouteResult | null; routes: Set<number> }>({
    of: null,
    routes: new Set(),
  });
  // The request a «Try» under the route left (TASK-234): no line offers to
  // go back to it.
  const [left, setLeft] = useState<Left | null>(null);
  // The route whose notes were all opened with «Show more» (TASK-337):
  // another route, or the other of A and B, shows the first ones again.
  const [allNotesOf, setAllNotesOf] = useState<RouteResult | null>(null);
  // Where the shape comes out better: the request's, from the engine's
  // choice, whichever route is on screen.
  const better =
    view.status === "done"
      ? betterDistanceM(choices[0] ?? view.result, view.request, left, units)
      : null;
  // A word in one line that did not come out, judged on the engine's
  // choice too (TASK-311 B): «Lift the pen».
  const liftPen = onLiftPen && penUpHint(view, choices[0] ?? null) ? onLiftPen : null;
  const liftPenLine = liftPen && (
    <BetterDistance
      text={t("This word may come out better with the pen up: each letter on its own.")}
      tryLabel={t("Lift the pen")}
      onTry={liftPen}
    />
  );

  /** Start or export the route on screen, and say which one it was. */
  function use(via: "start" | "gpx", then: () => void) {
    if (view.status === "done") {
      if (told.current.of !== view.result) {
        told.current = { of: view.result, routes: new Set() };
      }
      if (!told.current.routes.has(chosen)) {
        told.current.routes.add(chosen);
        onSignal({
          kind: "route_chosen",
          ...drawnOf(view.request),
          index: chosen,
          of: Math.max(choices.length, 1),
          via,
        });
      }
    }
    then();
  }

  switch (view.status) {
    case "waiting":
      return (
        <View style={styles.panel}>
          <View style={styles.row}>
            <Text style={styles.waiting}>{waitingText(view, units)}</Text>
            <Pressable
              style={styles.secondary}
              onPress={onCancel}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{t("Cancel")}</Text>
            </Pressable>
          </View>
          {/* A bar, not the seconds: an estimate from the phase (ADR-0050). */}
          <LoadingBar
            phase={view.phase}
            distanceM={view.request.distance_m}
            word={isImageRequest(view.request) ? null : view.request.word}
          />
          {/* Drawings to look at, after a few seconds (TASK-317). */}
          <WhileRouting request={view.request} startedAt={view.startedAt} />
        </View>
      );
    case "done":
      return (
        <View style={styles.panel}>
          <View>
            <Text style={styles.result}>
              {distanceLabel(view.result.distance_m, units)}
            </Text>
            <Text style={styles.target}>{targetLine(view.request, units)}</Text>
            <PenSplit
              result={view.result}
              activity={view.request.activity}
              units={units}
            />
          </View>
          <RouteTiles choices={choices} chosen={chosen} onChoose={onChoose} />
          {better !== null && (
            <BetterDistance
              text={betterDistanceText(kindOf(view.request), better, units)}
              tryLabel={tryText(better, units)}
              onTry={() => {
                // How often the line is taken (TASK-234 C): an API before
                // it refuses the hint, and the app never knows.
                onSignal({
                  kind: "hint_taken",
                  ...drawnOf(view.request),
                  hint: "better_distance",
                  distance_m: view.request.distance_m,
                  to_m: better,
                });
                setLeft({ from: view.request, to: better });
                onTryDistance(better);
              }}
            />
          )}
          {liftPenLine}
          <Notes
            notes={toNotes(view.result.warnings)}
            all={allNotesOf === view.result}
            onShowAll={() => setAllNotesOf(view.result)}
          />
          {movedElsewhere && (
            <NoteRow
              note={{
                tone: "info",
                text: t("The shape does not fit there: this is the nearest place."),
              }}
            />
          )}
          {figures}
          {/* Only with directions: a route traced without them has no turns.
              On the water there are none to follow: the line is the way. */}
          {(view.result.directions.length > 0 || onWater(view.request)) && (
            <Pressable
              style={styles.draw}
              onPress={() => use("start", onStart)}
              accessibilityRole="button"
            >
              <Text style={styles.drawText}>{t("Start")}</Text>
            </Pressable>
          )}
          {onMove && (
            <Pressable
              style={[styles.secondary, styles.export]}
              onPress={onMove}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{t("Move the shape")}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.secondary, styles.export]}
            onPress={() => use("gpx", onExport)}
            disabled={exporting.status === "preparing"}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>
              {exporting.status === "preparing" ? t("Preparing GPX…") : t("Export GPX")}
            </Text>
          </Pressable>
          {exporting.status === "failed" && <Problem problem={exporting.problem} />}
        </View>
      );
    case "failed":
      return (
        <>
          <Problem
            problem={view.problem}
            kind={kindOf(view.request)}
            activity={view.request.activity}
            asked={view.request.distance_m}
            units={units}
            onRetry={onRetry}
            onTryDistance={(distanceM) => {
              onSignal({
                kind: "hint_taken",
                ...drawnOf(view.request),
                hint: "try_distance",
                distance_m: view.request.distance_m,
                to_m: distanceM,
              });
              onTryDistance(distanceM);
            }}
            onPickShape={(shape) => {
              onSignal({
                kind: "hint_taken",
                shape,
                hint: "catalog_shape",
                distance_m: view.request.distance_m,
              });
              onPickShape(shape);
            }}
          />
          {liftPenLine}
        </>
      );
    default:
      return null;
  }
}

/** On or off, as the run's switches are (RunDashboard). */
function PenSwitch({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Pressable
      style={[styles.switch, on && styles.switchOn]}
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <Text style={styles.switchText}>{label}</Text>
      <Text style={[styles.switchState, on && styles.switchStateOn]}>
        {on ? t("On") : t("Off")}
      </Text>
    </Pressable>
  );
}

/**
 * A word with the pen up (TASK-198): the km of its letters, what the run
 * records, apart from the km walked between them; on a bike, ridden
 * (TASK-216). So a shape in pieces, between its parts (TASK-223). Nothing
 * for any other route, nor from an API that sends no walks. With «Miles»
 * the same in miles (TASK-182). Also under a word of «Explore» (TASK-279).
 */
export function PenSplit({
  result,
  activity,
  units,
}: {
  result: RouteResult;
  activity: Activity;
  units: Units;
}) {
  const split = penSplit(result);
  if (split === null) {
    return null;
  }
  const drawn = decimal(inUnits(split.lettersM, units));
  const between = decimal(inUnits(split.walksM, units));
  if (units === "mi") {
    return (
      <Text style={styles.target}>
        {result.word !== null
          ? activity === "cycling"
            ? t("{letters} mi of letters + {between} mi riding between them", {
                letters: drawn,
                between,
              })
            : t("{letters} mi of letters + {between} mi walking between them", {
                letters: drawn,
                between,
              })
          : activity === "paddling"
            ? t("{drawn} mi of drawing + {between} mi paddling between the parts", {
                drawn,
                between,
              })
            : activity === "cycling"
              ? t("{drawn} mi of drawing + {between} mi riding between the parts", {
                  drawn,
                  between,
                })
              : t("{drawn} mi of drawing + {between} mi walking between the parts", {
                  drawn,
                  between,
                })}
      </Text>
    );
  }
  if (result.word === null) {
    return (
      <Text style={styles.target}>
        {activity === "paddling"
          ? // On the water (TASK-226): the whole is the distance asked.
            t("{drawn} km of drawing + {between} km paddling between the parts", {
              drawn,
              between,
            })
          : activity === "cycling"
            ? t("{drawn} km of drawing + {between} km riding between the parts", {
                drawn,
                between,
              })
            : t("{drawn} km of drawing + {between} km walking between the parts", {
                drawn,
                between,
              })}
      </Text>
    );
  }
  return (
    <Text style={styles.target}>
      {activity === "cycling"
        ? t("{letters} km of letters + {between} km riding between them", {
            letters: drawn,
            between,
          })
        : t("{letters} km of letters + {between} km walking between them", {
            letters: drawn,
            between,
          })}
    </Text>
  );
}

/** Under the shape field: the shape the words name, or why there is none. */
function ShapeNote({
  text,
  shape,
  reading,
}: {
  text: string;
  shape: Shape | null;
  reading: ShapeReadingState | null;
}) {
  if (shape !== null) {
    const name = shapeName(shape);
    // German writes «Herz» with a capital (TASK-210 F).
    return text.trim().toLowerCase() === name.toLowerCase() ? null : (
      <Text style={styles.note}>→ {name}</Text>
    );
  }
  switch (reading?.status) {
    case "unread":
      return (
        <Text style={styles.note}>{t("Press Done and the AI will read it.")}</Text>
      );
    case "reading":
      // A word may take the model 4–50 s: a bar, as for the route (TASK-058).
      return (
        <View style={styles.reading}>
          <Text style={styles.note}>{t("The AI is reading it…")}</Text>
          <ReadingBar />
        </View>
      );
    case "read":
      // What the model does not know it does not guess (AI.md, «Limiti»):
      // plainer words may work, or a shape of the catalogue, the tiles above.
      return (
        <Text style={styles.problem}>
          {t(
            "No shape in the catalogue for “{text}”. Describe what it looks like (“prancing horse”, not “Ferrari badge”), or pick one:",
            { text: text.trim() },
          )}
        </Text>
      );
    case "failed":
      return <Problem problem={reading.problem} />;
    default:
      return (
        <Text style={styles.problem}>
          {t("Unknown shape. Try: {list}.", { list: shapeList() })}
        </Text>
      );
  }
}

/**
 * Under the word field: how far the word needs, or why it cannot be drawn.
 * A distance too short for it can be raised with a tap.
 */
function WordNote({
  text,
  check,
  units,
  onDistance,
}: {
  text: string;
  check: WordCheck;
  units: Units;
  onDistance: (distanceM: number) => void;
}) {
  if (check.ok) {
    const letters = Array.from(check.word).length;
    return (
      <Text style={styles.note}>
        {units === "mi"
          ? tPlural(
              letters,
              "{count} letter: at least {mi} mi. A word takes a few minutes to draw.",
              "{count} letters: at least {mi} mi. A word takes a few minutes to draw.",
              { mi: milesAtLeast(wordDistanceM(check.word)) },
            )
          : tPlural(
              letters,
              "{count} letter: at least {km} km. A word takes a few minutes to draw.",
              "{count} letters: at least {km} km. A word takes a few minutes to draw.",
              { km: wordDistanceM(check.word) / 1000 },
            )}
      </Text>
    );
  }
  // An empty field is not a mistake: it says what to write.
  if (text.trim() === "") {
    return <Text style={styles.note}>{check.problem}</Text>;
  }
  const needs = check.needsDistanceM;
  // With «Miles» the next whole mile: never less than the word needs.
  const miles = needs === undefined ? 0 : Math.ceil(needs / METRES_PER_MILE - 1e-9);
  return (
    <View style={styles.problemBox}>
      <Text style={styles.problem}>{check.problem}</Text>
      {needs !== undefined && (
        <Pressable
          style={[styles.secondary, styles.choice]}
          onPress={() =>
            onDistance(units === "mi" ? tenthsToM(miles * 10, "mi") : needs)
          }
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>
            {units === "mi"
              ? t("Use {mi} mi", { mi: miles })
              : t("Use {km} km", { km: needs / 1000 })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** What the route draws, for the line under its distance: a figure drawn
 * by hand is a «Drawing» (TASK-320), known by the outline of its request
 * (TASK-331). */
function nameOf(request: AnyRouteRequest): string {
  if (isImageRequest(request)) {
    return isDrawnOutline(request.outline) ? t("Drawing") : t("Picture");
  }
  return routeName(request);
}

/** A route on the water (TASK-191): it follows no road, and has no turns. */
function onWater(request: AnyRouteRequest): boolean {
  return request.activity === "paddling";
}

/** The line under the route's distance: what it is, what it runs on, and
 * the distance asked for. */
function targetLine(request: AnyRouteRequest, units: Units): string {
  if (units === "mi") {
    const miles = { name: nameOf(request), mi: unitsNumber(request.distance_m, "mi") };
    return onWater(request)
      ? t("{name} · on the water · target {mi} mi", miles)
      : t("{name} · on roads · target {mi} mi", miles);
  }
  const values = { name: nameOf(request), km: request.distance_m / 1000 };
  return onWater(request)
    ? t("{name} · on the water · target {km} km", values)
    : t("{name} · on roads · target {km} km", values);
}

function kindOf(request: AnyRouteRequest): ChoiceKind {
  return isImageRequest(request) ? "image" : request.word ? "word" : "shape";
}

/** What the API is doing, as it said on its last answer. */
function waitingText(
  { phase, request }: Extract<RouteState, { status: "waiting" }>,
  units: Units,
) {
  switch (phase) {
    case "sending":
    case "queued":
      // Not drawing yet: said as a runner would, with no «API» (TASK-317).
      if (isImageRequest(request)) {
        return t("Warming up: the picture…");
      }
      return request.word
        ? t("Warming up: “{word}”…", { word: request.word })
        : t("Warming up: {name}…", { name: routeName(request) });
    case "downloading_map":
      return t("Downloading map data for this area…");
    default:
      if (units === "mi") {
        const mi = unitsNumber(request.distance_m, "mi");
        if (isImageRequest(request)) {
          return t("Drawing the picture's outline, {mi} mi…", { mi });
        }
        return request.word
          ? t("Drawing “{word}”, {mi} mi…", { word: request.word, mi })
          : t("Drawing a {mi} mi {name}…", { mi, name: routeName(request) });
      }
      const km = request.distance_m / 1000;
      if (isImageRequest(request)) {
        return t("Drawing the picture's outline, {km} km…", { km });
      }
      return request.word
        ? t("Drawing “{word}”, {km} km…", { word: request.word, km })
        : t("Drawing a {km} km {name}…", { km, name: routeName(request) });
  }
}

function Problem({
  problem,
  kind,
  activity,
  asked,
  units = appUnits(),
  onTryDistance,
  onPickShape,
  onRetry,
}: {
  problem: RouteProblem;
  kind?: ChoiceKind;
  /** The request's: a distance offered is within its limits (TASK-190). */
  activity?: Activity;
  /** The request's distance: with «Miles» the one offered is another. */
  asked?: number;
  /** The app's, when the problem may name a distance (TASK-182). */
  units?: Units;
  onTryDistance?: (distanceM: number) => void;
  onPickShape?: (shape: Shape) => void;
  /** The same request again (TASK-256), where the problem allows it. */
  onRetry?: () => void;
}) {
  const { text, detail, tryDistanceM, pickShape, retry } = problemText(
    problem,
    kind,
    activity,
    asked ?? null,
    units,
  );
  return (
    <View style={styles.problemBox}>
      <Text style={styles.problem}>{text}</Text>
      {retry && onRetry && (
        <Pressable
          style={[styles.secondary, styles.choice]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{t("Try again")}</Text>
        </Pressable>
      )}
      {tryDistanceM !== undefined && onTryDistance && (
        <Pressable
          style={[styles.secondary, styles.choice]}
          onPress={() => onTryDistance(tryDistanceM)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{tryText(tryDistanceM, units)}</Text>
        </Pressable>
      )}
      {pickShape && onPickShape && <ShapeChoices onPick={onPickShape} />}
      {detail && <Text style={styles.detail}>{detail}</Text>}
    </View>
  );
}

/** The shapes of the catalogue, each writing itself in the shape field. */
function ShapeChoices({ onPick }: { onPick: (shape: Shape) => void }) {
  return (
    <View style={styles.choices}>
      {SHAPES.map((shape) => (
        <Pressable
          key={shape}
          style={[styles.secondary, styles.chip]}
          onPress={() => onPick(shape)}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{shapeName(shape)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Under the route, the distance where the shape comes out better, and a
 * button that draws it there (TASK-234, ADR-0197). */
function BetterDistance({
  text,
  tryLabel,
  onTry,
}: {
  text: string;
  tryLabel: string;
  onTry: () => void;
}) {
  return (
    <View style={[styles.noteRow, styles.info, styles.problemBox]}>
      <Text style={styles.noteText}>{text}</Text>
      <Pressable
        style={[styles.secondary, styles.choice]}
        onPress={onTry}
        accessibilityRole="button"
      >
        <Text style={styles.secondaryText}>{tryLabel}</Text>
      </Pressable>
    </View>
  );
}

/**
 * A warning of the engine in plain words (warnings.ts), with a stripe that says
 * whether to watch for it (warning) or just to know it.
 */
function NoteRow({ note }: { note: Note }) {
  return (
    <View
      style={[styles.noteRow, note.tone === "caution" ? styles.caution : styles.info]}
    >
      <Text style={styles.noteText}>{note.text}</Text>
    </View>
  );
}

/**
 * The route's notes, the first two only (TASK-337): more pushed the map out
 * of sight. «Show more» opens the rest under them.
 */
function Notes({
  notes,
  all,
  onShowAll,
}: {
  notes: Note[];
  all: boolean;
  onShowAll: () => void;
}) {
  const shown = shownNotes(notes, all);
  return (
    <>
      {shown.map((note) => (
        <NoteRow key={note.text} note={note} />
      ))}
      {shown.length < notes.length && (
        <Pressable
          style={styles.moreNotes}
          onPress={onShowAll}
          hitSlop={space.sm}
          accessibilityRole="button"
        >
          <Text style={styles.moreNotesText}>{t("Show more")}</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  // Section labels, uppercase and letter-spaced (tokens: fontSize.label).
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  section: {
    marginTop: space.lg,
  },
  // On the screen's background the track needs a surface to show.
  kinds: {
    backgroundColor: color.surface,
  },
  wordField: {
    letterSpacing: 2,
  },
  field: {
    minHeight: MIN_TAP_SIZE,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.input,
    color: color.text,
    backgroundColor: color.surface,
  },
  note: {
    color: color.textMuted,
  },
  switch: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  switchOn: {
    borderColor: color.borderStrong,
  },
  switchText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  switchState: {
    color: color.textFaint,
    fontWeight: fontWeight.semibold,
  },
  switchStateOn: {
    color: color.text,
  },
  reading: {
    gap: space.sm,
  },
  draw: {
    minHeight: MIN_TAP_SIZE + space.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    backgroundColor: color.accent,
  },
  off: {
    opacity: 0.4,
  },
  // Dark on yellow: white does not reach the contrast minimum (ADR-0046).
  drawText: {
    color: color.onAccent,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.input,
  },
  waiting: {
    flex: 1,
    color: color.text,
  },
  secondary: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  secondaryText: {
    color: color.text,
    fontWeight: fontWeight.bold,
  },
  export: {
    alignItems: "center",
    marginTop: space.sm,
  },
  result: {
    color: color.text,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.display,
  },
  target: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  noteRow: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    backgroundColor: color.surfaceRaised,
  },
  // Not yellow: that means "route", and a warning is something else.
  caution: {
    borderLeftColor: color.warning,
  },
  info: {
    borderLeftColor: color.borderStrong,
  },
  noteText: {
    color: color.text,
    fontSize: fontSize.small,
  },
  // A quiet line, not a button: it should take less room than a note.
  moreNotes: {
    alignSelf: "flex-start",
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  moreNotesText: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  problem: {
    color: color.error,
  },
  problemBox: {
    gap: space.sm,
  },
  choice: {
    alignSelf: "flex-start",
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
  },
  detail: {
    color: color.textFaint,
    fontSize: fontSize.detail,
  },
});
