import { sessionEnded } from "../account/messages";
import { type DrawingChoice, entryToSend, worthAgain } from "../api/drawings";
import { entryProblem, setContestEntry } from "./contestApi";
import { tellEntered } from "./contestKept";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/** What came of the entry of a choice. */
export type EntrySent =
  /** Taken, or nothing to send. */
  | { kind: "done" }
  /** No network, or the API busy: the choice waits on the phone. */
  | { kind: "waits" }
  | { kind: "session_ended" }
  /** Refused: sending it again would change nothing. */
  | { kind: "refused"; problem: string };

/**
 * The entry chosen with a drawing (TASK-343 part B), once the API has the
 * drawing: `drawingId` is the id it answered with. The end of a run and the
 * queue of `drawingOutbox` go through here, and so does a run of «My
 * activities».
 */
export async function sendEntry(
  baseUrl: string,
  token: string,
  drawingId: string | null,
  choice: DrawingChoice,
  options: Options = {},
): Promise<EntrySent> {
  const entry = entryToSend(choice);
  if (entry === null || drawingId === null) {
    return { kind: "done" };
  }
  const outcome = await setContestEntry(
    baseUrl,
    token,
    entry.contest,
    drawingId,
    entry.entered,
    options,
  );
  if (outcome.kind === "ok") {
    tellEntered(baseUrl, token, entry.contest, drawingId, entry.entered, options);
    return { kind: "done" };
  }
  if (sessionEnded(outcome)) {
    return { kind: "session_ended" };
  }
  return worthAgain(outcome)
    ? { kind: "waits" }
    : { kind: "refused", problem: entryProblem(outcome) ?? "" };
}
