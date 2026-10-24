/**
 * What the shape game tells the rest of the app (TASK-296 part B), the way
 * the logo after «Save» is told (`intro/SavedLogo`): a run the API has just
 * taken unlocked shapes, and the card over the app should say so; and the
 * card, or a notification, asks the app to show «Play».
 */

export type Unlocked = {
  /** The ids of the shapes, in the catalog's order. */
  shapeIds: readonly string[];
  /** When the run was kept on the phone (`Date.now()`), so the card waits
   * for the logo after «Save» to go; null for a run sent later. */
  keptAt: number | null;
};

const unlockListeners = new Set<(unlocked: Unlocked) => void>();

/** The API took a run that unlocked `shapeIds`: the card comes up. */
export function showUnlocked(
  shapeIds: readonly string[],
  keptAt: number | null = null,
): void {
  if (shapeIds.length === 0) {
    return;
  }
  unlockListeners.forEach((listener) => listener({ shapeIds, keptAt }));
}

export function onUnlocked(listener: (unlocked: Unlocked) => void): () => void {
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

const playListeners = new Set<() => void>();

/** Asks the app to show the «Play» page: from the card, or a notification. */
export function openPlay(): void {
  playListeners.forEach((listener) => listener());
}

export function onOpenPlay(listener: () => void): () => void {
  playListeners.add(listener);
  return () => {
    playListeners.delete(listener);
  };
}
