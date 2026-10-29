import type { MessageDrawing, Person } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchFollowList } from "../api/follows";
import { fetchConversations, messageProblem, sendMessage } from "../api/messages";
import { findPeople, personPhotoUri, searchable } from "../api/people";
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
import { useMessagesDoor } from "./messagesDoor";

/** The side of a member's picture in the list. */
const PHOTO_SIDE = 36;
/** The API's words for a conversation not open to who sends (messages.py:
 * ATTACHMENT_IN_REQUEST, WAITING). */
const CLOSED = ["Photos, videos and drawings", "Your message request is waiting"];

type Props = {
  drawing: MessageDrawing;
  onClose: () => void;
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** Who wrote last first, then who one follows, each once. */
export function peopleOf(talking: Person[], following: Person[]): Person[] {
  const seen = new Set<string>();
  return [...talking, ...following].filter((person) => {
    if (seen.has(person.public_id)) {
      return false;
    }
    seen.add(person.public_id);
    return true;
  });
}

type Said = { kind: "sent" | "problem"; text: string };

/**
 * «Send to a friend» (TASK-333, the user's choice 5): the people one writes
 * to, then those one follows, or anyone found by name; a tap sends the
 * drawing as a message of its own. One who has not accepted a message
 * request gets nothing: a request is text only (the user's choice 1).
 */
export function SendToFriend({ drawing, onClose, fetchFn, apiKey }: Props) {
  const insets = useSafeAreaInsets();
  const { apiUrl, account } = useMessagesDoor();
  const token =
    account.state.status === "signedIn" ? account.state.session.token : null;
  const options = { fetchFn, key: apiKey };
  const [near, setNear] = useState<Person[] | null>(null);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [said, setSaid] = useState<Said | null>(null);

  useEffect(() => {
    if (apiUrl === null || token === null) {
      return;
    }
    let live = true;
    const asked = { fetchFn, key: apiKey };
    void Promise.all([
      fetchConversations(apiUrl, token, "inbox", null, asked),
      fetchFollowList(apiUrl, token, "following", null, asked),
    ]).then(([talking, following]) => {
      if (!live) {
        return;
      }
      setNear(
        peopleOf(
          talking.kind === "ok" ? talking.value.conversations.map((c) => c.person) : [],
          following.kind === "ok" ? following.value.people : [],
        ),
      );
    });
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, fetchFn, token]);

  useEffect(() => {
    if (apiUrl === null || token === null || !searchable(typed)) {
      return;
    }
    let live = true;
    void findPeople(apiUrl, token, typed, { fetchFn, key: apiKey }).then((outcome) => {
      if (live) {
        setFound(outcome.kind === "ok" ? outcome.value.people : []);
      }
    });
    return () => {
      live = false;
    };
  }, [apiKey, apiUrl, fetchFn, token, typed]);

  function send(person: Person) {
    if (apiUrl === null || token === null) {
      return;
    }
    setSending(person.public_id);
    setSaid(null);
    void sendMessage(apiUrl, token, person.public_id, "", options, { drawing }).then(
      (outcome) => {
        setSending(null);
        if (outcome.kind === "ok") {
          setSaid({
            kind: "sent",
            text: t("Sent to {name}.", { name: person.username }),
          });
          return;
        }
        // 409: no conversation open with them yet, or one's request still
        // waiting: a request is text only.
        const closed =
          outcome.kind === "api_error" &&
          outcome.code === "http_error" &&
          CLOSED.some((start) => outcome.message.startsWith(start));
        setSaid({
          kind: "problem",
          text: closed
            ? t(
                "Photos, videos and drawings can be sent once {name} accepts your message.",
                { name: person.username },
              )
            : (messageProblem(outcome) ?? ""),
        });
      },
    );
  }

  const shown = searchable(typed) ? (found ?? []) : (near ?? []);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Send to…")}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>{t("Close")}</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          value={typed}
          onChangeText={setTyped}
          placeholder={t("Search people")}
          placeholderTextColor={color.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t("Search people")}
        />
        {said !== null && (
          <Text
            style={said.kind === "sent" ? styles.sent : styles.problem}
            accessibilityRole="alert"
          >
            {said.text}
          </Text>
        )}
        {near === null && !searchable(typed) ? (
          <Text style={styles.note}>{t("Loading…")}</Text>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(person) => person.public_id}
            contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.person,
                  (pressed || sending === item.public_id) && styles.pressed,
                ]}
                onPress={() => send(item)}
                disabled={sending !== null}
                accessibilityRole="button"
                accessibilityLabel={item.username}
                accessibilityState={{ disabled: sending !== null }}
              >
                <Avatar
                  name={item.username}
                  size={PHOTO_SIDE}
                  photo={personPhotoUri(item)}
                />
                <Text style={styles.name} numberOfLines={1}>
                  {item.username}
                </Text>
                {sending === item.public_id && (
                  <Text style={styles.note}>{t("Sending…")}</Text>
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: color.background,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  title: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  close: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  closeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  search: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    color: color.text,
    fontSize: fontSize.input,
  },
  person: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  name: {
    flex: 1,
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  sent: {
    color: color.text,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
