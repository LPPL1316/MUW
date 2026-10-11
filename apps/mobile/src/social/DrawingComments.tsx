import { type Comment, COMMENT_MAX_LENGTH } from "@shaperoute/shared-types";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { commentOf, commentTextProblem } from "../api/comments";
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
import { useCommentChoices } from "./commentChoices";
import { useCommentsDoor } from "./commentsDoor";
import { agoLabel, commentsLabel, negativeComment } from "./commentText";
import {
  type DrawingComments as Shown,
  useDrawingComments,
} from "./useDrawingComments";

/** How much of the screen the sheet takes, before the keyboard. */
const SHEET_SHARE = 0.72;
const AVATAR_SIDE = 32;
// The count shows from here, so the limit never comes as a surprise.
const COUNT_FROM = COMMENT_MAX_LENGTH - 50;

/** What a comment can be asked for, held or with VoiceOver's actions. */
type CommentAction = "report" | "block" | "delete";

type Props = {
  drawingId: string;
};

/**
 * Under a drawing on the map (TASK-120): a button with how many comments it
 * has, that opens them in a sheet over the map. Without an account, or on
 * an API without comments, nothing.
 */
export function DrawingComments({ drawingId }: Props) {
  const comments = useDrawingComments(drawingId);
  const [open, setOpen] = useState(false);
  if (comments.status === "off") {
    return null;
  }
  return (
    <>
      <Pressable
        style={styles.button}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityHint={t("Opens the comments of this drawing.")}
      >
        <Text style={styles.buttonText}>
          {comments.status === "ready" ? commentsLabel(comments.total) : t("Comments")}
        </Text>
      </Pressable>
      <CommentsSheet
        visible={open}
        comments={comments}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

type SheetProps = {
  visible: boolean;
  comments: Shown;
  onClose: () => void;
};

/** The comments, the oldest first, and the field to write one, over the keyboard. */
export function CommentsSheet({ visible, comments, onClose }: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const typing = useKeyboardShown();
  const [text, setText] = useState("");
  const list = useRef<FlatList<Comment>>(null);
  const length = [...commentOf(text)].length;
  const tooLong = length > COMMENT_MAX_LENGTH;
  const canSend = !comments.sending && commentTextProblem(text) === null;
  const choices = useCommentChoices();
  const me = choices?.me ?? null;

  async function onSend() {
    if (!canSend) {
      return;
    }
    const sent = await comments.send(text);
    if (sent === "sent") {
      setText("");
      list.current?.scrollToEnd({ animated: true });
    } else if (sent === "rejected") {
      Alert.alert(negativeComment());
    }
  }

  function askDelete(comment: Comment) {
    Alert.alert(t("Delete this comment?"), undefined, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: () => comments.remove(comment.id),
      },
    ]);
  }

  function onAction(comment: Comment, action: CommentAction) {
    if (action === "delete") {
      askDelete(comment);
    } else if (action === "report") {
      choices?.report(comment);
    } else {
      // Their comments leave the sheet with the page asked again.
      choices?.block(comment, comments.reload);
    }
  }

  // Another's comment (TASK-275): «Report», «Block» its author, and «Delete»
  // too under one's own drawing. One's own: «Delete» straight away.
  function onHold(comment: Comment) {
    const actions = actionsOf(comment, me);
    if (actions.length === 1 && actions[0] === "delete") {
      askDelete(comment);
    } else if (actions.length > 0) {
      Alert.alert(t("Report or block"), undefined, [
        ...actions.map((action) => ({
          text: actionLabel(comment, action),
          style: action === "report" ? ("default" as const) : ("destructive" as const),
          onPress: () => onAction(comment, action),
        })),
        { text: t("Cancel"), style: "cancel" },
      ]);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* A tap over the sheet closes it, as its «Close». */}
        <Pressable
          style={[styles.backdrop, { minHeight: insets.top + space.xl }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("Close the comments")}
        />
        <View
          style={[
            styles.sheet,
            {
              height: Math.round(height * SHEET_SHARE),
              paddingBottom: (typing ? 0 : insets.bottom) + space.sm,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t("Comments")}
            </Text>
            <Pressable
              style={styles.close}
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>{t("Close")}</Text>
            </Pressable>
          </View>
          <CommentsList
            comments={comments}
            list={list}
            me={me}
            onHold={onHold}
            onAction={onAction}
          />
          {comments.sendProblem !== null && (
            <Text style={styles.problem} accessibilityLiveRegion="polite">
              {comments.sendProblem}
            </Text>
          )}
          <View style={styles.writeRow}>
            <TextInput
              style={styles.field}
              value={text}
              onChangeText={setText}
              placeholder={t("Add a comment…")}
              placeholderTextColor={color.textFaint}
              accessibilityLabel={t("Comment")}
              multiline
              keyboardAppearance="dark"
              editable={!comments.sending}
            />
            <Pressable
              style={[styles.send, !canSend && styles.sendOff]}
              onPress={onSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend, busy: comments.sending }}
            >
              <Text style={styles.sendText}>{t("Post")}</Text>
            </Pressable>
          </View>
          {length >= COUNT_FROM && (
            <Text
              style={[styles.count, tooLong && styles.countOver]}
              accessibilityLabel={t("{count} of {max} characters", {
                count: length,
                max: COMMENT_MAX_LENGTH,
              })}
            >
              {length}/{COMMENT_MAX_LENGTH}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** What `comment` offers to `me`: «Report» and «Block» if another wrote it,
 * «Delete» if the API says it can go. */
function actionsOf(comment: Comment, me: string | null): CommentAction[] {
  const another = me !== null && comment.author.public_id !== me;
  return [
    ...(another ? (["report", "block"] as const) : []),
    ...(comment.deletable ? (["delete"] as const) : []),
  ];
}

function actionLabel(comment: Comment, action: CommentAction): string {
  if (action === "report") {
    return t("Report");
  }
  if (action === "block") {
    return t("Block {user}", { user: comment.author.username });
  }
  return t("Delete");
}

type ListProps = {
  comments: Shown;
  list: RefObject<FlatList<Comment> | null>;
  /** The account signed in; null when nothing can be reported (`actionsOf`). */
  me: string | null;
  onHold: (comment: Comment) => void;
  onAction: (comment: Comment, action: CommentAction) => void;
};

function CommentsList({ comments, list, me, onHold, onAction }: ListProps) {
  if (comments.status === "loading") {
    return (
      <View style={styles.middle}>
        <ActivityIndicator color={color.textMuted} />
        <Text style={styles.muted}>{t("Loading the comments…")}</Text>
      </View>
    );
  }
  if (comments.status === "failed") {
    return (
      <View style={styles.middle}>
        <Text style={styles.problem}>{comments.problem}</Text>
        <Pressable
          style={styles.again}
          onPress={comments.reload}
          accessibilityRole="button"
        >
          <Text style={styles.closeText}>{t("Try again")}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <FlatList<Comment>
      ref={list}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={comments.comments}
      keyExtractor={(comment) => comment.id}
      renderItem={({ item }) => (
        <CommentRow comment={item} me={me} onHold={onHold} onAction={onAction} />
      )}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text style={[styles.muted, styles.empty]}>
          {t("No comments yet. Be the first.")}
        </Text>
      }
      ListFooterComponent={
        comments.more ? (
          <Pressable
            style={styles.more}
            onPress={comments.showMore}
            accessibilityRole="button"
          >
            <Text style={styles.closeText}>{t("Show more comments")}</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

type RowProps = {
  comment: Comment;
  me: string | null;
  onHold: (comment: Comment) => void;
  onAction: (comment: Comment, action: CommentAction) => void;
};

/** One comment: who, how long ago, and the words, always as plain text. */
function CommentRow({ comment, me, onHold, onAction }: RowProps) {
  const door = useCommentsDoor();
  const [photo, setPhoto] = useState<string | null>(null);
  const publicId = comment.author.public_id;
  useEffect(() => {
    let current = true;
    void door.photoOf(publicId).then((uri) => {
      if (current) {
        setPhoto(uri);
      }
    });
    return () => {
      current = false;
    };
  }, [door, publicId]);
  const ago = agoLabel(comment.created_at);
  const actions = actionsOf(comment, me);
  return (
    <Pressable
      style={styles.row}
      onLongPress={() => onHold(comment)}
      accessible
      accessibilityLabel={t("{name}, {ago}: {text}", {
        name: comment.author.username,
        ago,
        text: comment.text,
      })}
      accessibilityHint={
        actions.includes("report")
          ? t("Report or block")
          : comment.deletable
            ? t("Touch and hold to delete.")
            : undefined
      }
      // VoiceOver has no long press: the same choices as actions.
      accessibilityActions={actions.map((action) => ({
        name: action,
        label: actionLabel(comment, action),
      }))}
      onAccessibilityAction={(event) => {
        const asked = actions.find((action) => action === event.nativeEvent.actionName);
        if (asked !== undefined) {
          onAction(comment, asked);
        }
      }}
    >
      <Avatar name={comment.author.username} size={AVATAR_SIDE} photo={photo} />
      <View style={styles.words}>
        <Text style={styles.who}>
          {comment.author.username}
          <Text style={styles.ago}>{`  ${ago}`}</Text>
        </Text>
        <Text style={styles.text}>{comment.text}</Text>
      </View>
    </Pressable>
  );
}

/** True while the keyboard is up: the sheet's bottom is then its top. */
function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    // iOS says it before it moves, Android only after.
    const ios = Platform.OS === "ios";
    const up = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () =>
      setShown(true),
    );
    const down = Keyboard.addListener(
      ios ? "keyboardWillHide" : "keyboardDidHide",
      () => setShown(false),
    );
    return () => {
      up.remove();
      down.remove();
    };
  }, []);
  return shown;
}

// Neutral, as every control that is not the route's (docs/UI.md, «Il tema»).
const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  fill: {
    flex: 1,
  },
  backdrop: {
    flexGrow: 1,
  },
  sheet: {
    flexShrink: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
  },
  close: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.sm,
  },
  closeText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  middle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: space.md,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
  },
  words: {
    flex: 1,
    gap: 2,
  },
  who: {
    color: color.text,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  ago: {
    color: color.textMuted,
    fontWeight: fontWeight.regular,
  },
  text: {
    color: color.text,
    fontSize: fontSize.body,
  },
  muted: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  empty: {
    paddingVertical: space.xl,
    textAlign: "center",
  },
  more: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  again: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  problem: {
    color: color.error,
    fontSize: fontSize.small,
  },
  writeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
  },
  field: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.background,
    color: color.text,
    fontSize: fontSize.input,
  },
  send: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  sendOff: {
    opacity: 0.4,
  },
  sendText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  count: {
    alignSelf: "flex-end",
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
  countOver: {
    color: color.error,
  },
});
