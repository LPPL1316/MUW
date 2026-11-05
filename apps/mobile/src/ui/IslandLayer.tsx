import { useContext, useEffect } from "react";
import {
  type EdgeInsets,
  initialWindowMetrics,
  SafeAreaInsetsContext,
} from "react-native-safe-area-context";

import { useIsland } from "./useIsland";

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The layers on screen, the newest last: it is the one that speaks. */
const layers: ((text: string) => void)[] = [];

/**
 * The island says a few words where it is seen (TASK-388): in the newest
 * `IslandLayer` mounted, the one inside an open `Modal` before the one over
 * the app. Nothing with no layer on screen.
 */
export function sayInIsland(text: string): void {
  layers[layers.length - 1]?.(text);
}

/**
 * Where `sayInIsland` opens the island: one over the app (`Root`), and one
 * inside each `Modal` that stays open while it speaks, since what is under a
 * Modal does not show over it. A sheet that closes as it speaks needs none:
 * the island opens over the app as the sheet goes. Outside the app's
 * `SafeAreaProvider` it takes the phone's insets from the start.
 */
export function IslandLayer() {
  const [island, say] = useIsland();
  const known = useContext(SafeAreaInsetsContext);
  const insets = known ?? initialWindowMetrics?.insets ?? NO_INSETS;
  useEffect(() => {
    layers.push(say);
    return () => {
      const at = layers.lastIndexOf(say);
      if (at >= 0) {
        layers.splice(at, 1);
      }
    };
  }, [say]);
  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      {island}
    </SafeAreaInsetsContext.Provider>
  );
}
