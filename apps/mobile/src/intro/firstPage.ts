import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

/**
 * Whether the launch animation has played and the app's first page shows
 * (TASK-306): what the app does ahead of the user waits for it, so that the
 * heart is drawn smoothly. Once in a run of the app: «Try again» after an
 * error does not play the animation again.
 */
let shown = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The animation is over: the first page shows. */
export function markFirstPage(): void {
  if (!shown) {
    shown = true;
    listeners.forEach((listener) => listener());
  }
}

export function firstPageShown(): boolean {
  return shown;
}

export function useFirstPageShown(): boolean {
  return useSyncExternalStore(subscribe, firstPageShown);
}

/** For tests: as when the app has just opened. */
export function forgetFirstPage(): void {
  shown = false;
  listeners.forEach((listener) => listener());
}

/**
 * Whether the app may work ahead of the user now: the first page shows,
 * the app is in front (or only behind a panel of the system, as
 * aheadExamples.ts has it), and it is not `busy` (a run, the navigation).
 */
export function useMayWorkAhead(busy: boolean): boolean {
  const first = useFirstPageShown();
  const [front, setFront] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      setFront(next !== "background");
    });
    return () => subscription.remove();
  }, []);
  return first && front && !busy;
}
