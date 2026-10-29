import {
  MESSAGE_VIDEO_MAX_BYTES,
  MESSAGE_VIDEO_MAX_S,
  type ConversationState,
  type Message,
  type MessageAttachment,
  type MessageDrawing,
  type MessagesPage,
  type Person,
} from "@shaperoute/shared-types";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { putPoster, uploadMedia, type Upload } from "../api/messageMedia";
import {
  acceptConversation,
  fetchMessageDrawing,
  clearConversation,
  fetchMessages,
  messageProblem,
  messageTextProblem,
  readConversation,
  sendMessage,
} from "../api/messages";
import { personPhotoUri } from "../api/people";
import { useFavoritesDoor } from "../favorites/favoritesDoor";
import { t } from "../i18n";
import { Avatar } from "../profile/Avatar";
import { ReportMenu } from "../social/ReportMenu";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { type AttachKind, AttachButton, type FileKind } from "./AttachButton";
import { AttachmentPreview, type DraftStatus } from "./AttachmentPreview";
import { attachmentLabel } from "./attachmentText";
import { DrawingPicker } from "./DrawingPicker";
import { favoriteOfMessage } from "./messageDrawing";
import { MediaViewer } from "./MediaViewer";
import { MessageMedia } from "./MessageMedia";
import { MessageSheet, type SheetFor } from "./MessageSheet";
import { useMessagesDoor } from "./messagesDoor";
import { type MessageFile, pickMessageFile } from "./pickMessageMedia";
import { VideoPoster } from "./VideoPoster";

/** How often an open conversation is read again: a reply within seconds. */
export const CONVERSATION_EVERY_MS = 5_000;

/** The side of the other's picture in the title. */
const PHOTO_SIDE = 36;

/** What the screen has of the conversation, for one account and member. */
type Held = {
  asked: string;
  person: Person;
  state: ConversationState;
  /** The latest first, as the API gives them. */
  messages: Message[];
  next: string | null;
  /** What may be attached now (TASK-333): nothing in a request, nothing
   * on a server before the attachments, no video while it is full. */
  files: AttachKind[];
};

/** A photo or a video chosen, until its message is sent. */
type Draft = {
  file: MessageFile;
  text: string;
  status: DraftStatus;
  /** Kept by the API already: a try again sends the message only. */
  mediaId: string | null;
};

/** A video's first picture, made while the text is written: its JPEG in
 * the cache, or null without one. */
type Poster = { promise: Promise<string | null>; done: (uri: string | null) => void };

function posterToCome(): Poster {
  let done: (uri: string | null) => void = () => {};
  const promise = new Promise<string | null>((resolve) => {
    done = resolve;
  });
  return { promise, done };
}

/** Why a photo or a video did not go, when the API says more than «try
 * again»; null for the rest. */
export function fileProblem(
  outcome: AccountOutcome<unknown>,
  kind: FileKind,
): string | null {
  if (outcome.kind !== "api_error") {
    return null;
  }
  switch (outcome.code) {
    case "too_many_requests":
      return kind === "video"
        ? t("Too many videos today. Try again tomorrow.")
        : t("Too many photos today. Try again tomorrow.");
    // The server's room for videos is full (507).
    case "http_error":
      return t("Videos can't be sent right now. Try again later.");
    case "invalid_request":
      return outcome.message;
  }
  return messageProblem(outcome);
}

type Shown = Held | { asked: string; problem: string };

type Props = {
  /** Who the conversation is with: from the list, a profile, a notification. */
  person: Person;
  onBack: () => void;
  /** The fake fetch of the tests, and their own time between two readings. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
  everyMs?: number;
  /** The tests' own: the library, and the files sent. */
  pick?: typeof pickMessageFile;
  upload?: Upload;
};

/** The newer messages of `page` over the ones held, the latest first. */
export function merged(held: Message[], page: Message[]): Message[] {
  if (page.length === 0) {
    return [];
  }
  const fresh = new Set(page.map((m) => m.id));
  // As times: «…:00.5Z» is after «…:00Z», though it sorts before it.
  const oldest = Date.parse(page[page.length - 1].created_at);
  // What the page covers is as the page says: a message deleted is gone.
  const older = held.filter(
    (m) => !fresh.has(m.id) && Date.parse(m.created_at) < oldest,
  );
  return [...page, ...older];
}

