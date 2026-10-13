import type { EditKind, ImageOutline, OutlinePoint } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";

import { type ImageOutcome, requestImageOutline } from "../api/imageOutlines";
import { requestOutlineEdit } from "../api/outlineEdits";
import { type ImageSource, type Picked, type Picture, pickImage } from "./pickImage";

/** What can go wrong between choosing a picture and seeing its outline. */
export type ImageProblem =
  | Exclude<ImageOutcome, { kind: "outline" } | { kind: "cancelled" }>
  | Exclude<Picked, { kind: "picked" } | { kind: "cancelled" }>
  | { kind: "no_api_url" };

/** What can go wrong adding a drawn line to the outline (TASK-079). */
export type EditProblem = Exclude<
  ImageOutcome,
  { kind: "outline" } | { kind: "cancelled" }
>;

/** The line drawn last, while the API adds it, or why it was refused. */
export type EditState =
  | { status: "idle" }
  | { status: "sending"; kind: EditKind }
  | { status: "refused"; kind: EditKind; problem: EditProblem };

export type ImageState =
  | { status: "none" }
  /** The picture is on its way to the API, which traces its outline. */
  | { status: "tracing"; picture: Picture }
  /** `outline` is the one shown: as traced, or edited (TASK-079). `problem`
   * is why another picture could not be chosen after it (TASK-254): the
   * outline and its edits stay. */
  | {
      status: "traced";
      picture: Picture;
      outline: ImageOutline;
      problem?: ImageProblem;
    }
  /** `picture` is null when none was chosen: the picker failed. */
  | { status: "failed"; picture: Picture | null; problem: ImageProblem };

/** The edits of the outline shown (TASK-079): the outlines before it, the
 * traced one first, for Undo; and the line drawn last. */
export type EditsState = { earlier: ImageOutline[]; edit: EditState };

const IDLE: EditState = { status: "idle" };
const NO_EDITS: EditsState = { earlier: [], edit: IDLE };

/**
 * The picture chosen for the route and the outline the engine traced from
 * it (TASK-073): the app shows it before the route is asked for. A new
 * choice drops the one before; cancelling the picker keeps it. On the
 * outline, a line drawn with a finger becomes a part or a detail, one at a
 * time, and Undo takes the last one away (TASK-079).
 */
export function useImageOutline(
  baseUrl: string | null,
  pick: (source: ImageSource) => Promise<Picked> = pickImage,
): {
  state: ImageState;
  choose: (source: ImageSource) => void;
  show: (picture: Picture, outline: ImageOutline) => void;
  edits: EditsState;
  add: (kind: EditKind, line: OutlinePoint[]) => void;
  undo: () => void;
} {
  const [state, setState] = useState<ImageState>({ status: "none" });
  const [edits, setEdits] = useState<EditsState>(NO_EDITS);
  const current = useRef<AbortController | null>(null);
  // The state as it is when the picker answers, whatever `choose` closed over.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const choose = useCallback(
    (source: ImageSource) => {
      void (async () => {
        const picked = await pick(source);
        if (picked.kind === "cancelled") {
          return;
        }
        if (picked.kind !== "picked" && latest.current.status === "traced") {
          // No picture was taken (TASK-254): the outline traced and its
          // edits stay, and why the choice failed is shown beside them.
          setState((now) =>
            now.status === "traced" ? { ...now, problem: picked } : now,
          );
          return;
        }
        current.current?.abort();
        const mine = new AbortController();
        current.current = mine;
        setEdits(NO_EDITS);
        if (picked.kind !== "picked") {
          setState({ status: "failed", picture: null, problem: picked });
          return;
        }
        const { picture } = picked;
        if (!baseUrl) {
          setState({ status: "failed", picture, problem: { kind: "no_api_url" } });
          return;
        }
        setState({ status: "tracing", picture });
        const answer = await requestImageOutline(baseUrl, picked.base64, {
          signal: mine.signal,
        });
        if (current.current !== mine || answer.kind === "cancelled") {
          return;
        }
        current.current = null;
        setState(
          answer.kind === "outline"
            ? { status: "traced", picture, outline: answer.outline }
            : { status: "failed", picture, problem: answer },
        );
      })();
    },
    [baseUrl, pick],
  );

  // A ready-made picture of «Draw» (TASK-280): its outline is already
  // traced, so it shows at once, as a photo does once traced. Whatever was
  // on its way is dropped, as by a new choice.
  const show = useCallback((picture: Picture, outline: ImageOutline) => {
    current.current?.abort();
    current.current = null;
    setEdits(NO_EDITS);
    setState({ status: "traced", picture, outline });
  }, []);

  const add = useCallback(
    (kind: EditKind, line: OutlinePoint[]) => {
      if (!baseUrl || state.status !== "traced" || edits.edit.status === "sending") {
        return;
      }
      const mine = new AbortController();
      current.current = mine;
      const { outline } = state;
      setEdits({ ...edits, edit: { status: "sending", kind } });
      void (async () => {
        const answer = await requestOutlineEdit(baseUrl, outline, kind, line, {
          signal: mine.signal,
        });
        if (current.current !== mine || answer.kind === "cancelled") {
          return;
        }
        current.current = null;
        if (answer.kind !== "outline") {
          setEdits((now) => ({
            ...now,
            edit: { status: "refused", kind, problem: answer },
          }));
          return;
        }
        setState((now) =>
          now.status === "traced" ? { ...now, outline: answer.outline } : now,
        );
        setEdits((now) => ({ earlier: [...now.earlier, outline], edit: IDLE }));
      })();
    },
    [baseUrl, state, edits],
  );

  const undo = useCallback(() => {
    if (state.status !== "traced" || edits.earlier.length === 0) {
      return;
    }
    // A line still on its way was drawn on the outline being undone.
    current.current?.abort();
    current.current = null;
    setState({ ...state, outline: edits.earlier[edits.earlier.length - 1] });
    setEdits({ earlier: edits.earlier.slice(0, -1), edit: IDLE });
  }, [state, edits]);

  return { state, choose, show, edits, add, undo };
}
