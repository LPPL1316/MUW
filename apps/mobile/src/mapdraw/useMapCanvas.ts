import type { Activity, LatLon, Shape } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AnyRouteRequest } from "../api/routes";
import { ERASER_PX, REACH_PX } from "../map/mapPage";
import type { CanvasEvent, MapCanvas } from "../map/MapView";
import type { CanvasMode } from "../map/messages";
import type { ImageSource, Picked } from "../route/pickImage";
import type { SamplePicture } from "../route/samplePictures";
import { type ImageState, useImageOutline } from "../route/useImageOutline";
import { appUnits } from "../units/units";
import { canvasRequest, figureApart } from "./canvasRequest";
import { isOpenLine, linkedOf, newDrawing, withDetail } from "./drawing";
import { asDrawing, drawingOf, type FigureLines, touchesLines } from "./edit";
import {
  distanceOf,
  type Figure,
  lookOf,
  onMap,
  type Placed,
  placeAt,
  placedLines,
  unitLimits,
  withinLimits,
} from "./figure";
import { dist } from "./geometry";
import { toPlane } from "./plane";
import { type FigureChoice, figureOf } from "./resultFigure";
import {
  bent,
  erased,
  type Straight,
  straightGoneOn,
  straightStarted,
  type ToolProblem,
  unitsOf,
} from "./tools";

/** What «Undo» takes back (TASK-281), and «Redo» puts again (TASK-331 part
 * B): a figure put on the map or drawn, or taken away, in place of what was
 * there; a tile, a line, the eraser, a point tapped or a bend that changed
 * the figure where it is. With it, the straight line being tapped then.
 * Moving and sizing are not undone. */
type Step = (
  { kind: "put"; before: Placed | null } | { kind: "swap"; before: Figure }
) & {
  straight: Straight | null;
};

export type MapCanvasOptions = {
  apiUrl: string | null;
  /** As «Draw» asks a shape in pieces: with the pen up when on. */
  penUp: boolean;
  activity: Activity;
  /** The distances «Draw» offers, in metres: the figure stays within. */
  limitsM: readonly [number, number];
  /** The distance of «Draw»: the size of the first figure put on the map. */
  distanceM: number | null;
  /** Where «Draw» starts: the map is there until it tells where it is. */
  start: LatLon | null;
  /** The phone's pictures, for «+ photo» (a stand-in in the tests). */
  pick?: (source: ImageSource) => Promise<Picked>;
};

export type MapCanvasState = {
  mode: CanvasMode;
  setMode: (mode: CanvasMode) => void;
  /** The figure on the map, within the distances; none at first. */
  placed: Placed | null;
  /** For the map, while the screen is on it. */
  canvas: MapCanvas;
  onCanvas: (event: CanvasEvent) => void;
  /** A tile: the shape in the middle of the map, or in place of the figure,
   * where it is and as big. */
  pick: (shape: Shape) => void;
  /** A ready-made picture of «Draw» (TASK-280): its outline, as a tile. */
  pickSample: (sample: SamplePicture) => void;
  /** «+ photo»: a picture of the phone, whose outline the engine traces. */
  photo: ImageState;
  choosePhoto: () => void;
  undo: () => void;
  canUndo: boolean;
  /** «Redo» (TASK-331 part B): what «Undo» took back, again. */
  redo: () => void;
  canRedo: boolean;
  /** «Clear all» (TASK-331 part B): the figure off the map; «Undo» puts it
   * back. */
  clear: () => void;
  /** What the figure would make, in metres, following two fingers. */
  distanceM: number | null;
  /** «Draw route»: the request for the figure where it is. */
  request: AnyRouteRequest | null;
  /** Why the last line drawn, or the last tool, gave nothing. */
  problem: ToolProblem | null;
  /** Whether a straight line is being tapped: its next point goes on it. */
  tapping: boolean;
  /** The screen opens: the map is framed on the figure, or the start. */
  open: () => void;
  /** «Edit the drawing» (TASK-331): the lines of a figure the app proposes
   * on the map as a drawing, in the middle of the start, as long as
   * `distanceM`, to draw on; «Undo» takes it away. False when they make no
   * drawing. */
  edit: (lines: FigureLines, distanceM: number) => boolean;
  /** «Try 8 km» on the route of the figure: the figure that size, and the
   * request for it, to draw at once. */
  sizeTo: (distanceM: number) => AnyRouteRequest | null;
  /** A tile under the route of the figure (TASK-286): that figure in its
   * place, with the same middle and as long as `distanceM`, and the request
   * for it, to draw at once. «Undo» puts back the one of before. */
  changeTo: (choice: FigureChoice, distanceM: number) => AnyRouteRequest | null;
};

