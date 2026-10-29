import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { duration } from "./attachmentText";
import type { MessageFile } from "./pickMessageMedia";

/** The side of the photo or video waiting to be sent. */
const THUMB_SIDE = 64;

export type DraftStatus = "ready" | "sending" | "failed";

type Props = {
  file: MessageFile;
  text: string;
  status: DraftStatus;
  onText: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
};

/**
 * A photo or a video chosen for a message (TASK-333), in place of the box
 * until it goes: what it is, a text if wanted («Add a message…»), «Send»,
 * and «Cancel». A send that failed stays, and a tap tries again.
 */
export function AttachmentPreview({
  file,
  text,
  status,
  onText,
  onSend,
  onCancel,
}: Props) {
  const sending = status === "sending";
  return (
    <View style={styles.preview}>
      <View style={styles.row}>
        <View style={styles.thumb}>
          {file.kind === "photo" ? (
            <Image
              style={StyleSheet.absoluteFill}
              source={{ uri: file.uri }}
              resizeMode="cover"
              accessibilityLabel={t("Photo")}
            />
          ) : (
            <Text
              style={styles.video}
              accessibilityLabel={t("Video, {duration}", {
                duration: duration(file.durationMs ?? 0),
              })}
            >
              {`▶ ${duration(file.durationMs ?? 0)}`}
            </Text>
          )}
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={onText}
          placeholder={t("Add a message…")}
          placeholderTextColor={color.textFaint}
          multiline
          editable={!sending}
          accessibilityLabel={t("Message")}
        />
      </View>
      {status === "failed" && (
        <Pressable onPress={onSend} accessibilityRole="button" style={styles.again}>
          <Text style={styles.problem} accessibilityRole="alert">
            {t("Couldn't send. Tap to try again.")}
          </Text>
        </Pressable>
      )}
      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || sending) && styles.pressed,
          ]}
          onPress={onCancel}
          disabled={sending}
          accessibilityRole="button"
          accessibilityState={{ disabled: sending }}
        >
          <Text style={styles.buttonText}>{t("Cancel")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || sending) && styles.pressed,
          ]}
          onPress={onSend}
          disabled={sending}
          accessibilityRole="button"
          accessibilityState={{ disabled: sending }}
        >
          <Text style={styles.buttonText}>{sending ? t("Sending…") : t("Send")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    gap: space.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
  },
  thumb: {
    width: THUMB_SIDE,
    height: THUMB_SIDE,
    overflow: "hidden",
    borderRadius: radius.md,
    backgroundColor: color.scrim,
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    color: color.onScrim,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
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
  again: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
  },
  problem: {
    color: color.error,
    fontSize: fontSize.body,
    textAlign: "center",
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
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  buttonText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.6,
  },
});