/**
 * One conversation (TASK-319, ADR-0279): the messages from the bottom up,
 * and under them what who reads may do, as the API's `state` says: write
 * («open»); write one message, which the other gets as a request
 * («first»); wait for the other to accept («waiting»); or answer the
 * other's request with «Accept», «Delete» or «Block» («request»). Read
 * again every few seconds while it is on screen, and marked read when the
 * other wrote. A message touched long is deleted (one's own) or reported
 * (the other's); the «…» of the title reports or blocks the member.
 */
export function ConversationScreen({
  person,
  onBack,
  fetchFn,
  apiKey,
  everyMs = CONVERSATION_EVERY_MS,
  pick = pickMessageFile,
  upload,
}: Props) {
  const { apiUrl, account, recount, close, openConversation } = useMessagesDoor();
  const favorites = useFavoritesDoor();
  const { state, sessionEnded: onSessionEnded } = account;
  const token = state.status === "signedIn" ? state.session.token : null;
  const asked = `${token ?? ""} ${person.public_id}`;
  const [shown, setShown] = useState<Shown | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetFor | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<MessageAttachment | null>(null);
  const [choosingDrawing, setChoosingDrawing] = useState(false);
  const poster = useRef<Poster | null>(null);
  // Asked to read again at once: a message refused may mean a request
  // still waiting, or a conversation gone.
  const [reads, setReads] = useState(0);
  // The newest message of the other marked read: once each.
  const readUpTo = useRef<string | null>(null);
  // Changes made here (a message sent, one deleted): a reading asked
  // before the last of them is older than the screen, and is left.
  const changed = useRef(0);
  const options = { fetchFn, key: apiKey };

  const markRead = useCallback(
    (page: MessagesPage) => {
      const theirs = page.messages.find((m) => !m.mine);
      if (
        theirs === undefined ||
        theirs.id === readUpTo.current ||
        token === null ||
        apiUrl === null
      ) {
        return;
      }
      readUpTo.current = theirs.id;
      void readConversation(apiUrl, token, person.public_id, {
        fetchFn,
        key: apiKey,
      }).then((outcome) => {
        if (outcome.kind === "ok") {
          recount();
        }
      });
    },
    [apiKey, apiUrl, fetchFn, person.public_id, recount, token],
  );

  useEffect(() => {
    if (token === null || apiUrl === null) {
      return;
    }
    let live = true;
    let onScreen = true;
    // One reading at a time: on a slow network they do not pile up.
    let reading = false;
    const read = () => {
      if (reading) {
        return;
      }
      reading = true;
      const since = changed.current;
      void fetchMessages(apiUrl, token, person.public_id, null, {
        fetchFn,
        key: apiKey,
      }).then((outcome) => {
        reading = false;
        if (!live || changed.current !== since) {
          return;
        }
        if (outcome.kind !== "ok") {
          // Without a connection what is on screen stays; gone (a block,
          // an account deleted), the screen says so.
          const gone = outcome.kind === "api_error" && outcome.code === "http_error";
          setShown((was) =>
            was !== null && "state" in was && was.asked === asked && !gone
              ? was
              : { asked, problem: messageProblem(outcome) ?? "" },
          );
          if (sessionEnded(outcome)) {
            onSessionEnded(token);
          }
          return;
        }
        const page = outcome.value;
        setShown((was) => ({
          asked,
          person: page.person,
          state: page.state,
          files: page.state === "open" ? (page.attachments?.kinds ?? []) : [],
          messages:
            was !== null && "state" in was && was.asked === asked
              ? merged(was.messages, page.messages)
              : page.messages,
          // The older pages read stay: where they end is the cursor.
          next:
            was !== null && "state" in was && was.asked === asked
              ? was.next
              : page.next,
        }));
        markRead(page);
      });
    };
    read();
    const timer = setInterval(() => {
      if (onScreen) {
        read();
      }
    }, everyMs);
    const subscription = AppState.addEventListener("change", (next) => {
      const was = onScreen;
      onScreen = next === "active";
      if (onScreen && !was) {
        read();
      }
    });
    return () => {
      live = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [
    apiKey,
    apiUrl,
    asked,
    everyMs,
    fetchFn,
    markRead,
    onSessionEnded,
    person.public_id,
    reads,
    token,
  ]);

  const held =
    shown !== null && shown.asked === asked && "state" in shown ? shown : null;
  const who = held?.person ?? person;

  function update(change: (was: Held) => Held) {
    setShown((was) =>
      was !== null && was.asked === asked && "state" in was ? change(was) : was,
    );
  }

  function failed(outcome: Parameters<typeof messageProblem>[0]) {
    setProblem(messageProblem(outcome));
    if (sessionEnded(outcome) && token !== null) {
      onSessionEnded(token);
    }
  }

  function send() {
    if (token === null || apiUrl === null || held === null) {
      return;
    }
    const wrong = messageTextProblem(text);
    if (wrong !== null) {
      setProblem(wrong);
      return;
    }
    const before = held.state;
    setSending(true);
    setProblem(null);
    void sendMessage(apiUrl, token, person.public_id, text, options).then((outcome) => {
      setSending(false);
      if (outcome.kind !== "ok") {
        // A request still waiting, or the conversation gone: the reading
        // says which, at once.
        if (outcome.kind === "api_error" && outcome.code === "http_error") {
          setReads((n) => n + 1);
          return;
        }
        failed(outcome);
        return;
      }
      setText("");
      changed.current += 1;
      const sent = outcome.value;
      update((was) => ({
        ...was,
        // The one message of a request waits; a reply accepts.
        state: before === "first" ? "waiting" : "open",
        messages: [sent, ...was.messages.filter((m) => m.id !== sent.id)],
      }));
      if (before === "request") {
        recount();
      }
    });
  }

  /** A drawing chosen in «Drawing»: it goes at once, with what was written. */
  function sendDrawing(drawing: MessageDrawing) {
    setChoosingDrawing(false);
    if (token === null || apiUrl === null) {
      return;
    }
    setSending(true);
    setProblem(null);
    void sendMessage(apiUrl, token, person.public_id, text, options, { drawing }).then(
      (outcome) => {
        setSending(false);
        if (outcome.kind !== "ok") {
          if (outcome.kind === "api_error" && outcome.code === "http_error") {
            setReads((n) => n + 1);
          }
          failed(outcome);
          return;
        }
        setText("");
        changed.current += 1;
        const sent = outcome.value;
        update((was) => ({
          ...was,
          messages: [sent, ...was.messages.filter((m) => m.id !== sent.id)],
        }));
      },
    );
  }

  /** A drawing touched: fetched whole and opened on the map, as a
   * favorite; «←» of its card comes back here. */
  function openDrawing(message: Message) {
    if (token === null || apiUrl === null) {
      return;
    }
    setProblem(null);
    void fetchMessageDrawing(apiUrl, token, message.id, options).then((outcome) => {
      if (outcome.kind !== "ok") {
        failed(outcome);
        return;
      }
      favorites.show(favoriteOfMessage(outcome.value, new Date()), () =>
        openConversation(person),
      );
      close();
    });
  }

  function choose(kind: AttachKind) {
    if (kind === "drawing") {
      setChoosingDrawing(true);
      return;
    }
    setProblem(null);
    void pick(kind).then((picked) => {
      switch (picked.kind) {
        case "picked":
          // What was written goes with it.
          setDraft({ file: picked.file, text, status: "ready", mediaId: null });
          setText("");
          poster.current = picked.file.kind === "video" ? posterToCome() : null;
          return;
        case "too_long":
          setProblem(
            t("This video is longer than {seconds} seconds. Choose a shorter one.", {
              seconds: MESSAGE_VIDEO_MAX_S,
            }),
          );
          return;
        case "too_large":
          setProblem(
            t("This video is too large: at most {mb} MB. Choose a shorter one.", {
              mb: MESSAGE_VIDEO_MAX_BYTES / 1_000_000,
            }),
          );
          return;
        case "pick_failed":
          setProblem(t("Could not open the picture. Try again."));
          return;
        case "cancelled":
          return;
      }
    });
  }

  function cancelDraft() {
    setDraft(null);
    poster.current = null;
  }

  /** The file first, its first picture if a video, then the message. */
  async function sendDraft() {
    if (token === null || apiUrl === null || held === null || draft === null) {
      return;
    }
    const { file } = draft;
    setDraft({ ...draft, status: "sending" });
    setProblem(null);
    const fail = (outcome: AccountOutcome<unknown>, mediaId: string | null) => {
      setDraft((was) => (was === null ? was : { ...was, status: "failed", mediaId }));
      setProblem(fileProblem(outcome, file.kind));
      if (sessionEnded(outcome)) {
        onSessionEnded(token);
      }
    };
    let mediaId = draft.mediaId;
    if (mediaId === null) {
      const kept = await uploadMedia(apiUrl, token, file.uri, file.mimeType, {
        key: apiKey,
        upload,
      });
      if (kept.kind !== "ok") {
        fail(kept, null);
        return;
      }
      mediaId = kept.value.id;
      const first = await poster.current?.promise;
      if (first) {
        // Without it the video still goes, as a dark square.
        await putPoster(apiUrl, token, mediaId, first, { key: apiKey, upload });
      }
    }
    const outcome = await sendMessage(
      apiUrl,
      token,
      person.public_id,
      draft.text,
      options,
      { media_id: mediaId },
    );
    if (outcome.kind !== "ok") {
      if (outcome.kind === "api_error" && outcome.code === "http_error") {
        // No longer open (a block, a request): the reading says so.
        setReads((n) => n + 1);
      }
      fail(outcome, mediaId);
      return;
    }
    cancelDraft();
    changed.current += 1;
    const sent = outcome.value;
    update((was) => ({
      ...was,
      messages: [sent, ...was.messages.filter((m) => m.id !== sent.id)],
    }));
  }

  function accept() {
    if (token === null || apiUrl === null) {
      return;
    }
    setBusy(true);
    setProblem(null);
    void acceptConversation(apiUrl, token, person.public_id, options).then(
      (outcome) => {
        setBusy(false);
        if (outcome.kind !== "ok") {
          failed(outcome);
          return;
        }
        update((was) => ({ ...was, state: "open" }));
        recount();
      },
    );
  }

  function remove() {
    if (token === null || apiUrl === null) {
      return;
    }
    setBusy(true);
    setProblem(null);
    void clearConversation(apiUrl, token, person.public_id, options).then((outcome) => {
      setBusy(false);
      if (outcome.kind !== "ok") {
        failed(outcome);
        return;
      }
      recount();
      onBack();
    });
  }

  function loadOlder() {
    if (token === null || apiUrl === null || held === null || held.next === null) {
      return;
    }
    setLoadingOlder(true);
    void fetchMessages(apiUrl, token, person.public_id, held.next, options).then(
      (outcome) => {
        setLoadingOlder(false);
        if (outcome.kind !== "ok") {
          return;
        }
        const page = outcome.value;
        update((was) => {
          const seen = new Set(was.messages.map((m) => m.id));
          return {
            ...was,
            messages: [
              ...was.messages,
              ...page.messages.filter((m) => !seen.has(m.id)),
            ],
            next: page.next,
          };
        });
      },
    );
  }

  function blocked() {
    recount();
    onBack();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.titleRow}>
        <Pressable
          style={styles.back}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t("Back")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Avatar name={who.username} size={PHOTO_SIDE} photo={personPhotoUri(who)} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {who.username}
        </Text>
        {token !== null && apiUrl !== null && held !== null && (
          <ReportMenu
            apiUrl={apiUrl}
            token={token}
            target={{ kind: "user", id: who.public_id }}
            person={who}
            onBlocked={blocked}
            onSessionEnded={onSessionEnded}
            fetchFn={fetchFn}
            apiKey={apiKey}
          />
        )}
      </View>
      {shown === null || shown.asked !== asked ? (
        <Text style={styles.note}>{t("Loading…")}</Text>
      ) : !("state" in shown) ? (
        <Text style={[styles.note, styles.problemText]}>{shown.problem}</Text>
      ) : (
        <>
          {shown.messages.length === 0 ? (
            // Outside the list: an inverted list shows its empty part upside down.
            <View style={styles.messages}>
              {shown.state === "open" && (
                <Text style={styles.note}>{t("No messages yet.")}</Text>
              )}
            </View>
          ) : (
            <FlatList
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              data={shown.messages}
              keyExtractor={(m) => m.id}
              // The latest at the bottom, where the box is.
              inverted
              renderItem={({ item }) => (
                <Bubble
                  message={item}
                  media={
                    item.attachment && token !== null && apiUrl !== null ? (
                      <MessageMedia
                        attachment={item.attachment}
                        apiUrl={apiUrl}
                        token={token}
                        apiKey={apiKey}
                      />
                    ) : null
                  }
                  onOpen={
                    item.attachment?.kind === "drawing"
                      ? () => openDrawing(item)
                      : item.attachment && item.attachment.media_id !== null
                        ? () => setViewing(item.attachment ?? null)
                        : null
                  }
                  onLongPress={() => setSheet({ kind: "message", message: item })}
                />
              )}
              ListFooterComponent={
                shown.next !== null ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.older,
                      (pressed || loadingOlder) && styles.pressed,
                    ]}
                    onPress={loadOlder}
                    disabled={loadingOlder}
                    accessibilityRole="button"
                  >
                    <Text style={styles.olderText}>{t("Show earlier messages")}</Text>
                  </Pressable>
                ) : null
              }
            />
          )}
          {problem !== null && (
            <Text style={styles.problemText} accessibilityRole="alert">
              {problem}
            </Text>
          )}
          {draft !== null && shown.state === "open" ? (
            <AttachmentPreview
              file={draft.file}
              text={draft.text}
              status={draft.status}
              onText={(words) =>
                setDraft((was) => (was === null ? was : { ...was, text: words }))
              }
              onSend={() => void sendDraft()}
              onCancel={cancelDraft}
            />
          ) : (
            <Foot
              state={shown.state}
              name={who.username}
              text={text}
              sending={sending}
              busy={busy}
              files={shown.files}
              onText={setText}
              onSend={send}
              onAttach={choose}
              onAccept={accept}
              onDelete={remove}
              onBlock={() => setSheet({ kind: "block", person: who })}
            />
          )}
        </>
      )}
      {draft !== null && draft.file.kind === "video" && draft.mediaId === null && (
        <VideoPoster
          key={draft.file.uri}
          videoUri={draft.file.uri}
          onPoster={(uri) => poster.current?.done(uri)}
        />
      )}
      {choosingDrawing && token !== null && apiUrl !== null && (
        <DrawingPicker
          apiUrl={apiUrl}
          token={token}
          onPick={sendDrawing}
          onClose={() => setChoosingDrawing(false)}
          fetchFn={fetchFn}
          apiKey={apiKey}
        />
      )}
      {viewing !== null && token !== null && apiUrl !== null && (
        <MediaViewer
          attachment={viewing}
          apiUrl={apiUrl}
          token={token}
          apiKey={apiKey}
          onClose={() => setViewing(null)}
        />
      )}
      {sheet !== null && token !== null && apiUrl !== null && (
        <MessageSheet
          apiUrl={apiUrl}
          token={token}
          about={sheet}
          onDeleted={(message) => {
            changed.current += 1;
            update((was) => ({
              ...was,
              messages: was.messages.filter((m) => m.id !== message.id),
            }));
          }}
          onBlocked={blocked}
          onClose={() => setSheet(null)}
          onSessionEnded={onSessionEnded}
          fetchFn={fetchFn}
          apiKey={apiKey}
        />
      )}
    </View>
  );
}

