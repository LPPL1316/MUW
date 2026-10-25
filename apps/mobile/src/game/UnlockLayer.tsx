import { useEffect, useState } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { SAVED_TOTAL_MS } from "../intro/SavedLogo";
import { gameCatalog, useGameCatalog } from "./gameCatalog";
import { UnlockCard } from "./UnlockCard";
import { onUnlocked, openPlay } from "./unlocks";

/**
 * Where «New shape unlocked» comes up (TASK-296 part B): over the app, under
 * the logo after «Save» (`intro/Root`). A run just saved shows its card once
 * the logo has gone; a run sent later, at once. Several shapes at a time are
 * shown one after the other; «See collection» closes them all and opens
 * «Play». A shape the catalog on the phone does not know is not shown.
 */
export function UnlockLayer() {
  const catalog = useGameCatalog();
  const language = useLanguage();
  const [queue, setQueue] = useState<readonly string[]>([]);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const stop = onUnlocked(({ shapeIds, keptAt }) => {
      const known = gameCatalog()?.shapes.map((each) => each.id) ?? [];
      const shown = shapeIds.filter((id) => known.includes(id));
      if (shown.length === 0) {
        return;
      }
      const wait =
        keptAt === null ? 0 : Math.max(0, keptAt + SAVED_TOTAL_MS - Date.now());
      const show = () => setQueue((last) => [...last, ...shown]);
      if (wait === 0) {
        show();
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        show();
      }, wait);
      timers.add(timer);
    });
    return () => {
      stop();
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);
  const shape = catalog?.shapes.find((each) => each.id === queue[0]) ?? null;
  if (shape === null) {
    return null;
  }
  return (
    <UnlockCard
      key={`${shape.id}-${queue.length}`}
      shape={shape}
      language={language}
      onClose={() => setQueue((last) => last.slice(1))}
      onPlay={() => {
        setQueue([]);
        openPlay();
      }}
    />
  );
}
