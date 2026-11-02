import { sessionEnded } from "../account/messages";
import {
  choiceFrom,
  type DrawingChoice,
  isChosen,
  isSeen,
  sameChoice,
  saveDrawing,
  worthAgain,
} from "../api/drawings";
import { sendEntry } from "../contest/sendEntry";
import { keptList } from "../storage/keptList";
import { syncPhotos } from "./drawingPhotos";

/**
 * The choices for the drawings still to reach the API (TASK-117, TASK-208),
 * in a file of the app's documents, like the runs still to go to Strava
 * (strava/stravaOutbox.ts): a run saved with something chosen joins it
 * once the API has the run; a choice made on a run of «My activities»
 * without a network joins it at once. Only the latest choice for a run
 * waits: it is the choice whole, and sending it again changes nothing.
 * After the choice go the run's photos (drawingPhotos.ts), while others
 * see the drawing, then its entry in a monthly challenge (TASK-343 part B).
 */

export const DRAWING_OUTBOX_FILE = "drawings-outbox.json";
/** As many as the runs that can wait for the API. */
export const MAX_DRAWINGS_WAITING = 20;

export type DrawingWaiting = DrawingChoice & {
  /** The id of the account the run belongs to (User.id). */
  owner: number;
  /** The run's key in «My activities». */
  key: string;
};

/** An item of the file; a choice of before TASK-208 is made whole. */
function drawingWaitingFrom(value: unknown): DrawingWaiting | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const item = value as Record<string, unknown>;
  const choice = choiceFrom(item);
  if (
    choice === null ||
    typeof item.owner !== "number" ||
    typeof item.key !== "string"
  ) {
    return null;
  }
  return { owner: item.owner, key: item.key, ...choice };
}

function isDrawingWaiting(value: unknown): value is DrawingWaiting {
  return drawingWaitingFrom(value) !== null;
}

// Written so that a write cut short loses nothing that waited (TASK-252).
const kept = keptList(DRAWING_OUTBOX_FILE, isDrawingWaiting);

/** The choices in the file, the oldest first; none when it cannot be read. */
export function loadDrawingOutbox(): DrawingWaiting[] {
  return kept
    .load()
    .map(drawingWaitingFrom)
    .filter((item): item is DrawingWaiting => item !== null);
}

function saveDrawingOutbox(list: DrawingWaiting[]): boolean {
  return kept.save(list);
}

function sameRun(a: DrawingWaiting, owner: number, key: string): boolean {
  return a.owner === owner && a.key === key;
}

/** Adds `choice` in place of any earlier one for its run; false when the
 * file could not be written. */
export function keepForDrawing(choice: DrawingWaiting): boolean {
  const others = loadDrawingOutbox().filter(
    (item) => !sameRun(item, choice.owner, choice.key),
  );
  return saveDrawingOutbox(
    [
      ...others,
      {
        owner: choice.owner,
        key: choice.key,
        title: choice.title,
        description: choice.description,
        activity: choice.activity,
        tags: choice.tags.map((tag) => ({
          public_id: tag.public_id,
          username: tag.username,
        })),
        visibility: choice.visibility,
        ...(choice.entry === undefined ? {} : { entry: choice.entry }),
      },
    ].slice(-MAX_DRAWINGS_WAITING),
  );
}

/** The choice for the run `key` of `owner` still waiting; null when none. */
export function waitingDrawing(owner: number, key: string): DrawingWaiting | null {
  return loadDrawingOutbox().find((item) => sameRun(item, owner, key)) ?? null;
}

/** Takes `choice` out of the file, unless a newer one took its place. */
export function dropForDrawing(choice: DrawingWaiting): void {
  const list = loadDrawingOutbox();
  const next = list.filter(
    (item) => !(sameRun(item, choice.owner, choice.key) && sameChoice(item, choice)),
  );
  if (next.length !== list.length) {
    saveDrawingOutbox(next);
  }
}

/** Takes whatever waits for the run `key` of `owner` out of the file: the
 * API has answered a later choice, and an older one sent after it would
 * undo it (TASK-252). */
export function forgetForDrawing(owner: number, key: string): void {
  const list = loadDrawingOutbox();
  const next = list.filter((item) => !sameRun(item, owner, key));
  if (next.length !== list.length) {
    saveDrawingOutbox(next);
  }
}

/** Takes every choice of `owner` out of the file: the account is deleted
 * (TASK-252). */
export function forgetDrawingsOf(owner: number): void {
  const list = loadDrawingOutbox();
  const next = list.filter((item) => item.owner !== owner);
  if (next.length !== list.length) {
    saveDrawingOutbox(next);
  }
}

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * Sends the choices of `owner` that wait, the oldest first, each followed
 * by the photos of its run (drawingPhotos.ts). With no network, or the API
 * silent or busy, they wait on; a choice whose photos still wait stays
 * too, to be sent again before them, and one whose entry in a monthly
 * challenge could not go yet. A choice the API refuses leaves the file:
 * sending it again would change nothing; so does an entry refused, the
 * drawing stays published. A run too short to publish keeps the rest of its
 * choice, for its owner only (ADR-0159, point 4). "session_ended" when the
 * token opens no session any more.
 */
export async function sendWaitingDrawings(
  baseUrl: string,
  token: string,
  owner: number,
  options: Options = {},
): Promise<"done" | "session_ended"> {
  for (const choice of loadDrawingOutbox().filter((item) => item.owner === owner)) {
    const outcome = await saveDrawing(baseUrl, token, choice.key, choice, options);
    if (sessionEnded(outcome)) {
      return "session_ended";
    }
    if (worthAgain(outcome)) {
      break;
    }
    if (outcome.kind === "ok") {
      const photos = await syncPhotos(
        baseUrl,
        token,
        owner,
        choice.key,
        choice.visibility,
        options,
      );
      if (photos === "session_ended") {
        return "session_ended";
      }
      if (photos === "waits") {
        break;
      }
      const entry = await sendEntry(baseUrl, token, outcome.value.id, choice, options);
      if (entry.kind === "session_ended") {
        return "session_ended";
      }
      if (entry.kind === "waits") {
        break;
      }
    } else if (
      outcome.kind === "api_error" &&
      outcome.code === "invalid_request" &&
      isSeen(choice.visibility) &&
      isChosen({ ...choice, visibility: "only_me" })
    ) {
      await saveDrawing(
        baseUrl,
        token,
        choice.key,
        { ...choice, visibility: "only_me" },
        options,
      );
    }
    dropForDrawing(choice);
  }
  return "done";
}
