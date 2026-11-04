import { COMMENT_MAX_LENGTH, SUPER_LIKE_MIN_COMMENT } from "@shaperoute/shared-types";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { commentOf } from "../api/comments";
import { superLikeTextProblem } from "../api/reactions";
import { t } from "../i18n";
import { HeartBadge } from "../intro/HeartBadge";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { Tap } from "../ui/Tap";

/** The side of the Sgrava heart that comes up over the drawing. */
export const BIG_HEART_SIDE = 128;
/** How long the heart stays when it comes up alone, on a super like already left. */
export const HEART_ALONE_MS = 900;
/** The heart grows from this share of its size as it comes up. */
const HEART_FROM = 0.5;
const HEART_IN_MS = 180;
// The count shows from here, so the limit never comes as a surprise.
const COUNT_FROM = COMMENT_MAX_LENGTH - 50;

type Props = {
  visible: boolean;
  /** True while the super like and its comment are on their way. */
  sending: boolean;
  /** Why the last one did not go; null when nothing went wrong. */
  problem: string | null;
  onSend: (comment: string) => void;
  /** Closes the sheet: nothing is kept, neither the heart nor the words. */
  onCancel: () => void;
};

/**
 * The super like (TASK-119, ADR-0193): the Sgrava heart, big over the
 * drawing, and under it the comment it needs, over the keyboard. «Send» is
 * off under two characters; the heart counts only once the API has kept it
 * with its comment.
 */
export function SuperLikeSheet({ visible, sending, problem, onSend, onCancel }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Mounted with the sheet: each opening starts from an empty field. */}
      <SheetBody
        sending={sending}
        problem={problem}
        onSend={onSend}
        onCancel={onCancel}
      />
    </Modal>
  );
}

function SheetBody({ sending, problem, onSend, onCancel }: Omit<Props, "visible">) {
  const insets = useSafeAreaInsets();
  const typing = useKeyboardShown();
  const [text, setText] = useState("");
  const length = [...commentOf(text)].length;
  const tooLong = length > COMMENT_MAX_LENGTH;
  const canSend = !sending && superLikeTextProblem(text) === null;
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* A tap over the sheet closes it, as its «Cancel», which is what a
          screen reader finds. */}
      <Pressable
        style={[styles.backdrop, { paddingTop: insets.top }]}
        onPress={onCancel}
        accessible={false}
        importantForAccessibility="no"
        testID="super-like-backdrop"
      >
        <BigHeart />
      </Pressable>
      <View
        style={[
          styles.sheet,
          { paddingBottom: (typing ? 0 : insets.bottom) + space.sm },
        ]}
      >
        <Text style={styles.title} accessibilityRole="header">
          {t("Super like")}
        </Text>
        <TextInput
          style={styles.field}
          value={text}
          onChangeText={setText}
          placeholder={t("Write a comment to send your super like")}
          placeholderTextColor={color.textFaint}
          accessibilityLabel={t("Comment")}
          accessibilityHint={t("Write a comment to send your super like")}
          multiline
          autoFocus
          keyboardAppearance="dark"
          editable={!sending}
        />
        <View style={styles.under}>
          {problem !== null ? (
            <Text style={styles.problem} accessibilityLiveRegion="polite">
              {problem}
            </Text>
          ) : (
            <Text style={styles.muted}>
              {length < SUPER_LIKE_MIN_COMMENT ? t("At least 2 characters") : ""}
            </Text>
          )}
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
        <View style={styles.buttons}>
          <Tap style={styles.button} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.buttonText}>{t("Cancel")}</Text>
          </Tap>
          <Tap
            style={[styles.button, !canSend && styles.buttonOff]}
            onPress={() => onSend(text)}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend, busy: sending }}
          >
            <Text style={styles.buttonText}>{t("Send")}</Text>
          </Tap>
        </View>
      </View>
    </KeyboardAvoidingView>
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

type AloneProps = {
  /** The heart has come and gone. */
  onDone: () => void;
};

/**
 * A double tap on a drawing that has one's super like already: the heart
 * comes up again for a moment, and nothing changes (ADR-0193).
 */
export function SuperLikeHeart({ onDone }: AloneProps) {
  // The newest `onDone`, without starting the time again.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const leaving = setTimeout(() => done.current(), HEART_ALONE_MS);
    return () => clearTimeout(leaving);
  }, []);
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.alone} pointerEvents="none">
        <BigHeart />
      </View>
    </Modal>
  );
}

/** The Sgrava heart on its yellow, growing to its size as it comes up. */
function BigHeart() {
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const coming = Animated.timing(shown, {
      toValue: 1,
      duration: HEART_IN_MS,
      // In JS: driven natively, inside the Modal the heart stays unseen
      // (iOS, the new architecture).
      useNativeDriver: false,
    });
    coming.start();
    return () => coming.stop();
  }, [shown]);
  return (
    <Animated.View
      testID="super-like-heart"
      style={{
        opacity: shown,
        transform: [
          {
            scale: shown.interpolate({
              inputRange: [0, 1],
              outputRange: [HEART_FROM, 1],
            }),
          },
        ],
      }}
    >
      <HeartBadge size={BIG_HEART_SIDE} />
    </Animated.View>
  );
}

// Neutral, as every control that is not the route's (docs/UI.md, «Il tema»):
// the yellow is the heart's.
const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backdrop: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  alone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    flexShrink: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    // One physical pixel at the top, as the rows (TASK-339 D).
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: color.surface,
  },
  title: {
    ...font.heading,
    color: color.text,
  },
  field: {
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
  under: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
  },
  muted: {
    flex: 1,
    color: color.textMuted,
    fontSize: fontSize.small,
  },
  problem: {
    flex: 1,
    color: color.error,
    fontSize: fontSize.small,
  },
  count: {
    color: color.textMuted,
    fontSize: fontSize.detail,
  },
  countOver: {
    color: color.error,
  },
  buttons: {
    flexDirection: "row",
    gap: space.sm,
  },
  button: {
    flex: 1,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderStrong,
    backgroundColor: color.surfaceRaised,
  },
  buttonOff: {
    opacity: 0.4,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
});
