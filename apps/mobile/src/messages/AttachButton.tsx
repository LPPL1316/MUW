import { type ReactNode, useRef, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";

export type FileKind = "photo" | "video";
export type AttachKind = FileKind | "drawing";

type Props = {
  /** What the conversation's page offers now; no «+» without any. */
  kinds: readonly AttachKind[];
  disabled: boolean;
  onPick: (kind: AttachKind) => void;
};

/**
 * The «+» beside the box of an open conversation (TASK-333): a sheet with
 * «Photo» and «Video» from the library, as the page of the conversation
 * offers them (a full server leaves the video out), «Drawing» (a favorite
 * or a run of one's own), and «Cancel». On iOS what was chosen opens only
 * once the sheet is really gone (TASK-358): the system's library, shown
 * while a sheet is closing, never comes up. Android has no such wait, and
 * no `onDismiss` to wait for.
 */
export function AttachButton({ kinds, disabled, onPick }: Props) {
  const [open, setOpen] = useState(false);
  // Chosen on iOS, until the sheet has gone.
  const chosen = useRef<AttachKind | null>(null);
  if (kinds.length === 0) {
    return null;
  }

  function pick(kind: AttachKind) {
    setOpen(false);
    if (Platform.OS === "ios") {
      chosen.current = kind;
    } else {
      onPick(kind);
    }
  }

  function dismissed() {
    const kind = chosen.current;
    chosen.current = null;
    if (kind !== null) {
      onPick(kind);
    }
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.plus, (pressed || disabled) && styles.pressed]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t("Add a photo, a video or a drawing")}
        accessibilityState={{ disabled }}
      >
        <Text style={styles.plusText}>+</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
        onDismiss={dismissed}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessible={false}
          importantForAccessibility="no"
          testID="attach-sheet-backdrop"
        />
        <Sheet>
          {kinds.includes("photo") && (
            <Choice label={t("Photo")} onPress={() => pick("photo")} />
          )}
          {kinds.includes("video") && (
            <Choice label={t("Video")} onPress={() => pick("video")} />
          )}
          {kinds.includes("drawing") && (
            <Choice label={t("Drawing")} onPress={() => pick("drawing")} />
          )}
          <Choice label={t("Cancel")} onPress={() => setOpen(false)} />
        </Sheet>
      </Modal>
    </>
  );
}

/** The sheet above the phone's bottom edge: asked only while it is open. */
function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      {children}
    </View>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plus: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.borderStrong,
  },
  plusText: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.medium,
  },
  backdrop: {
    flex: 1,
  },
  // As the sheet of a message (MessageSheet.tsx).
  sheet: {
    gap: space.sm,
    padding: space.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  choice: {
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  choiceText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  pressed: {
    opacity: 0.6,
  },
});