function Bubble({
  message,
  media,
  onOpen,
  onLongPress,
}: {
  message: Message;
  /** What it carries (TASK-333), above its text. */
  media: ReactNode;
  /** A photo or a video: opened on the whole screen. */
  onOpen: (() => void) | null;
  onLongPress: () => void;
}) {
  const words = [
    message.attachment ? attachmentLabel(message.attachment) : "",
    message.text,
  ]
    .filter((part) => part !== "")
    .join(", ");
  return (
    <Pressable
      style={({ pressed }) => [
        styles.bubble,
        message.mine ? styles.mine : styles.theirs,
        pressed && styles.pressed,
      ]}
      onPress={onOpen ?? undefined}
      onLongPress={onLongPress}
      accessibilityRole={onOpen === null ? "text" : "button"}
      accessibilityLabel={message.mine ? t("You: {text}", { text: words }) : words}
      accessibilityHint={
        message.mine
          ? t("Touch and hold to delete it")
          : t("Touch and hold to report it")
      }
      accessibilityActions={[{ name: "longpress" }]}
      onAccessibilityAction={onLongPress}
    >
      {media}
      {message.text !== "" && <Text style={styles.bubbleText}>{message.text}</Text>}
    </Pressable>
  );
}

type FootProps = {
  state: ConversationState;
  name: string;
  text: string;
  sending: boolean;
  busy: boolean;
  files: AttachKind[];
  onText: (text: string) => void;
  onSend: () => void;
  onAttach: (kind: AttachKind) => void;
  onAccept: () => void;
  onDelete: () => void;
  onBlock: () => void;
};

