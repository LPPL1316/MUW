import type {
  Conversation,
  ConversationBox,
  ConversationsPage,
  Person,
} from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { sessionEnded } from "../account/messages";
import { fetchConversations, messageProblem } from "../api/messages";
import { personPhotoUri } from "../api/people";
import { t } from "../i18n";
import { Avatar } from "../profile/Avatar";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { messageLine } from "./attachmentText";
import { useMessagesDoor } from "./messagesDoor";

/** The side of a member's picture in the list, as in the lists of who follows. */
const PHOTO_SIDE = 48;

/** What the list has of a box. */
type Shown =
  | { kind: "ready"; conversations: Conversation[]; next: string | null }
  | { kind: "failed"; problem: string };

type Props = {
  box: ConversationBox;
  /** A conversation touched: it opens over the list. */
  onOpen: (person: Person) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** The line under a name: the latest message, «You: …» when one's own. */
export function previewOf(conversation: Conversation): string {
  // A photo, a video or a drawing in words (TASK-333).
  const line = messageLine(conversation.last);
  return conversation.last.mine ? t("You: {text}", { text: line }) : line;
}

/**
 * The conversations of «Messages», or the message requests (TASK-319,
 * ADR-0279), the latest message first, each with the other's picture and
 * name, the latest message on one line and a dot when the other wrote since
 * it was read. In «Messages», «Message requests» at the top, with their
 * number. Read when it opens, and again when it comes back to the screen.
 */
export function ConversationList({ box, onOpen, fetchFn, apiKey }: Props) {
  const { apiUrl, account, unread, openList } = useMessagesDoor();
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const asked = `${token ?? ""} ${box}`;
  const [shown, setShown] = useState<{ asked: string; shown: Shown } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (token === null || apiUrl === null) {
      return;
    }
    let live = true;
    void fetchConversations(apiUrl, token, box, null, { fetchFn, key: apiKey }).then(
      (outcome) => {
        if (!live) {
          return;
        }
        setShown({
          asked,
          shown:
            outcome.kind === "ok"
              ? {
                  kind: "ready",
                  conversations: outcome.value.conversations,
                  next: outcome.value.next,
                }
              : { kind: "failed", problem: messageProblem(outcome) ?? "" },
        });
        if (sessionEnded(outcome)) {
          onSessionEnded(token);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, asked, box, fetchFn, onSessionEnded, token]);

  if (token === null || apiUrl === null) {
    return null;
  }
  const url = apiUrl;
  const own = token;
  const list = shown !== null && shown.asked === asked ? shown.shown : null;

  function loadMore() {
    if (list === null || list.kind !== "ready" || list.next === null) {
      return;
    }
    setLoadingMore(true);
    void fetchConversations(url, own, box, list.next, { fetchFn, key: apiKey }).then(
      (outcome) => {
        setLoadingMore(false);
        if (outcome.kind === "ok") {
          setShown((was) => more(was, asked, outcome.value));
        }
      },
    );
  }

  const requests = unread?.requests ?? 0;
  return (
    <View style={styles.list}>
      {box === "inbox" && (
        <Pressable
          style={({ pressed }) => [styles.requests, pressed && styles.pressed]}
          onPress={() => openList("requests")}
          accessibilityRole="button"
          accessibilityLabel={
            requests > 0
              ? t("Message requests, {count} waiting", { count: requests })
              : t("Message requests")
          }
        >
          <Text style={styles.requestsText}>{t("Message requests")}</Text>
          {requests > 0 && (
            <View style={styles.count}>
              <Text style={styles.countText}>{String(requests)}</Text>
            </View>
          )}
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      )}
      {list === null && <Text style={styles.note}>{t("Loading…")}</Text>}
      {list?.kind === "failed" && <Text style={styles.problem}>{list.problem}</Text>}
      {list?.kind === "ready" && list.conversations.length === 0 && (
        <Text style={styles.note}>
          {box === "inbox"
            ? t(
                "No messages yet. Open someone's profile and tap Message to write to them.",
              )
            : t("No message requests.")}
        </Text>
      )}
      {list?.kind === "ready" &&
        list.conversations.map((conversation) => (
          <Row
            key={conversation.person.public_id}
            conversation={conversation}
            onPress={() => onOpen(conversation.person)}
          />
        ))}
      {list?.kind === "ready" && list.next !== null && (
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
    </View>
  );
}

/** The page after, added to the list of the same account and box. */
function more(
  was: { asked: string; shown: Shown } | null,
  asked: string,
  page: ConversationsPage,
): { asked: string; shown: Shown } | null {
  if (was === null || was.asked !== asked || was.shown.kind !== "ready") {
    return was;
  }
  const seen = new Set(was.shown.conversations.map((c) => c.person.public_id));
  return {
    asked,
    shown: {
      kind: "ready",
      conversations: [
        ...was.shown.conversations,
        ...page.conversations.filter((c) => !seen.has(c.person.public_id)),
      ],
      next: page.next,
    },
  };
}

function Row({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const { person, unread } = conversation;
  const preview = previewOf(conversation);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      // One name for the whole row: who, whether it is new, and what it says.
      accessibilityLabel={
        unread
          ? t("{name}, new message: {text}", { name: person.username, text: preview })
          : `${person.username}: ${preview}`
      }
    >
      <Avatar name={person.username} size={PHOTO_SIDE} photo={personPhotoUri(person)} />
      <View style={styles.words}>
        <Text style={styles.name} numberOfLines={1}>
          {person.username}
        </Text>
        <Text style={[styles.preview, unread && styles.previewNew]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {unread && <View style={styles.dot} testID="conversation-unread" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
  },
  requests: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: MIN_TAP_SIZE,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  requestsText: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  // Someone waits for an answer: the red of the follow requests (TASK-239).
  count: {
    minWidth: space.xl,
    height: space.xl,
    paddingHorizontal: space.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.badge,
  },
  countText: {
    color: color.onBadge,
    fontSize: fontSize.small,
    fontWeight: fontWeight.bold,
  },
  arrow: {
    color: color.textMuted,
    fontSize: fontSize.title,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  words: {
    flex: 1,
    gap: space.xs / 2,
  },
  name: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  preview: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  previewNew: {
    color: color.text,
    fontWeight: fontWeight.semibold,
  },
  dot: {
    width: space.md,
    height: space.md,
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
