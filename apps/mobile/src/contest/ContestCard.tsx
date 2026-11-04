import type {
  Contest,
  ContestEntry,
  ContestMine,
  FeedPost,
} from "@shaperoute/shared-types";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RouteThumb } from "../explore/RouteThumb";
import { turnedLine } from "../feed/turnedLine";
import { t, tPlural } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { bearingOf } from "../map/turnedMap";
import { useBlockedNow } from "../social/blockedNow";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { themedOf, themeText } from "./contestApi";
import { openContestPage } from "./contestDoor";
import { ContestRules } from "./ContestRules";
import { contestTime, daysLeftText } from "./daysLeft";
import { useClock } from "./useClock";

/** The drawing of one of the first three, small. */
const THUMB_WIDTH = 64;
const THUMB_HEIGHT = 40;

type Props = {
  contest: Contest;
  /** The account's best post; undefined: no line of its own (`useContest`). */
  mine: ContestMine | null | undefined;
  /** Opens one of the first three as a post of «Feed»; left out (nobody
   * signed in), they are not buttons. */
  onOpen?: (drawing: FeedPost) => void;
};

/**
 * The contest at the top of «Feed», while it runs (TASK-299 part B,
 * docs/CONCORSI.md §7): «MuW contest» and the days it has left, what wins,
 * the first three with their drawing, their author and their reactions
 * (a tap opens the post), the account's best post or how to take part,
 * and «How it works», which opens the official rules. Without an account
 * the card has no line of its own; once the contest has ended, until the
 * winner is proclaimed, it says so and no longer asks to take part. A
 * monthly challenge (TASK-343 part B, recognised by its `theme`) has its
 * title in place of «MuW contest», and its head and «See the challenge» open
 * its page, where «How it works» is.
 */
export function ContestCard({ contest, mine, onOpen }: Props) {
  const [rules, setRules] = useState(false);
  const now = useClock();
  const language = useLanguage();
  const themed = themedOf(contest);
  const ended = contestTime(contest.ends_at, now).kind === "ended";
  const own =
    mine === undefined || (mine === null && ended)
      ? null
      : mine === null
        ? themed === null
          ? t("Publish a run to take part.")
          : t("Publish a run and enter it to take part.")
        : tPlural(
            mine.reactions,
            "Your best post: #{rank}, {count} reaction",
            "Your best post: #{rank}, {count} reactions",
            { rank: mine.rank },
          );
  const head = (
    <View style={styles.head}>
      <Text style={styles.title} accessibilityRole="header">
        {themed === null ? t("MuW contest") : themeText(themed.theme, language).title}
      </Text>
      <Text style={styles.left}>{daysLeftText(contest.ends_at, now)}</Text>
    </View>
  );
  return (
    <View style={styles.card} testID="contest-card">
      {themed === null ? (
        head
      ) : (
        <Pressable
          style={({ pressed }) => [styles.opens, pressed && styles.pressed]}
          onPress={() => openContestPage(contest.id)}
          testID="contest-card-head"
        >
          <Text style={styles.what}>{t("Monthly challenge")}</Text>
          {head}
        </Pressable>
      )}
      <Text style={styles.what}>{t("The post with the most reactions wins.")}</Text>
      {contest.top.length > 0 && (
        <View style={styles.top}>
          {contest.top.map((entry) => (
            <TopRow key={entry.drawing.id} entry={entry} onOpen={onOpen} />
          ))}
        </View>
      )}
      {own !== null && <Text style={styles.own}>{own}</Text>}
      {themed !== null ? (
        <SeeChallenge contestId={contest.id} />
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [styles.how, pressed && styles.pressed]}
            onPress={() => setRules(true)}
            accessibilityRole="button"
          >
            <Text style={styles.howText}>{t("How it works")}</Text>
          </Pressable>
          <ContestRules
            contest={contest}
            visible={rules}
            onClose={() => setRules(false)}
          />
        </>
      )}
    </View>
  );
}

/** «See the challenge»: the page of a monthly challenge (TASK-343 part B). */
export function SeeChallenge({ contestId }: { contestId: string }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.how, pressed && styles.pressed]}
      onPress={() => openContestPage(contestId)}
      accessibilityRole="button"
    >
      <Text style={styles.howText}>{t("See the challenge")}</Text>
    </Pressable>
  );
}

/** One of the first three: its place, its drawing, who ran it, its
 * reactions. Gone at once when its author is blocked, as its post. */
export function TopRow({
  entry,
  onOpen,
}: {
  entry: ContestEntry;
  onOpen?: (drawing: FeedPost) => void;
}) {
  const { drawing } = entry;
  const blocked = useBlockedNow(drawing.author.public_id);
  const line = useMemo(
    () => turnedLine(drawing.track_preview, bearingOf(drawing.rotation_deg)),
    [drawing.track_preview, drawing.rotation_deg],
  );
  if (blocked) {
    return null;
  }
  const reactions = tPlural(entry.reactions, "{count} reaction", "{count} reactions");
  const body = (
    <>
      <Text style={styles.rank}>{entry.rank}</Text>
      <RouteThumb line={line} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
      <Text style={styles.name} numberOfLines={1}>
        {drawing.author.username}
      </Text>
      <Text style={styles.reactions}>{reactions}</Text>
    </>
  );
  const label = `${entry.rank}. ${drawing.author.username}, ${reactions}`;
  if (onOpen === undefined) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onOpen(drawing)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  opens: {
    gap: space.xs,
  },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.md,
  },
  title: {
    flexShrink: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  left: {
    color: color.textMuted,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  what: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  top: {
    gap: space.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TAP_SIZE,
  },
  pressed: {
    opacity: 0.6,
  },
  rank: {
    width: space.lg,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
    textAlign: "center",
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  reactions: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  own: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  how: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  howText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "underline",
  },
});
