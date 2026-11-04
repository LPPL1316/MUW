import type { FeedPost, PastContest } from "@shaperoute/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { dayLabel } from "../activities/activityText";
import { t } from "../i18n";
import { useLanguage } from "../i18n/useLanguage";
import { useFollowsDoor } from "../social/followsDoor";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { fetchPastContests, noContest, themeText } from "./contestApi";
import { TopRow } from "./ContestCard";
import { WinnerBadge } from "./WinnerBadge";

type Props = {
  /** Back to the page of the challenge. */
  onBack: () => void;
  /** Opens one of the first three as a post; left out with nobody signed in. */
  onOpen?: (drawing: FeedPost) => void;
  /** The list's top and bottom, clear of the phone's bars. */
  paddingTop: number;
  paddingBottom: number;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * «Past challenges» (TASK-343 part B, docs/CONCORSI.md §15): the contests
 * closed, the latest first, each with its theme, its days, its winner and its
 * first three; a tap on one of those opens the post. A contest without a
 * theme is there too, as «MuW contest». An API that has no archive (404) is
 * an empty one.
 */
export function PastContests({
  onBack,
  onOpen,
  paddingTop,
  paddingBottom,
  fetchFn,
  apiKey,
}: Props) {
  const { apiUrl, account } = useFollowsDoor();
  const { state } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const [contests, setContests] = useState<readonly PastContest[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const next = useRef<string | null>(null);
  const busy = useRef(false);
  const ask = useCallback(
    (cursor: string | null) => {
      if (apiUrl === null || busy.current) {
        return;
      }
      busy.current = true;
      void fetchPastContests(apiUrl, token, cursor, {
        fetchFn,
        key: apiKey,
      }).then((outcome) => {
        busy.current = false;
        if (outcome.kind === "ok") {
          next.current = outcome.value.next;
          setContests((was) =>
            cursor === null
              ? outcome.value.contests
              : [...was, ...outcome.value.contests],
          );
          setStatus("ready");
        } else {
          setStatus(noContest(outcome) ? "ready" : "failed");
        }
      });
    },
    [apiKey, apiUrl, fetchFn, token],
  );
  useEffect(() => {
    ask(null);
  }, [ask]);
  return (
    <FlatList<PastContest>
      style={styles.list}
      contentContainerStyle={[styles.content, { paddingTop, paddingBottom }]}
      data={contests}
      keyExtractor={(contest) => contest.id}
      renderItem={({ item }) => <PastCard contest={item} onOpen={onOpen} />}
      onEndReached={() => {
        if (next.current !== null) {
          ask(next.current);
        }
      }}
      ListHeaderComponent={
        <View style={styles.titleRow}>
          <Pressable
            style={styles.back}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t("Past challenges")}
          </Text>
        </View>
      }
      ListEmptyComponent={
        status === "loading" ? null : status === "failed" ? (
          <View style={styles.failed}>
            <Text style={styles.empty} accessibilityRole="alert">
              {t("Something went wrong.")}
            </Text>
            <Pressable
              style={styles.again}
              onPress={() => {
                setStatus("loading");
                ask(null);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.againText}>{t("Try again")}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.empty}>{t("No past challenges yet.")}</Text>
        )
      }
    />
  );
}

function PastCard({
  contest,
  onOpen,
}: {
  contest: PastContest;
  onOpen?: (drawing: FeedPost) => void;
}) {
  const language = useLanguage();
  const winner = contest.winner?.drawing?.author.username ?? null;
  return (
    <View style={styles.card} testID="past-contest">
      <Text style={styles.cardTitle} accessibilityRole="header">
        {contest.theme === null
          ? t("MuW contest")
          : themeText(contest.theme, language).title}
      </Text>
      <Text style={styles.days}>
        {t("From {start} to {end}", {
          start: dayLabel(contest.starts_at),
          end: dayLabel(contest.ends_at),
        })}
      </Text>
      {winner !== null && (
        <View style={styles.winner}>
          <Text style={styles.winnerName}>{winner}</Text>
          <WinnerBadge />
        </View>
      )}
      {contest.top.length > 0 && (
        <View style={styles.top}>
          {contest.top.map((entry) => (
            <TopRow key={entry.drawing.id} entry={entry} onOpen={onOpen} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: color.background,
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  card: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  cardTitle: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.bold,
  },
  days: {
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  winner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  winnerName: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  top: {
    gap: space.xs,
  },
  failed: {
    gap: space.sm,
  },
  empty: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  again: {
    alignSelf: "flex-start",
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  againText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textDecorationLine: "underline",
  },
});
