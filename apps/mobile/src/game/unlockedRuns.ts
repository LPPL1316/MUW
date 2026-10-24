import { fetchRunGame } from "./gameApi";
import { showUnlocked } from "./unlocks";

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * A run the API has just taken (`activitiesDoor.send`, TASK-296 part B):
 * what it was worth to the shape game, and the card for the shapes it
 * unlocked. `keptAt` is when the run was kept on the phone, so the card
 * waits for the logo after «Save»; null for a run sent later. Whatever the
 * API says otherwise, or fails to say, nothing happens: the push says it,
 * and «Play» shows the collection. Never throws.
 */
export async function tellUnlocked(
  baseUrl: string,
  token: string,
  key: string,
  keptAt: number | null,
  options: Options = {},
): Promise<void> {
  try {
    const outcome = await fetchRunGame(baseUrl, token, key, options);
    if (outcome.kind === "ok" && outcome.value.unlocked.length > 0) {
      showUnlocked(outcome.value.unlocked, keptAt);
    }
  } catch {
    // Nothing: the collection has the shape all the same.
  }
}
