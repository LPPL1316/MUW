import { useCallback, useState } from "react";

import {
  addLine,
  type BoardPoint,
  ERASE_SHARE,
  erased,
  type FreehandFigure,
  type FreehandProblem,
} from "./freehand";

/** The figure of the board, and what «Undo» takes back: the figures before
 * it, the oldest first. Nothing here asks the network. */
type State = {
  figure: FreehandFigure | null;
  earlier: (FreehandFigure | null)[];
  /** Why the last line gave nothing; gone with the next line that does. */
  problem: FreehandProblem | null;
};

export type FreehandState = {
  figure: FreehandFigure | null;
  problem: FreehandProblem | null;
  canUndo: boolean;
  /** A line drawn with a finger: the outline, or a detail on it. */
  addLine: (line: readonly BoardPoint[]) => void;
  /** «Erase»: a tap on a line. */
  erase: (point: BoardPoint, within?: number) => void;
  undo: () => void;
  /** The figure to start from (a shape, a route asked for), or none: the
   * steps before are forgotten. */
  set: (figure: FreehandFigure | null) => void;
};

const EMPTY: State = { figure: null, earlier: [], problem: null };

/**
 * The figure drawn by hand in «Draw» (TASK-320): kept while the user goes
 * to «Image» and back, as a picture chosen is kept; nothing leaves the
 * phone until «Draw route».
 */
export function useFreehand(): FreehandState {
  const [state, setState] = useState<State>(EMPTY);

  const add = useCallback((line: readonly BoardPoint[]) => {
    setState((now) => {
      const added = addLine(now.figure, line);
      if (added === null) {
        return now;
      }
      if ("problem" in added) {
        return { ...now, problem: added.problem };
      }
      return {
        figure: added.figure,
        earlier: [...now.earlier, now.figure],
        problem: null,
      };
    });
  }, []);

  const erase = useCallback((point: BoardPoint, within: number = ERASE_SHARE) => {
    setState((now) => {
      if (now.figure === null) {
        return now;
      }
      const left = erased(now.figure, point, within);
      if (left === null) {
        return now;
      }
      return {
        figure: left.figure,
        earlier: [...now.earlier, now.figure],
        problem: null,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((now) => {
      if (now.earlier.length === 0) {
        return now;
      }
      return {
        figure: now.earlier[now.earlier.length - 1],
        earlier: now.earlier.slice(0, -1),
        problem: null,
      };
    });
  }, []);

  const set = useCallback((figure: FreehandFigure | null) => {
    setState({ figure, earlier: [], problem: null });
  }, []);

  return {
    figure: state.figure,
    problem: state.problem,
    canUndo: state.earlier.length > 0,
    addLine: add,
    erase,
    undo,
    set,
  };
}
