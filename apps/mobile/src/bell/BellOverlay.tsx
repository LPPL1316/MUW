import type { NotificationLine } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accountProblem, sessionEnded } from "../account/messages";
import { fetchNotifications, readNotifications } from "../api/notificationList";
import { personPhotoUri } from "../api/people";
import { t } from "../i18n";
import { listWhen } from "../messages/messageTime";
import { tapTarget } from "../notifications/notificationTap";
import { type Opens, openTarget } from "../notifications/openTarget";
import { Avatar } from "../profile/Avatar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Cascade } from "../ui/Cascade";
import { useBell } from "./bellDoor";

const PHOTO_SIDE = 44;

type List =
  | { kind: "ready"; lines: NotificationLine[]; before: number | null }
  | { kind: "failed"; problem: string };

type Props = {
  /** What a line opens: the doors a touched push opens. */
  opens: Opens;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The bell's list over the app (TASK-367 part C, ADR-0311), as «Messages»
 * over the app is: «←» and «Notifications», then the lines, the newest
 * first, each with who acted, the push's words and when. An unread line is
 * bolder. Once the first page is on screen it is read up to its newest
 * line. A touch closes the list and opens what the push opens.
 */
export function BellOverlay({ opens, fetchFn, apiKey }: Props) {
  const { shown } = useBell();
  return shown ? <BellList opens={opens} fetchFn={fetchFn} apiKey={apiKey} /> : null;
}

function BellList({ opens, fetchFn, apiKey }: Props) {
  const insets = useSafeAreaInsets();
  const { apiUrl, account, close, read } = useBell();
  const token =
    account?.state.status === "signedIn" ? account.state.session.token : null;
  const [list, setList] = useState<List | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const options = { fetchFn, key: apiKey };

  useEffect(() => {
    if (apiUrl === null || token === null) {
      return;
    }
    let live = true;
    void fetchNotifications(apiUrl, token, null, { fetchFn, key: apiKey }).then(
      (outcome) => {
        if (!live) {
          return;
        }
        if (outcome.kind !== "ok") {
          if (sessionEnded(outcome)) {
            account?.sessionEnded(token);
          }
          setList({ kind: "failed", problem: accountProblem(outcome) });
          return;
        }
        const { notifications, before } = outcome.value;
        setList({ kind: "ready", lines: notifications, before });
        const newest = notifications[0];
        if (outcome.value.unread > 0 && newest !== undefined) {
          read();
          void readNotifications(apiUrl, token, newest.id, { fetchFn, key: apiKey });
        }
      },
    );
    return () => {
      live = false;
    };
    // Asked once as the list opens: the account's doors change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, token]);

  function loadMore() {
    if (
      list?.kind !== "ready" ||
      list.before === null ||
      apiUrl === null ||
      token === null
    ) {
      return;
    }
    setLoadingMore(true);
    void fetchNotifications(apiUrl, token, list.before, options).then((outcome) => {
      setLoadingMore(false);
      if (outcome.kind === "ok") {
        setList((was) =>
          was?.kind === "ready"
            ? {
                kind: "ready",
                lines: [...was.lines, ...outcome.value.notifications],
                before: outcome.value.before,
              }
            : was,
        );
      }
    });
  }

  function touch(line: NotificationLine) {
    const target = tapTarget(line.opens);
    if (target === null) {
      return;
    }
    close();
    openTarget(target, opens);
  }

  const now = new Date();
  return (
    <View style={[StyleSheet.absoluteFill, styles.screen]} testID="bell-list">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.lg,
            paddingBottom: insets.bottom + space.xl,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Pressable
            style={styles.back}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("Back")}
          >
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            {t("Notifications")}
          </Text>
        </View>
        {list === null && <Text style={styles.note}>{t("Loading…")}</Text>}
        {list?.kind === "failed" && <Text style={styles.problem}>{list.problem}</Text>}
        {list?.kind === "ready" && list.lines.length === 0 && (
          <Text style={styles.note}>
            {t(
              "No notifications yet. Reactions, comments, follows and tags will show up here.",
            )}
          </Text>
        )}
        {list?.kind === "ready" && (
          <View style={styles.lines}>
            {list.lines.map((line, index) => (
              <Cascade key={line.id} index={index}>
                <Line line={line} now={now} onPress={() => touch(line)} />
              </Cascade>
            ))}
          </View>
        )}
        {list?.kind === "ready" && list.before !== null && (
          <Pressable
            style={({ pressed }) => [
              styles.more,
              (pressed || loadingMore) && styles.pressed,
            ]}
            onPress={loadMore}
            disabled={loadingMore}
            accessibilityRole="button"
          >
            <Text style={styles.moreText}>{t("Show more")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Line({
  line,
  now,
  onPress,
}: {
  line: NotificationLine;
  now: Date;
  onPress: () => void;
}) {
  const when = listWhen(line.at, now);
  const opens = tapTarget(line.opens) !== null;
  return (
    <Pressable
      style={({ pressed }) => [styles.line, pressed && opens && styles.pressed]}
      onPress={onPress}
      disabled={!opens}
      accessibilityRole={opens ? "button" : "text"}
      accessibilityLabel={when === "" ? line.text : `${line.text}, ${when}`}
      testID={`bell-line-${line.id}`}
    >
      <Avatar
        name={line.actor.username}
        size={PHOTO_SIDE}
        photo={personPhotoUri(line.actor)}
      />
      <Text style={[styles.text, !line.read && styles.textNew]}>
        {line.text}
        <Text style={styles.when}>{when === "" ? "" : `  ${when}`}</Text>
      </Text>
      {!line.read && <View style={styles.dot} testID="bell-line-unread" />}
    </Pressable>
  );
}

// As «Messages» over the app (MessagesOverlay.tsx, ConversationList.tsx).
const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: space.lg,
    gap: space.xl,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  back: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  backText: {
    color: color.text,
    fontSize: fontSize.title,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  lines: {
    gap: space.sm,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  text: {
    flex: 1,
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  textNew: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  when: {
    color: color.textMuted,
    fontSize: fontSize.detail,
    fontWeight: fontWeight.regular,
  },
  dot: {
    width: space.sm + space.xs / 2,
    height: space.sm + space.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
    paddingVertical: space.lg,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  more: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.6,
  },
});
