import { useCallback, useEffect, useRef } from "react";

import { useActivitiesDoor } from "../activities/activitiesDoor";
import { saveGymSession } from "../api/gym";
import { useFollowsDoor } from "../social/followsDoor";
import {
  type GymKept,
  gymToSend,
  keepGymWaiting,
  refuseGymWaiting,
  stopGymWaiting,
} from "./gymOutbox";
import { sessionRequest, type Workout } from "./workout";

/** What «Save» did with a workout: as a run's, or nobody signed in, or
 * nothing to save. */
export type GymSaved = GymKept | "signed_out" | "nothing";

/**
 * «Save» of a workout at the gym (TASK-385 part B): first into its file on
 * the phone, then to the API, now or when there is a network; once the API
 * has it, «My activities» asks for its list again. A workout the API will
 * not take (422, or 409 for a key of a run) stays on the phone and is not
 * sent again. `fetchFn` is for the tests.
 */
export function useGymOutbox(fetchFn?: typeof fetch): {
  save: (workout: Workout) => GymSaved;
} {
  const { apiUrl, account } = useFollowsDoor();
  const { owner, refresh } = useActivitiesDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  const sending = useRef(false);
  const latest = useRef({ apiUrl, token, owner, refresh, fetchFn });
  // The latest of each, for a send that waits on the network.
  useEffect(() => {
    latest.current = { apiUrl, token, owner, refresh, fetchFn };
  });

  const send = useCallback(async () => {
    const { apiUrl: url, token: key, owner: who } = latest.current;
    if (sending.current || url === null || key === null || who === null) {
      return;
    }
    sending.current = true;
    let sent = false;
    try {
      for (const waiting of gymToSend(who)) {
        const outcome = await saveGymSession(url, key, waiting.key, waiting.request, {
          fetchFn: latest.current.fetchFn,
        });
        if (outcome.kind === "ok") {
          stopGymWaiting(who, waiting.key);
          sent = true;
        } else if (
          outcome.kind === "api_error" &&
          (outcome.code === "invalid_request" || outcome.code === "http_error")
        ) {
          refuseGymWaiting(who, waiting.key, {
            code: outcome.code,
            message: outcome.message,
          });
        } else {
          // No network, or the API is away: they wait for the next time.
          break;
        }
      }
    } finally {
      sending.current = false;
      if (sent) {
        latest.current.refresh();
      }
    }
  }, []);

  // Those left from before go as soon as somebody is signed in.
  useEffect(() => {
    void send();
  }, [send, token, owner]);

  const save = useCallback(
    (workout: Workout): GymSaved => {
      const who = latest.current.owner;
      if (who === null) {
        return "signed_out";
      }
      const request = sessionRequest(workout);
      if (request === null) {
        return "nothing";
      }
      const kept = keepGymWaiting({ owner: who, key: workout.key, request });
      if (kept === "kept") {
        void send();
      }
      return kept;
    },
    [send],
  );

  return { save };
}
