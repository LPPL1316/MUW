import type { Activity } from "@shaperoute/shared-types";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { useLanguage } from "../i18n/useLanguage";
import { isPaddle } from "../navigation/paddle";
import { isRide } from "../navigation/ride";
import { isSwim } from "../navigation/swim";
import type { Track } from "../navigation/trackRecorder";
import { useFollowsDoor } from "../social/followsDoor";
import { color, fontSize, fontWeight } from "../theme/tokens";
import { useUnits } from "../units/useUnits";
import { useGameCatalog } from "./gameCatalog";
import { loadRunStripData, type RunStripData, runStripText } from "./runStripData";

/**
 * The game's line on the run screen (TASK-296 part E, docs/GIOCO.md §9
 * «Durante la corsa»): one line of small text under the run's numbers with
 * the next shape by distance, "Hexagon 14.5 / 20 km", the kilometres the
 * API counted plus this run's, added on the phone; or, with a pace piece of
 * a team's challenge in hand, the last kilometre against its target. The
 * API is asked once, as the run starts, never while it goes on. Nothing at
 * all, and no request, on a bike or on the water (the game counts runs on
 * foot only), without an account, without the catalog on the phone (the
 * API has no game) or when the API could not be read: the run goes on as
 * before, with no error.
 */

type Options = { fetchFn?: typeof fetch; key?: string | null };

/**
 * The words of the line for `track`, the run under way, of `activity`;
 * null when there is nothing to say. Read once per run screen.
 */
export function useRunGameStrip(
  track: Track,
  activity: Activity | undefined,
  { fetchFn, key }: Options = {},
): string | null {
  const { apiUrl, account } = useFollowsDoor();
  const session = account.state.status === "signedIn" ? account.state.session : null;
  const token = session?.token ?? null;
  const publicId = session?.user.public_id ?? null;
  const catalog = useGameCatalog();
  const units = useUnits();
  const language = useLanguage();
  const onFoot = !isRide(activity) && !isPaddle(activity) && !isSwim(activity);
  const [data, setData] = useState<RunStripData | null>(null);
  // Once for the run: not again while it goes on, whatever changes.
  const asked = useRef(false);

  useEffect(() => {
    if (
      asked.current ||
      !onFoot ||
      apiUrl === null ||
      token === null ||
      catalog === null
    ) {
      return;
    }
    asked.current = true;
    void loadRunStripData(apiUrl, token, publicId, { fetchFn, key }).then(setData);
  }, [apiUrl, catalog, fetchFn, key, onFoot, publicId, token]);

  if (data === null || catalog === null || !onFoot) {
    return null;
  }
  return runStripText(data, catalog, track, units, language);
}

/** The line itself: small and grey, one line, nothing when there is
 * nothing to say. Not the yellow, which is the route's (ADR-0046). */
export function RunGameLine({ text }: { text: string | null }) {
  if (text === null) {
    return null;
  }
  return (
    <Text style={styles.line} numberOfLines={1} testID="game-strip">
      {text}
    </Text>
  );
}

type Props = {
  track: Track;
  activity: Activity | undefined;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** The line with its own reading: for a screen with one place for it. The
 * run's card reads once and shows the line on both its pages. */
export function RunGameStrip({ track, activity, fetchFn, apiKey }: Props) {
  return (
    <RunGameLine text={useRunGameStrip(track, activity, { fetchFn, key: apiKey })} />
  );
}

const styles = StyleSheet.create({
  line: {
    textAlign: "center",
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    fontVariant: ["tabular-nums"],
  },
});