/** One empty list, so the map is not told again and again of no marks. */
const NO_MARKS: LatLon[] = [];

/** Metres between two points of the map. */
function metresApart(a: LatLon, b: LatLon): number {
  return dist([0, 0], toPlane(a, b));
}

/**
 * «Draw on the map» (TASK-281, ADR-0245): the figure on the map of the
 * town, drawn with a finger, a shape of the catalogue or a photo's outline;
 * moved and sized by the fingers on the map, changed in place by a tile, by
 * a line drawn on it and by the tools of TASK-331 — the eraser, the
 * straight line, the bend — and taken back by «Undo», put again by «Redo».
 * It stays as it was while the route of it is shown, so «←» comes back to
 * it.
 */
export function useMapCanvas({
  apiUrl,
  penUp,
  activity,
  limitsM,
  distanceM,
  start,
  pick: pickPicture,
}: MapCanvasOptions): MapCanvasState {
  const [mode, setModeState] = useState<CanvasMode>("draw");
  const [kept, setKept] = useState<Placed | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [undone, setUndone] = useState<Step[]>([]);
  const [problem, setProblem] = useState<ToolProblem | null>(null);
  const [straight, setStraight] = useState<Straight | null>(null);
  // Two fingers sizing the figure: how many times bigger, so far.
  const [sizing, setSizing] = useState(1);
  // A new number frames the map; another answer to a line clears its ink.
  const [framing, setFraming] = useState(0);
  const [answers, setAnswers] = useState(0);
  // Where the middle of the map is, as the page last said.
  const centre = useRef<LatLon | null>(null);
  const photo = useImageOutline(apiUrl, pickPicture);
  const [lowest, highest] = limitsM;

  const apartOf = useCallback(
    (figure: Figure) => figureApart(figure, penUp, activity),
    [penUp, activity],
  );
  const within = useCallback(
    (placed: Placed) => withinLimits(placed, [lowest, highest], apartOf(placed.figure)),
    [lowest, highest, apartOf],
  );
  // Within the distances of now: a sport chosen since may have others.
  const placed = useMemo(() => (kept === null ? null : within(kept)), [kept, within]);

  /** `next` on the map in place of what is there, a step «Undo» takes back:
   * `put` puts back the whole figure of before, `swap` its lines where the
   * figure is then. A new change forgets what «Redo» would put again. */
  const change = useCallback(
    (
      next: Placed | null,
      how: "put" | "swap",
      straightNext: Straight | null = null,
    ) => {
      const step: Step =
        how === "swap" && placed !== null
          ? { kind: "swap", before: placed.figure, straight }
          : { kind: "put", before: placed, straight };
      setSteps((now) => [...now, step]);
      setUndone([]);
      setKept(next);
      setStraight(straightNext);
    },
    [placed, straight],
  );

  const setMode = useCallback((next: CanvasMode) => {
    setModeState(next);
    setProblem(null);
    // Another tool finishes the straight line.
    setStraight(null);
  }, []);

  /** `figure` on the map: in place of the one there, where it is and as
   * big; or in the middle of the map, as long as the distance of «Draw». */
  const putFigure = useCallback(
    (figure: Figure) => {
      setProblem(null);
      // Moving it is what comes next.
      setModeState("move");
      if (placed === null) {
        const middle = centre.current ?? start;
        if (middle === null) {
          return;
        }
        change(placeAt(figure, middle, distanceM ?? lowest, apartOf(figure)), "put");
        setFraming((n) => n + 1);
        return;
      }
      change({ ...placed, figure }, "swap");
    },
    [placed, start, distanceM, lowest, apartOf, change],
  );

  const pick = useCallback(
    (shape: Shape) => {
      if (placed?.figure.kind === "shape" && placed.figure.shape === shape) {
        return;
      }
      putFigure({ kind: "shape", shape });
    },
    [placed, putFigure],
  );

  const pickSample = useCallback(
    (sample: SamplePicture) => {
      if (placed?.figure.kind === "picture" && placed.figure.sample === sample.id) {
        return;
      }
      putFigure(figureOf({ kind: "picture", sample }));
    },
    [placed, putFigure],
  );

  // A photo traced: its outline is the figure, once.
  const tracedPut = useRef<unknown>(null);
  const traced = photo.state.status === "traced" ? photo.state.outline : null;
  useEffect(() => {
    if (traced !== null && traced !== tracedPut.current) {
      tracedPut.current = traced;
      putFigure({
        kind: "picture",
        outline: traced.points,
        strokes: traced.strokes ?? [],
      });
    }
  }, [traced, putFigure]);

  const { choose } = photo;
  const choosePhoto = useCallback(() => choose("library"), [choose]);

  /** The eraser (TASK-331 part B): the pieces of lines within `radiusM` of
   * the finger's path taken away. A shape of the catalogue is no drawing
   * to take apart: it goes whole. */
  const erase = useCallback(
    (line: readonly LatLon[], radiusM: number) => {
      if (placed === null) {
        return;
      }
      const rubbed = line.map((point) => unitsOf(placed, point));
      const radius = radiusM / placed.unitM;
      const drawing = asDrawing(placed.figure);
      if (drawing === null) {
        const lines = lookOf(placed.figure, apartOf(placed.figure)).lines;
        if (touchesLines(lines, rubbed, radius)) {
          setProblem(null);
          change(null, "put");
        }
        return;
      }
      const left = erased(drawing, rubbed, radius);
      if (left === null) {
        return;
      }
      if ("problem" in left) {
        setProblem(left.problem);
        return;
      }
      setProblem(null);
      change(
        left.drawing === null ? null : within({ ...placed, figure: left.drawing }),
        left.drawing === null ? "put" : "swap",
      );
    },
    [placed, within, apartOf, change],
  );

  /** A point tapped with «Line» (TASK-331 part B): the first of a straight
   * line, the next one it goes on to, its first point again to close it, or
   * its last one again to finish it. */
  const tap = useCallback(
    (point: LatLon, reachM: number) => {
      setProblem(null);
      if (straight === null) {
        change(placed, "put", { kind: "first", at: point });
        return;
      }
      if (straight.kind === "first") {
        if (metresApart(straight.at, point) <= reachM) {
          setStraight(null);
          return;
        }
        const drawing = placed === null ? null : asDrawing(placed.figure);
        const started = straightStarted(
          placed !== null && drawing !== null ? { placed, drawing } : null,
          straight.at,
          point,
          reachM,
        );
        if ("problem" in started) {
          setProblem(started.problem);
          return;
        }
        change(
          within(started.placed),
          drawing === null ? "put" : "swap",
          started.straight,
        );
        return;
      }
      const drawing = placed?.figure.kind === "drawing" ? placed.figure : null;
      const detail = drawing?.details[straight.index];
      if (placed === null || drawing === null || detail === undefined) {
        setStraight(null);
        return;
      }
      const at = unitsOf(placed, point);
      const reach = reachM / placed.unitM;
      if (dist(at, detail[detail.length - 1]) <= reach) {
        setStraight(null);
        return;
      }
      const gone = straightGoneOn(drawing, straight, at, reach);
      if ("problem" in gone) {
        setProblem(gone.problem);
        return;
      }
      change(
        within({ ...placed, figure: gone.drawing }),
        "swap",
        gone.closed ? null : straight,
      );
    },
    [placed, straight, within, change],
  );

  /** A line held and dragged with «Move» (TASK-331 part B). */
  const bend = useCallback(
    (from: LatLon, to: LatLon, reachM: number) => {
      const drawing = placed === null ? null : asDrawing(placed.figure);
      if (placed === null || drawing === null) {
        return;
      }
      const result = bent(
        drawing,
        unitsOf(placed, from),
        unitsOf(placed, to),
        reachM / placed.unitM,
      );
      if (result === null) {
        return;
      }
      if ("problem" in result) {
        setProblem(result.problem);
        return;
      }
      setProblem(null);
      change(within({ ...placed, figure: result.drawing }), "swap");
    },
    [placed, within, change],
  );

  const onCanvas = useCallback(
    (event: CanvasEvent) => {
      if (event.type === "centre") {
        centre.current = event.point;
        return;
      }
      if (event.type === "figure") {
        if (placed === null) {
          return;
        }
        if (!event.done) {
          setSizing(event.factor);
          return;
        }
        setSizing(1);
        setKept({
          ...placed,
          centre: event.centre,
          unitM: placed.unitM * event.factor,
        });
        return;
      }
      // A line drawn or bent: the page shows it until the app answers,
      // whatever comes of it.
      setAnswers((n) => n + 1);
      if (event.type === "bent") {
        bend(event.from, event.to, REACH_PX * event.metresPerPx);
        return;
      }
      if (mode === "erase") {
        erase(event.line, ERASER_PX * event.metresPerPx);
        return;
      }
      if (mode === "line") {
        tap(event.line[event.line.length - 1], REACH_PX * event.metresPerPx);
        return;
      }
      if (mode !== "draw") {
        return;
      }
      // On a photo the line joins it too: the figure becomes a drawing
      // where it is, as big (TASK-331). On a shape of the catalogue, which
      // is not changed, the line is a new drawing in its place.
      const drawing = placed === null ? null : asDrawing(placed.figure);
      const drawn =
        placed !== null && drawing !== null
          ? withDetail({ ...placed, figure: drawing }, event.line)
          : newDrawing(event.line);
      if (drawn === null) {
        return;
      }
      if ("problem" in drawn) {
        setProblem(drawn.problem);
        return;
      }
      setProblem(null);
      change(
        within(drawn.placed),
        placed !== null && drawing !== null ? "swap" : "put",
      );
    },
    [placed, mode, within, erase, tap, bend, change],
  );

  /** `step` done again, or undone: the figure as it was then, and the
   * straight line being tapped, while «Line» is still on. */
  const restore = useCallback(
    (step: Step) => {
      setProblem(null);
      if (step.kind === "put") {
        setKept(step.before);
      } else if (placed !== null) {
        setKept({ ...placed, figure: step.before });
      }
      setStraight(mode === "line" ? step.straight : null);
    },
    [placed, mode],
  );

  /** The step that takes the figure back to how it is now. */
  const stepBack = useCallback(
    (kind: Step["kind"]): Step =>
      kind === "swap" && placed !== null
        ? { kind: "swap", before: placed.figure, straight }
        : { kind: "put", before: placed, straight },
    [placed, straight],
  );

  const undo = useCallback(() => {
    const step = steps[steps.length - 1];
    if (step === undefined) {
      return;
    }
    setSteps(steps.slice(0, -1));
    setUndone((now) => [...now, stepBack(step.kind)]);
    restore(step);
  }, [steps, stepBack, restore]);

  const redo = useCallback(() => {
    const step = undone[undone.length - 1];
    if (step === undefined) {
      return;
    }
    setUndone(undone.slice(0, -1));
    setSteps((now) => [...now, stepBack(step.kind)]);
    restore(step);
  }, [undone, stepBack, restore]);

  const clear = useCallback(() => {
    if (placed !== null) {
      setProblem(null);
      change(null, "put");
    }
  }, [placed, change]);

  const apart = placed === null ? false : apartOf(placed.figure);
  // The points of the straight line being tapped, the first to close it.
  const marks = useMemo(() => {
    if (straight === null) {
      return NO_MARKS;
    }
    if (straight.kind === "first") {
      return [straight.at];
    }
    const detail =
      placed?.figure.kind === "drawing"
        ? placed.figure.details[straight.index]
        : undefined;
    if (placed === null || detail === undefined) {
      return NO_MARKS;
    }
    return detail.slice(straight.from).map((point) => onMap(placed, point));
  }, [straight, placed]);

  const canvas = useMemo((): MapCanvas => {
    if (placed === null) {
      return {
        mode,
        lines: [],
        links: [],
        bendable: [],
        marks,
        centre: null,
        shrink: 1,
        grow: 1,
        framing,
      };
    }
    const lines = placedLines(placed, apart);
    const figure = placed.figure;
    const drawing = figure.kind === "drawing" ? figure : null;
    const open = drawing !== null && isOpenLine(drawing.outline, drawing.details);
    const [smallest, largest] = unitLimits(figure, [lowest, highest], apart);
    return {
      mode,
      lines,
      // The outline has no link; a detail may.
      links: drawing === null ? lines.map(() => false) : [false, ...linkedOf(drawing)],
      // An emoji is not changed, nor the ring of an open line, which nothing
      // of shows.
      bendable:
        figure.kind === "shape"
          ? []
          : lines.map((_, i) => i).filter((i) => i > 0 || !open),
      marks,
      centre: placed.centre,
      shrink: smallest / placed.unitM,
      grow: largest / placed.unitM,
      framing,
    };
    // A new answer to a line is a new canvas, so the page clears its ink.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, apart, mode, marks, lowest, highest, framing, answers]);

  // The app renders again with new units (TASK-182): the request follows.
  const units = appUnits();
  const request = useMemo(
    () => (placed === null ? null : canvasRequest(placed, penUp, activity, units)),
    [placed, penUp, activity, units],
  );

  const open = useCallback(() => setFraming((n) => n + 1), []);

  const edit = useCallback(
    (lines: FigureLines, metres: number) => {
      const drawing = drawingOf(lines);
      const middle = start ?? centre.current;
      if (drawing === null || middle === null) {
        return false;
      }
      setProblem(null);
      // Drawing on it is what comes next.
      setModeState("draw");
      change(within(placeAt(drawing, middle, metres)), "put");
      setFraming((n) => n + 1);
      return true;
    },
    [start, within, change],
  );

  const sizeTo = useCallback(
    (metres: number) => {
      if (placed === null) {
        return null;
      }
      const sized = within(placeAt(placed.figure, placed.centre, metres, apart));
      setKept(sized);
      return canvasRequest(sized, penUp, activity, units);
    },
    [placed, apart, within, penUp, activity, units],
  );

  const changeTo = useCallback(
    (choice: FigureChoice, metres: number) => {
      if (placed === null) {
        return null;
      }
      const figure = figureOf(choice);
      const changed = within(placeAt(figure, placed.centre, metres, apartOf(figure)));
      setProblem(null);
      change(changed, "put");
      return canvasRequest(changed, penUp, activity, units);
    },
    [placed, within, apartOf, penUp, activity, units, change],
  );

  return {
    mode,
    setMode,
    placed,
    canvas,
    onCanvas,
    pick,
    pickSample,
    photo: photo.state,
    choosePhoto,
    undo,
    canUndo: steps.length > 0,
    redo,
    canRedo: undone.length > 0,
    clear,
    distanceM: placed === null ? null : distanceOf(placed, apart) * sizing,
    request,
    problem,
    tapping: straight !== null,
    open,
    edit,
    sizeTo,
    changeTo,
  };
}
