import type {
  Drawing,
  DrawingDetail,
  DrawingPhoto,
  DrawingsPage,
  MyDrawing,
} from "@shaperoute/shared-types";
import { DRAWING_MAX_PHOTOS } from "@shaperoute/shared-types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { sessionEnded } from "../account/messages";
import type { Account } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import {
  choiceOf as choiceOfDrawing,
  type DrawingChoice,
  drawingPhotoSource,
  drawingProblem,
  fetchDrawing,
  fetchMyDrawing,
  fetchMyDrawings,
  fetchUserDrawings,
  isSeen,
  saveDrawing,
  worthAgain,
} from "../api/drawings";
import { themedOf } from "../contest/contestApi";
import { enteredIn, keptContest } from "../contest/contestKept";
import { sendEntry } from "../contest/sendEntry";
import { t } from "../i18n";
import { forgetForDrawing, keepForDrawing, waitingDrawing } from "./drawingOutbox";
import {
  keepPhoto,
  loadDrawingPhotos,
  phonePhotoUri,
  photosOnPhone,
  removePhoto,
  syncPhotos,
} from "./drawingPhotos";

/** What the owner chose for a run, as a run of «My activities» shows it. */
export type ChoiceShown =
  /** `waiting`: chosen on this phone, not on the API yet. `photos`: the
   * API's, for the places this phone has no photo of. */
  | { kind: "known"; choice: DrawingChoice; waiting: boolean; photos: DrawingPhoto[] }
  /** An API from before drawings: nothing to choose. */
  | { kind: "off" }
  | { kind: "failed"; problem: string };

/** What came of a choice. */
export type Chosen =
  /** `entryProblem`: the drawing was saved, its entry in a monthly challenge
   * was refused (TASK-343 part B). */
  | { kind: "saved"; drawing: MyDrawing; entryProblem?: string }
  /** No network: on the phone, it goes with the next one. */
  | { kind: "waiting" }
  | { kind: "failed"; problem: string };

/** A photo of a run as the form shows it: from this phone, or from the API. */
export type PhotoShown = {
  n: number;
  source: { uri: string; headers?: Record<string, string> };
  onPhone: boolean;
};

/**
 * The drawings of the account as the whole app reaches them (TASK-117,
 * ADR-0159; TASK-208): what was chosen for a run of «My activities» and
 * its photos, which of its runs others see, the drawings of a profile,
 * and the drawing opened from one, which the map shows.
 */
export type DrawingsDoor = {
  /** The keys of the account's runs others see; empty until the API says. */
  publicKeys: ReadonlySet<string>;
  /** Asks the API which runs others see: «My activities» does when it shows. */
  refreshMine: () => void;
  /** What the owner chose for the run `key`; null with nobody signed in. */
  choiceOf: (key: string) => Promise<ChoiceShown | null>;
  /** Makes `choice` the run's, now or when there is a network, and the
   * run's photos the API's after it; null with nobody signed in. */
  choose: (key: string, choice: DrawingChoice) => Promise<Chosen | null>;
  /** The photos of the run `key` to show: this phone's, and `fromApi` for
   * the places it has none of (TASK-208). */
  photosOf: (key: string, fromApi: readonly DrawingPhoto[]) => PhotoShown[];
  /** Keeps `base64` as the photo `n` of the run `key` on this phone; false
   * when the phone refused. `choose` then sends it, while others see the run. */
  keepPhotoOf: (key: string, n: number, base64: string) => boolean;
  /** Takes the photo `n` of the run `key` off this phone; `onApi` when the
   * API has it: `choose` then empties the place there. */
  removePhotoOf: (key: string, n: number, onApi: boolean) => void;
  /** What an `Image` shows of a photo on the API; null with nobody signed in. */
  photoSource: (photo: DrawingPhoto) => PhotoShown["source"] | null;
  /** A page of the drawings of a profile; null with nobody signed in. */
  pageOf: (
    publicId: string,
    cursor: string | null,
  ) => Promise<AccountOutcome<DrawingsPage> | null>;
  /** The drawing being fetched whole, by id; null when none. */
  opening: string | null;
  /** Why the last drawing asked for did not open; null when it did. */
  openProblem: string | null;
  /** Fetches the drawing whole and shows it on the map. */
  open: (drawing: Pick<Drawing, "id">) => void;
  /** The drawing on the map; null when none. */
  opened: DrawingDetail | null;
  /** From the map back to «Profile», where it was opened. */
  back: () => void;
  /** From the map elsewhere, «Profile» left closed: «Draw it near me»
   * goes to «Draw» (TASK-313). */
  leave: () => void;
};

