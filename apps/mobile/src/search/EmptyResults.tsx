import { t } from "../i18n";
import { EmptyState } from "../ui/EmptyState";

/** The points of the round of the lens. */
const ROUND = 40;

/**
 * A magnifying glass in the empty states' form (`ui/outlines`): from 0 to
 * 1, y downwards. The round from the foot of the handle, all the way
 * round, then the handle down to the right, as a run would draw it.
 */
export const LENS: readonly (readonly [number, number])[] = (() => {
  const [cx, cy, r] = [0.4, 0.4, 0.32];
  const start = Math.PI / 4;
  const round = Array.from({ length: ROUND + 1 }, (_, i) => {
    const a = start + (2 * Math.PI * i) / ROUND;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  return [...round, [0.95, 0.95] as const];
})();

/**
 * Nothing found (TASK-344): the lens drawn faintly, «No drawings found»
 * and what to try; with filters on, the way to take them off.
 */
export function EmptyResults({ onReset }: { onReset?: () => void }) {
  return (
    <EmptyState
      outline={LENS}
      title={t("No drawings found")}
      message={t("Try other words, or change the filters.")}
      action={
        onReset === undefined ? undefined : { label: t("Reset"), onPress: onReset }
      }
      testID="search-empty"
    />
  );
}
