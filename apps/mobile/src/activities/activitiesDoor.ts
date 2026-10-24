import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import type { Account } from "../account/useAccount";
import { sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import {
  type Activity,
  type ActivityDetail,
  fetchActivity,
  type RunPostRequest,
  saveActivity,
  savePost,
} from "../api/activities";
import { type DrawingChoice, isSeen } from "../api/drawings";
import { tellUnlocked } from "../game/unlockedRuns";
import { t, tLater } from "../i18n";
import { metresBetween } from "../map/coordinates";
import type { SavedRun } from "../navigation/trackStore";
import { keepForDrawing, sendWaitingDrawings } from "../social/drawingOutbox";
import { forgetPhotosOf, keepPhotos } from "../social/drawingPhotos";
import { keepForStrava, sendWaitingToStrava } from "../strava/stravaOutbox";
import {
  keepWaiting,
  loadOutbox,
  markRefused,
  MAX_WAITING,
  refusedOf,
  stopWaiting,
  toDrawingOf,
  type ToStrava,
  toStravaOf,
  type Waiting,
} from "./outbox";
import { type Drawn, recordedRun } from "./recordedRun";
import { activityProblem, type ActivitiesState, useActivities } from "./useActivities";

/** A run of this phone the API will not take (TASK-257), as «My
 * activities» shows it until it is discarded. */
export type RefusedRun = {
  id: string;
  /** When it began, on the phone's clock (ISO 8601); "" when the clock was
   * not one. */
  startedAt: string;
  /** Its length as the phone recorded it, in metres. */
  distanceM: number;
  /** The API's message, in English as it came. */
  message: string;
};

/**
 * The runs of the account as the whole app reaches them (TASK-172): the
 * run that just ended, which «Save» keeps; the list in «Profile»; and the
 * run opened from it, which the map shows.
 */
export type ActivitiesDoor = ActivitiesState & {
  /** Somebody is signed in: a run that ends can be saved. */
  signedIn: boolean;
  /**
   * «Save» on a run that ended: it goes to the API, now or when there is a
   * network. `drawn` is what its route draws. True once the run is safe on
   * the phone; false with nobody signed in, with less than a line, or when
   * the phone refuses the file, or when the account holds MAX_WAITING runs
   * on the phone already (`full`).
   */
  record: (run: SavedRun, drawn: Drawn | null) => boolean;
  /**
   * What the next `record` does with Strava (TASK-187): the run goes on to
   * Strava once the API has it, with this name; null: it does not. Told
   * by the end of the run just before «Save», and forgotten by `record`.
   */
  toStrava: (choice: ToStrava | null) => void;
  /**
   * What was chosen for the drawing of the next `record` (TASK-117,
   * TASK-208): it goes to the API once it has the run; null: nothing
   * chosen. Told by the end of the run just before «Save», and forgotten
   * by `record`.
   */
  toDrawing: (choice: DrawingChoice | null) => void;
  /**
   * The photos of the next `record` (TASK-208), JPEG in base64 in order:
   * kept on the phone with the run, and sent after its drawing while
   * others see it. Told just before «Save», forgotten by `record`.
   */
  toPhotos: (photos: readonly string[]) => void;
  /** The runs of this account still on the phone, waiting for the API;
   * those it refused too. */
  waiting: number;
  /** The phone holds MAX_WAITING runs of this account: «Save» keeps no
   * other until one goes (TASK-257). */
  full: boolean;
  /** The runs of this account the API will not take, the oldest first
   * (TASK-257). */
  refused: RefusedRun[];
  /** Takes a refused run off the phone, for good. */
  discard: (id: string) => void;
  /** Sends a refused run again. */
  retry: (id: string) => void;
  /** How many of them go public once the API has them (TASK-117). */
  waitingPublic: number;
  /** Opens «Profile» to sign up or log in, saying it keeps the runs. */
  signIn: () => void;
  /** The run of the list being fetched whole, by id; null when none. */
  opening: string | null;
  /** Fetches the run whole and shows it on the map. */
  open: (activity: Activity) => void;
  /** The run on the map; null when none. */
  opened: ActivityDetail | null;
  /** The map lets the run go. */
  close: () => void;
  /** From the map back to the list in «Profile». */
  showList: () => void;
  /**
   * The post of a saved run, as it was just shared (TASK-258): it goes to
   * the API, which keeps the last one. Nothing waits for the answer and
   * nothing is said of a failure: the post is a nicety, the share is done.
   */
  keepPost: (key: string, post: RunPostRequest) => void;
};

const NOTHING: ActivitiesDoor = {
  status: "off",
  list: [],
  total: null,
  more: false,
  loadingMore: false,
  problem: null,
  refresh: () => {},
  loadMore: () => {},
  remove: () => {},
  clearProblem: () => {},
  signedIn: false,
  record: () => false,
  toStrava: () => {},
  toDrawing: () => {},
  toPhotos: () => {},
  waiting: 0,
  full: false,
  refused: [],
  discard: () => {},
  retry: () => {},
  waitingPublic: 0,
  signIn: () => {},
  opening: null,
  open: () => {},
  opened: null,
  close: () => {},
  showList: () => {},
  keepPost: () => {},
};

/** Without «Profile» around it (a test of one screen): no activities. */
export const ActivitiesContext = createContext<ActivitiesDoor>(NOTHING);

export function useActivitiesDoor(): ActivitiesDoor {
  return useContext(ActivitiesContext);
}

/** What «Profile» says to who ends a run without an account; shown with
 * `t(SIGN_IN_TO_KEEP_RUNS)` (TASK-210). */
export const SIGN_IN_TO_KEEP_RUNS = tLater(
  "Sign up or log in to keep your runs and share them as drawings.",
);

type Doors = {
  /** Opens «Profile» on the list of the runs. */
  onList: () => void;
  /** Opens «Profile» on the account, with a line that says why. */
  onAccount: (hint: string) => void;
  /** A run is on the map: «Profile» gets out of its way. */
  onOpened: () => void;
};

type Options = { fetchFn?: typeof fetch; key?: string | null };

type Counted = {
  owner: number | null;
  count: number;
  publicCount: number;
  refused: RefusedRun[];
};

/** How many runs in a row the API may fail on before the round stops: one
 * run it cannot take must not hold the others, and an API in trouble must
 * not be sent every run that waits. */
const MAX_REFUSED_IN_A_ROW = 2;

/** After these answers the runs behind would fare no better: no network,
 * or the API asking to slow down. */
function restWaits(outcome: AccountOutcome<unknown>): boolean {
  return (
    outcome.kind === "unreachable" ||
    (outcome.kind === "api_error" && outcome.code === "too_many_requests")
  );
}

/** The API failing on its own side, not refusing the run. */
function serverFailed(outcome: AccountOutcome<unknown>): boolean {
  return outcome.kind === "bad_answer" && outcome.status >= 500;
}

/** The moment a run began, or "" when its clock was not one. */
function startedAtOf(run: Waiting): string {
  const when = new Date(run.request.track[0]?.time_ms ?? Number.NaN);
  return Number.isNaN(when.getTime()) ? "" : when.toISOString();
}

/** The length of the run's track as the phone recorded it. */
function distanceOf(run: Waiting): number {
  const { track } = run.request;
  let metres = 0;
  for (let i = 1; i < track.length; i += 1) {
    metres += metresBetween(track[i - 1].point, track[i].point);
  }
  return metres;
}

function waitingOf(owner: number | null): Counted {
  const runs = owner === null ? [] : loadOutbox().filter((run) => run.owner === owner);
  return {
    owner,
    count: runs.length,
    publicCount: runs.filter((run) => {
      const drawing = toDrawingOf(run);
      return drawing !== null && isSeen(drawing.visibility);
    }).length,
    refused: runs.flatMap((run): RefusedRun[] => {
      const refused = refusedOf(run);
      return refused === null
        ? []
        : [
            {
              id: run.id,
              startedAt: startedAtOf(run),
              distanceM: distanceOf(run),
              message: refused.message,
            },
          ];
    }),
  };
}

const NONE_REFUSED: RefusedRun[] = [];

/** The runs of the account, for «Profile» to hand to the app. */
export function useActivitiesOf(
  baseUrl: string | null,
  account: Account,
  { onList, onAccount, onOpened }: Doors,
  options: Options = {},
): ActivitiesDoor {
  const { state } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const owner = state.status === "signedIn" ? state.session.user.id : null;
  const activities = useActivities(baseUrl, token, account.sessionEnded, options);
  const { fetchFn, key } = options;
  const { sessionEnded: endSession } = account;
  const { refresh: refreshList } = activities;

  // The runs waiting on the phone (outbox.ts) go one at a time, the oldest
  // first; a run that ends meanwhile goes in a round of its own.
  // Counted from the file, again each time a run joins or leaves it, and
  // for another account as soon as it is the one signed in.
  const [counted, setCounted] = useState(() => waitingOf(owner));
  if (counted.owner !== owner) {
    setCounted(waitingOf(owner));
  }
  const waiting = counted.owner === owner ? counted.count : 0;
  const waitingPublic = counted.owner === owner ? counted.publicCount : 0;
  const refusedRuns = counted.owner === owner ? counted.refused : NONE_REFUSED;
  const recount = useCallback(() => setCounted(waitingOf(owner)), [owner]);
  const sending = useRef(false);
  const again = useRef(false);
  // When each run was kept by «Save» (`Date.now()`), until the API takes
  // it: the card of the shapes it unlocked waits for the logo (TASK-296).
  const justKept = useRef(new Map<string, number>());
  const send = useCallback(async () => {
    if (token === null || owner === null || baseUrl === null) {
      return;
    }
    if (sending.current) {
      again.current = true;
      return;
    }
    sending.current = true;
    let saved = false;
    let gone = false;
    let ended = false;
    try {
      do {
        again.current = false;
        let refused = 0;
        // A run the API refused for good waits for «Discard» or «Try
        // again» in «My activities» (TASK-257), and is not sent again.
        const toSend = loadOutbox().filter(
          (item) => item.owner === owner && refusedOf(item) === null,
        );
        for (const run of toSend) {
          const outcome = await saveActivity(baseUrl, token, run.id, run.request, {
            fetchFn,
            key,
          });
          if (outcome.kind === "ok") {
            refused = 0;
            // To Strava now that the API has it: in the file of Strava
            // first, so the run is not forgotten if the app closes here.
            const strava = toStravaOf(run);
            if (strava !== null) {
              keepForStrava({ owner, key: run.id, name: strava.name });
            }
            // And its title and «Public» (TASK-117), the same way.
            const drawing = toDrawingOf(run);
            if (drawing !== null) {
              keepForDrawing({ owner, key: run.id, ...drawing });
            }
            stopWaiting(owner, run.id);
            // The shape game (TASK-296): what the run unlocked, now that the
            // API has counted it. Outside the loop's wait: the next run goes.
            const keptAt = justKept.current.get(run.id) ?? null;
            justKept.current.delete(run.id);
            void tellUnlocked(baseUrl, token, run.id, keptAt, { fetchFn, key });
            saved = true;
            gone = true;
            continue;
          }
          // Not a run for the API (a track with nothing to believe, a list
          // that is full): sending it again would change nothing. It stays
          // on the phone with the reason, for «My activities» to show.
          if (outcome.kind === "api_error" && outcome.code === "invalid_request") {
            markRefused(owner, run.id, {
              code: outcome.code,
              message: outcome.message,
            });
            gone = true;
            continue;
          }
          if (sessionEnded(outcome)) {
            ended = true;
            endSession(token);
          } else if (!restWaits(outcome)) {
            // The API is there and will not take this run now: it waits,
            // and does not keep the runs after it waiting too (TASK-252).
            // A second answer like it in a row is the API in trouble.
            refused += 1;
            if (refused < MAX_REFUSED_IN_A_ROW || !serverFailed(outcome)) {
              continue;
            }
          }
          // No network, or the API is away: this run and the rest wait.
          again.current = false;
          break;
        }
        // Then what was chosen for their drawings (TASK-117, TASK-208),
        // these runs and those of before: before Strava, which takes the
        // description and what the run was from the drawing.
        if (
          !ended &&
          (await sendWaitingDrawings(baseUrl, token, owner, { fetchFn, key })) ===
            "session_ended"
        ) {
          ended = true;
          endSession(token);
        }
        // And what waits for Strava. A run that ends meanwhile still makes
        // another round.
        if (
          !ended &&
          (await sendWaitingToStrava(baseUrl, token, owner, { fetchFn, key })) ===
            "session_ended"
        ) {
          ended = true;
          endSession(token);
        }
      } while (again.current && !ended);
    } finally {
      sending.current = false;
    }
    if (gone) {
      recount();
    }
    if (saved) {
      // As the API has them: its metres, its score, the name of the place.
      refreshList();
    }
  }, [baseUrl, endSession, fetchFn, key, owner, recount, refreshList, token]);

  // When the app opens with an account, or somebody signs in: what waited
  // without a network goes now.
  useEffect(() => {
    void send();
  }, [send]);

  // And when the app comes back to the front: the network may be back
  // (TASK-252).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void send();
      }
    });
    return () => subscription.remove();
  }, [send]);

  // Told by the end of the run just before «Save», read by `record` once.
  const nextStrava = useRef<ToStrava | null>(null);
  const toStrava = useCallback((choice: ToStrava | null) => {
    nextStrava.current = choice;
  }, []);

  // The same for the title and «Public» (TASK-117).
  const nextDrawing = useRef<DrawingChoice | null>(null);
  const toDrawing = useCallback((choice: DrawingChoice | null) => {
    nextDrawing.current = choice;
  }, []);

  // And for the photos (TASK-208).
  const nextPhotos = useRef<readonly string[]>([]);
  const toPhotos = useCallback((photos: readonly string[]) => {
    nextPhotos.current = photos;
  }, []);

  const record = useCallback(
    (run: SavedRun, drawn: Drawn | null) => {
      const strava = nextStrava.current;
      nextStrava.current = null;
      const drawing = nextDrawing.current;
      nextDrawing.current = null;
      const photos = nextPhotos.current;
      nextPhotos.current = [];
      const recorded = owner === null ? null : recordedRun(run, drawn);
      if (owner === null || recorded === null) {
        return false;
      }
      // On the phone first: the run is not lost if the app closes now.
      const kept = keepWaiting({
        ...recorded,
        owner,
        ...(strava === null ? {} : { strava }),
        ...(drawing === null ? {} : { drawing }),
      });
      if (kept !== "kept") {
        // Counted again: «Save» says the phone is full from the file as it is.
        recount();
        return false;
      }
      // Its photos beside it (TASK-208): with the run safe, a photo the
      // phone will not write is a photo lost, not a run.
      keepPhotos(owner, recorded.id, photos);
      recount();
      justKept.current.set(recorded.id, Date.now());
      void send();
      return true;
    },
    [owner, recount, send],
  );

  // A refused run in «My activities» (TASK-257): thrown away after a yes,
  // or sent once more.
  const discard = useCallback(
    (id: string) => {
      if (owner !== null) {
        stopWaiting(owner, id);
        recount();
      }
    },
    [owner, recount],
  );
  const retry = useCallback(
    (id: string) => {
      if (owner !== null) {
        markRefused(owner, id, null);
        recount();
        void send();
      }
    },
    [owner, recount, send],
  );

  // The list asked again is also another try for what waits.
  const refresh = useCallback(() => {
    refreshList();
    void send();
  }, [refreshList, send]);

  const signIn = useCallback(() => onAccount(t(SIGN_IN_TO_KEEP_RUNS)), [onAccount]);

  const [opening, setOpening] = useState<string | null>(null);
  const [opened, setOpened] = useState<ActivityDetail | null>(null);
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  // The last run asked for wins.
  const asked = useRef<string | null>(null);
  const open = useCallback(
    (activity: Activity) => {
      if (token === null || baseUrl === null) {
        return;
      }
      asked.current = activity.id;
      setOpening(activity.id);
      setOpenProblem(null);
      void fetchActivity(baseUrl, token, activity.id, { fetchFn, key }).then(
        (outcome) => {
          if (asked.current !== activity.id) {
            return;
          }
          asked.current = null;
          setOpening(null);
          if (outcome.kind === "ok") {
            setOpened(outcome.value);
            onOpened();
            return;
          }
          if (sessionEnded(outcome)) {
            endSession(token);
          }
          setOpenProblem(
            // Deleted from another phone of the account since the list came.
            outcome.kind === "api_error" && outcome.code === "http_error"
              ? t("This run is no longer in your activities.")
              : activityProblem(outcome),
          );
        },
      );
    },
    [baseUrl, endSession, fetchFn, key, onOpened, token],
  );
  const close = useCallback(() => {
    asked.current = null;
    setOpening(null);
    setOpened(null);
  }, []);

  const { clearProblem: clearListProblem } = activities;
  const clearProblem = useCallback(() => {
    clearListProblem();
    setOpenProblem(null);
  }, [clearListProblem]);

  // The post as shared, to the API and no further (TASK-258): a session
  // that ended is the one thing worth hearing.
  const keepPost = useCallback(
    (runKey: string, post: RunPostRequest) => {
      if (token === null || baseUrl === null) {
        return;
      }
      void savePost(baseUrl, token, runKey, post, { fetchFn, key }).then((outcome) => {
        if (sessionEnded(outcome)) {
          endSession(token);
        }
      });
    },
    [baseUrl, endSession, fetchFn, key, token],
  );

  // A run deleted takes its photos off the phone too (TASK-208); the API
  // drops its own with the run.
  const { remove: removeFromList } = activities;
  const remove = useCallback(
    (id: string) => {
      removeFromList(id);
      if (owner !== null) {
        forgetPhotosOf(owner, id);
      }
    },
    [owner, removeFromList],
  );

  return useMemo(
    () => ({
      ...activities,
      refresh,
      remove,
      problem: activities.problem ?? openProblem,
      clearProblem,
      signedIn: owner !== null,
      record,
      toStrava,
      toDrawing,
      toPhotos,
      waiting,
      full: waiting >= MAX_WAITING,
      refused: refusedRuns,
      discard,
      retry,
      waitingPublic,
      signIn,
      opening,
      open,
      // Nobody signed in, nobody's run on the map.
      opened: token === null ? null : opened,
      close,
      showList: onList,
      keepPost,
    }),
    [
      activities,
      refresh,
      remove,
      openProblem,
      clearProblem,
      owner,
      record,
      toStrava,
      toDrawing,
      toPhotos,
      waiting,
      refusedRuns,
      discard,
      retry,
      waitingPublic,
      signIn,
      opening,
      open,
      token,
      opened,
      close,
      onList,
      keepPost,
    ],
  );
}
