import { type ReactNode, useCallback, useRef, useState } from "react";

import { Island, type IslandSay } from "./Island";

/**
 * A screen's island (TASK-388): `island` goes last in the screen, over the
 * rest; `say` opens it with a few words. Inside a `Modal`, put it in the
 * Modal: what is under a Modal does not show over it.
 */
export function useIsland(): [island: ReactNode, say: (text: string) => void] {
  const [said, setSaid] = useState<IslandSay | null>(null);
  const count = useRef(0);
  const say = useCallback((text: string) => {
    count.current += 1;
    setSaid({ id: count.current, text });
  }, []);
  const onDone = useCallback(() => setSaid(null), []);
  const island = said === null ? null : <Island say={said} onDone={onDone} />;
  return [island, say];
}