/** Under the messages: the box, the wait, or the answers to a request. */
function Foot({
  state,
  name,
  text,
  sending,
  busy,
  files,
  onText,
  onSend,
  onAttach,
  onAccept,
  onDelete,
  onBlock,
}: FootProps) {
  if (state === "waiting") {
    return (
      <Text style={styles.hint}>
        {t("Message request sent. You can write again when {name} accepts it.", {
          name,
        })}
      </Text>
    );
  }
  if (state === "request") {
    return (
      <View style={styles.request}>
        <Text style={styles.hint}>
          {t("{name} wants to send you a message.", { name })}
        </Text>
        <View style={styles.answers}>
          <Answer label={t("Accept")} onPress={onAccept} disabled={busy} />
          <Answer label={t("Delete")} onPress={onDelete} disabled={busy} />
          <Answer label={t("Block")} onPress={onBlock} disabled={busy} danger />
        </View>
      </View>
    );
  }
  const empty = text.trim() === "";
  return (
    <View style={styles.foot}>
      {state === "first" && (
        <Text style={styles.hint}>
          {t(
            "{name} gets this as a message request. You can send one message until they accept it.",
            { name },
          )}
        </Text>
      )}
      <View style={styles.box}>
        {state === "open" && (
          <AttachButton kinds={files} disabled={sending} onPick={onAttach} />
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onText}
          placeholder={t("Write a message…")}
          placeholderTextColor={color.textFaint}
          multiline
          editable={!sending}
          accessibilityLabel={t("Message")}
        />
        <Pressable
          style={({ pressed }) => [
            styles.send,
            (pressed || sending || empty) && styles.pressed,
          ]}
          onPress={onSend}
          disabled={sending || empty}
          accessibilityRole="button"
          accessibilityState={{ disabled: sending || empty }}
        >
          <Text style={styles.sendText}>{sending ? t("Sending…") : t("Send")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Answer({
  label,
  onPress,
  disabled,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.answer, (pressed || disabled) && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.answerText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: space.md,
  },
  // As the title of «Find friends» (PeopleScreen.tsx).
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
    flex: 1,
    color: color.text,
    fontSize: fontSize.input + space.xs,
    fontWeight: fontWeight.bold,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    gap: space.sm,
    paddingVertical: space.sm,
  },
  // Neutral, both: the yellow belongs to the route.
  bubble: {
    maxWidth: "80%",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: color.surfaceRaised,
  },
  theirs: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  bubbleText: {
    color: color.text,
    fontSize: fontSize.body,
  },
  older: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  olderText: {
    color: color.textMuted,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  note: {
    color: color.textMuted,
    fontSize: fontSize.body,
    textAlign: "center",
    paddingVertical: space.lg,
  },
  problemText: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
  },
  hint: {
    color: color.textMuted,
    fontSize: fontSize.small,
    textAlign: "center",
  },
  foot: {
    gap: space.sm,
  },
  box: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
  },
  input: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    maxHeight: MIN_TAP_SIZE * 3,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
    color: color.text,
    fontSize: fontSize.input,
  },
  send: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  sendText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  request: {
    gap: space.md,
  },
  answers: {
    flexDirection: "row",
    gap: space.sm,
  },
  answer: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  answerText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  danger: {
    color: color.error,
  },
  pressed: {
    opacity: 0.6,
  },
});