const NO_KEYS: ReadonlySet<string> = new Set();

const NOTHING: DrawingsDoor = {
  publicKeys: NO_KEYS,
  refreshMine: () => {},
  choiceOf: async () => null,
  choose: async () => null,
  photosOf: () => [],
  keepPhotoOf: () => false,
  removePhotoOf: () => {},
  photoSource: () => null,
  pageOf: async () => null,
  opening: null,
  openProblem: null,
  open: () => {},
  opened: null,
  back: () => {},
  leave: () => {},
};

/** Without «Profile» around it (a test of one screen): no drawings. */
export const DrawingsContext = createContext<DrawingsDoor>(NOTHING);

export function useDrawingsDoor(): DrawingsDoor {
  return useContext(DrawingsContext);
}

type Doors = {
  /** A drawing is on the map: «Profile» gets out of its way. */
  onOpened: () => void;
  /** Back from the map: «Profile» again, as it was. */
  onBack: () => void;
  /** Off the map elsewhere: what «Profile» kept behind it is let go. */
  onLeave?: () => void;
};

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** The public keys of one account: another token's are nobody's. */
type Held = { token: string; keys: ReadonlySet<string> };

/** The drawings of the account, for «Profile» to hand to the app. */
export function useDrawingsOf(
  baseUrl: string | null,
  account: Account,
  { onOpened, onBack, onLeave }: Doors,
  options: Options = {},
): DrawingsDoor {
  const { state, sessionEnded: endSession } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const owner = state.status === "signedIn" ? state.session.user.id : null;
  const publicId =
    state.status === "signedIn" ? (state.session.user.public_id ?? null) : null;
  const { fetchFn, key } = options;
  const [held, setHeld] = useState<Held | null>(null);

  /** Ends the session the API says is over; true when it did. */
  const ended = useCallback(
    (asking: string, outcome: AccountOutcome<unknown>) => {
      if (sessionEnded(outcome)) {
        endSession(asking);
        return true;
      }
      return false;
    },
    [endSession],
  );

  const refreshMine = useCallback(() => {
    if (token === null || baseUrl === null) {
      return;
    }
    void fetchMyDrawings(baseUrl, token, { fetchFn, key }).then((outcome) => {
      if (outcome.kind === "ok") {
        setHeld({
          token,
          keys: new Set(
            outcome.value
              .filter((d) => isSeen(choiceOfDrawing(d).visibility))
              .map((d) => d.key),
          ),
        });
      } else {
        ended(token, outcome);
      }
    });
  }, [baseUrl, ended, fetchFn, key, token]);

  /** The run `key` is seen by others, or not, as chosen. */
  const mark = useCallback((of: string, runKey: string, on: boolean) => {
    setHeld((was) => {
      const keys = new Set(was !== null && was.token === of ? was.keys : NO_KEYS);
      if (on) {
        keys.add(runKey);
      } else {
        keys.delete(runKey);
      }
      return { token: of, keys };
    });
  }, []);

  const choiceOf = useCallback(
    async (runKey: string): Promise<ChoiceShown | null> => {
      if (token === null || owner === null || baseUrl === null) {
        return null;
      }
      // What this phone chose and could not send yet is the choice.
      const waiting = waitingDrawing(owner, runKey);
      if (waiting !== null) {
        const { owner: _owner, key: _key, ...choice } = waiting;
        return { kind: "known", choice, waiting: true, photos: [] };
      }
      const outcome = await fetchMyDrawing(baseUrl, token, runKey, { fetchFn, key });
      if (outcome.kind === "ok") {
        // Entered in the monthly challenge: the switch of the form starts on.
        const kept = keptContest();
        const contest = kept === null ? null : themedOf(kept.contest);
        const entered =
          contest !== null &&
          outcome.value.id !== null &&
          enteredIn(kept, publicId).includes(outcome.value.id);
        return {
          kind: "known",
          choice: {
            ...choiceOfDrawing(outcome.value),
            ...(entered ? { entry: { contest: contest.id, entered: true } } : {}),
          },
          waiting: false,
          photos: outcome.value.photos ?? [],
        };
      }
      if (ended(token, outcome)) {
        return { kind: "failed", problem: drawingProblem(outcome) ?? "" };
      }
      // An API from before drawings, or a run deleted from another phone.
      if (outcome.kind === "api_error" && outcome.code === "http_error") {
        return { kind: "off" };
      }
      return { kind: "failed", problem: drawingProblem(outcome) ?? "" };
    },
    [baseUrl, ended, fetchFn, key, owner, publicId, token],
  );

  const choose = useCallback(
    async (runKey: string, choice: DrawingChoice): Promise<Chosen | null> => {
      if (token === null || owner === null || baseUrl === null) {
        return null;
      }
      const outcome = await saveDrawing(baseUrl, token, runKey, choice, {
        fetchFn,
        key,
      });
      if (outcome.kind === "ok") {
        // The API has this choice: an older one still waiting on the phone
        // would undo it when it is sent (TASK-252).
        forgetForDrawing(owner, runKey);
        const kept = choiceOfDrawing(outcome.value);
        mark(token, runKey, isSeen(kept.visibility));
        // Then the photos (TASK-208): those the phone has and the API has
        // not, while others see the run, and the places emptied here. A
        // photo that cannot go now goes with the next round of what waits.
        const emptied = new Set(
          loadDrawingPhotos()
            .filter(
              (item) => item.owner === owner && item.key === runKey && item.removed,
            )
            .map((item) => item.n),
        );
        const photos = await syncPhotos(
          baseUrl,
          token,
          owner,
          runKey,
          kept.visibility,
          {
            fetchFn,
            key,
          },
        );
        if (photos === "session_ended") {
          endSession(token);
        } else if (photos === "waits") {
          keepForDrawing({
            owner,
            key: runKey,
            ...kept,
            ...(choice.entry === undefined ? {} : { entry: choice.entry }),
          });
        }
        // The answer came before the photos went: without the places
        // emptied since, which the API has let go or will.
        const drawing: MyDrawing = {
          ...outcome.value,
          photos: (outcome.value.photos ?? []).filter((photo) => !emptied.has(photo.n)),
        };
        // And its entry in a monthly challenge (TASK-343 part B), once the
        // drawing is there: one that cannot go now waits with the choice.
        const entry = await sendEntry(baseUrl, token, drawing.id, choice, {
          fetchFn,
          key,
        });
        if (entry.kind === "session_ended") {
          endSession(token);
        } else if (entry.kind === "waits") {
          keepForDrawing({
            owner,
            key: runKey,
            ...kept,
            ...(choice.entry === undefined ? {} : { entry: choice.entry }),
          });
        } else if (entry.kind === "refused") {
          return { kind: "saved", drawing, entryProblem: entry.problem };
        }
        return { kind: "saved", drawing };
      }
      if (ended(token, outcome)) {
        return { kind: "failed", problem: drawingProblem(outcome) ?? "" };
      }
      if (worthAgain(outcome)) {
        if (keepForDrawing({ owner, key: runKey, ...choice })) {
          mark(token, runKey, isSeen(choice.visibility));
          return { kind: "waiting" };
        }
      } else {
        // Refused, and told so: the older choice does not go behind it.
        forgetForDrawing(owner, runKey);
      }
      return { kind: "failed", problem: drawingProblem(outcome) ?? "" };
    },
    [baseUrl, endSession, ended, fetchFn, key, mark, owner, token],
  );

  const photoSource = useCallback(
    (photo: DrawingPhoto) =>
      token === null || baseUrl === null
        ? null
        : drawingPhotoSource(baseUrl, token, photo),
    [baseUrl, token],
  );

  const photosOf = useCallback(
    (runKey: string, fromApi: readonly DrawingPhoto[]): PhotoShown[] => {
      if (owner === null) {
        return [];
      }
      const onPhone = photosOnPhone(owner, runKey);
      // A place emptied here is empty, whatever the API still holds there.
      const removed = new Set(
        loadDrawingPhotos()
          .filter((item) => item.owner === owner && item.key === runKey && item.removed)
          .map((item) => item.n),
      );
      const shown: PhotoShown[] = [];
      for (let n = 1; n <= DRAWING_MAX_PHOTOS; n += 1) {
        const mine = onPhone.find((photo) => photo.n === n);
        if (mine !== undefined) {
          shown.push({ n, source: { uri: phonePhotoUri(mine.base64) }, onPhone: true });
          continue;
        }
        const theirs = fromApi.find((photo) => photo.n === n);
        const source = theirs === undefined ? null : photoSource(theirs);
        if (source !== null && !removed.has(n)) {
          shown.push({ n, source, onPhone: false });
        }
      }
      return shown;
    },
    [owner, photoSource],
  );

  const keepPhotoOf = useCallback(
    (runKey: string, n: number, base64: string) =>
      owner !== null && keepPhoto(owner, runKey, n, base64),
    [owner],
  );

  const removePhotoOf = useCallback(
    (runKey: string, n: number, onApi: boolean) => {
      if (owner !== null) {
        removePhoto(owner, runKey, n, onApi);
      }
    },
    [owner],
  );

  const pageOf = useCallback(
    async (publicId: string, cursor: string | null) => {
      if (token === null || baseUrl === null) {
        return null;
      }
      const outcome = await fetchUserDrawings(baseUrl, token, publicId, cursor, {
        fetchFn,
        key,
      });
      ended(token, outcome);
      return outcome;
    },
    [baseUrl, ended, fetchFn, key, token],
  );

  const [opening, setOpening] = useState<string | null>(null);
  // With the token it was opened with: nobody else's drawing on the map.
  const [opened, setOpened] = useState<{
    token: string;
    drawing: DrawingDetail;
  } | null>(null);
  const [openProblem, setOpenProblem] = useState<string | null>(null);
  // The last drawing asked for wins.
  const asked = useRef<string | null>(null);
  const open = useCallback(
    (drawing: Pick<Drawing, "id">) => {
      if (token === null || baseUrl === null) {
        return;
      }
      asked.current = drawing.id;
      setOpening(drawing.id);
      setOpenProblem(null);
      void fetchDrawing(baseUrl, token, drawing.id, { fetchFn, key }).then(
        (outcome) => {
          if (asked.current !== drawing.id) {
            return;
          }
          asked.current = null;
          setOpening(null);
          if (outcome.kind === "ok") {
            setOpened({ token, drawing: outcome.value });
            onOpened();
            return;
          }
          ended(token, outcome);
          setOpenProblem(
            // Made private, or deleted, since the page came.
            outcome.kind === "api_error" && outcome.code === "http_error"
              ? t("This drawing is no longer public.")
              : (drawingProblem(outcome) ?? ""),
          );
        },
      );
    },
    [baseUrl, ended, fetchFn, key, onOpened, token],
  );
  const back = useCallback(() => {
    asked.current = null;
    setOpening(null);
    setOpened(null);
    onBack();
  }, [onBack]);
  const leave = useCallback(() => {
    asked.current = null;
    setOpening(null);
    setOpened(null);
    onLeave?.();
  }, [onLeave]);

  const publicKeys = held !== null && held.token === token ? held.keys : NO_KEYS;
  return useMemo(
    () => ({
      publicKeys,
      refreshMine,
      choiceOf,
      choose,
      photosOf,
      keepPhotoOf,
      removePhotoOf,
      photoSource,
      pageOf,
      opening: token === null ? null : opening,
      openProblem,
      open,
      opened: opened !== null && opened.token === token ? opened.drawing : null,
      back,
      leave,
    }),
    [
      publicKeys,
      refreshMine,
      choiceOf,
      choose,
      photosOf,
      keepPhotoOf,
      removePhotoOf,
      photoSource,
      pageOf,
      opening,
      openProblem,
      open,
      token,
      opened,
      back,
      leave,
    ],
  );
}
