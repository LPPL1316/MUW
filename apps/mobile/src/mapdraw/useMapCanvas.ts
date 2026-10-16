import type { Activity, LatLon, Shape } from "@shaperoute/shared-types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AnyRouteRequest } from "../api/routes";
import type { CanvasEvent, MapCanvas } from "../map/MapView";
import type { CanvasMode } from "../map/messages";
import type { ImageSource, Picked } from "../route/pickImage";
import type { SamplePicture } from "../route/samplePictures";
import { type ImageState, useImageOutline } from "../route/useImageOutline";
import { appUnits } from "../units/units";
import { canvasRequest, figureApart } from "./canvasRequest";
import { type DrawingProblem, newDrawing, withDetail } from "./drawing";
import {
  distanceOf,
  type Figure,
  type Placed,
  placeAt,
  placedLines,
  unitLimits,
  withinLimits,
} from "./figure";
import { type FigureChoice, figureOf } from "./resultFigure";

/** What «Undo» takes back (TASK-281): a figure put on the map or drawn, in
 * place of what was there; a tile that changed the figure where it is; a
 * line hung on the drawing. Moving and sizing are not undone. */
type Step =
  | { kind: "put"; before: Placed | null }
  | { kind: "swap"; before: Figure }
  | { kind: "detail" };

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
  /** What the figure would make, in metres, following two fingers. */
  distanceM: number | null;
  /** «Draw route»: the request for the figure where it is. */
  request: AnyRouteRequest | null;
  /** Why the last line drawn gave nothing. */
  problem: DrawingProblem | null;
  /** The screen opens: the map is framed on the figure, or the start. */
  open: () => void;
  /** «Try 8 km» on the route of the figure: the figure that size, and the
   * request for it, to draw at once. */
  sizeTo: (distanceM: number) => AnyRouteRequest | null;
  /** A tile under the route of the figure (TASK-286): that figure in its
   * place, with the same middle and as long as `distanceM`, and the request
   * for it, to draw at once. «Undo» puts back the one of before. */
  changeTo: (choice: FigureChoice, distanceM: number) => AnyRouteRequest | null;
};

/**
 * «Draw on the map» (TASK-281, ADR-0245): the figure on the map of the
 * town, drawn with a finger, a shape of the catalogue or a photo's outline;
 * moved and sized by the fingers on the map, changed in place by a tile, and
 * taken back by «Undo». It stays as it was while the route of it is shown,
 * so «←» comes back to it.
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
  const [problem, setProblem] = useState<DrawingProblem | null>(null);
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

  const setMode = useCallback((next: CanvasMode) => {
    setModeState(next);
    setProblem(null);
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
        setSteps((now) => [...now, { kind: "put", before: null }]);
        setKept(placeAt(figure, middle, distanceM ?? lowest, apartOf(figure)));
        setFraming((n) => n + 1);
        return;
      }
      setSteps((now) => [...now, { kind: "swap", before: placed.figure }]);
      setKept({ ...placed, figure });
    },
    [placed, start, distanceM, lowest, apartOf],
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
      // A line drawn: the ink on the map goes, whatever comes of it.
      setAnswers((n) => n + 1);
      if (mode !== "draw") {
        return;
      }
      const onDrawing = placed !== null && placed.figure.kind === "drawing";
      const drawn =
        placed !== null && onDrawing
          ? withDetail(placed, event.line)
          : newDrawing(event.line);
      if (drawn === null) {
        return;
      }
      if ("problem" in drawn) {
        setProblem(drawn.problem);
        return;
      }
      setProblem(null);
      setSteps((now) => [
        ...now,
        onDrawing ? { kind: "detail" } : { kind: "put", before: placed },
      ]);
      setKept(within(drawn.placed));
    },
    [placed, mode, within],
  );

  const undo = useCallback(() => {
    const step = steps[steps.length - 1];
    if (step === undefined) {
      return;
    }
    setSteps(steps.slice(0, -1));
    setProblem(null);
    if (step.kind === "put") {
      setKept(step.before);
    } else if (placed !== null && step.kind === "swap") {
      setKept({ ...placed, figure: step.before });
    } else if (placed !== null && placed.figure.kind === "drawing") {
      setKept({
        ...placed,
        figure: { ...placed.figure, details: placed.figure.details.slice(0, -1) },
      });
    }
  }, [steps, placed]);

  const apart = placed === null ? false : apartOf(placed.figure);
  const canvas = useMemo((): MapCanvas => {
    if (placed === null) {
      return { mode, lines: [], centre: null, shrink: 1, grow: 1, framing };
    }
    const [smallest, largest] = unitLimits(placed.figure, [lowest, highest], apart);
    return {
      mode,
      lines: placedLines(placed, apart),
      centre: placed.centre,
      shrink: smallest / placed.unitM,
      grow: largest / placed.unitM,
      framing,
    };
    // A new answer to a line is a new canvas, so the page clears its ink.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, apart, mode, lowest, highest, framing, answers]);

  // The app renders again with new units (TASK-182): the request follows.
  const units = appUnits();
  const request = useMemo(
    () => (placed === null ? null : canvasRequest(placed, penUp, activity, units)),
    [placed, penUp, activity, units],
  );

  const open = useCallback(() => setFraming((n) => n + 1), []);

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
      setSteps((now) => [...now, { kind: "put", before: placed }]);
      setProblem(null);
      setKept(changed);
      return canvasRequest(changed, penUp, activity, units);
    },
    [placed, within, apartOf, penUp, activity, units],
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
    distanceM: placed === null ? null : distanceOf(placed, apart) * sizing,
    request,
    problem,
    open,
    sizeTo,
    changeTo,
  };
}
