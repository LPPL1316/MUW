import type { GymExercises } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";

import { fetchGymExercises } from "../api/gym";
import { useFollowsDoor } from "../social/followsDoor";
import { ExerciseList } from "./ExerciseList";

type Props = {
  /** The post of a workout at the gym. */
  drawingId: string;
  /** For the tests: the API asked with this instead of `fetch`. */
  fetchFn?: typeof fetch;
};

/**
 * The exercises on the post of a workout at the gym, in its card (TASK-385
 * B0, ADR-0327), as a day of skiing has its lifts and pistes: asked of the
 * API with the account's token. Nothing shows while they come, when its
 * owner hides them (404) or when the API does not give them.
 */
export function GymDetail({ drawingId, fetchFn }: Props) {
  const { apiUrl, account } = useFollowsDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  const [shown, setShown] = useState<{ id: string; exercises: GymExercises } | null>(
    null,
  );
  useEffect(() => {
    if (apiUrl === null || token === null) {
      return;
    }
    let live = true;
    void fetchGymExercises(apiUrl, token, drawingId, { fetchFn }).then((outcome) => {
      if (live && outcome.kind === "ok") {
        setShown({ id: drawingId, exercises: outcome.value });
      }
    });
    return () => {
      live = false;
    };
  }, [apiUrl, token, drawingId, fetchFn]);
  if (shown === null || shown.id !== drawingId) {
    return null;
  }
  return <ExerciseList exercises={shown.exercises} />;
}
