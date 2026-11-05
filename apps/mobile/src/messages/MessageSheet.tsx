import {
  type Message,
  type ReportReason,
  REPORT_REASONS,
} from "@shaperoute/shared-types";
import { type ReactNode, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { deleteMessage } from "../api/messages";
import { blockMember, report } from "../api/moderation";
import { t } from "../i18n";
import { markBlocked } from "../social/blockedNow";
import {
  BLOCK_EXPLAINED,
  moderationProblem,
  REASON_TEXTS,
  REPORTED,
} from "../social/ReportMenu";
import {
  color,
  font,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { sayInIsland } from "../ui/IslandLayer";
import { SheetModal } from "../ui/SheetModal";
import { Tap } from "../ui/Tap";

/** What the sheet is about: a message touched long, or blocking who wrote. */
export type SheetFor =
  | { kind: "message"; message: Message }
  | { kind: "block"; person: { public_id: string; username: string } };

/** What the sheet shows. */
type Step =
  | { kind: "first" }
  | { kind: "reasons" }
  | { kind: "sending" }
  | { kind: "said"; words: string };

type Props = {
  apiUrl: string;
  token: string;
  about: SheetFor;
  /** The message is deleted: the conversation shows it no more. */
  onDeleted: (message: Message) => void;
  /** The member is blocked: the conversation is gone. */
  onBlocked: () => void;
  onClose: () => void;
  onSessionEnded: (token: string) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/**
 * The sheet of a conversation (TASK-319, ADR-0279), as the «…» of a post
 * (ReportMenu.tsx): one's own message touched long is deleted for both;
 * the other's is reported, with the reasons of the posts, and only that
 * message reaches whoever runs MuW. «Block» of a request asks first,
 * saying what it does.
 */
export function MessageSheet({
  apiUrl,
  token,
  about,
  onDeleted,
  onBlocked,
  onClose,
  onSessionEnded,
  fetchFn,
  apiKey,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: "first" });
  // Down on its spring first; then `onClose` takes it away (TASK-388 C).
  const [open, setOpen] = useState(true);
  const close = () => setOpen(false);
  const options = { fetchFn, key: apiKey };

  function sent(outcome: AccountOutcome<null>, done: () => void) {
    if (outcome.kind === "ok") {
      done();
      return;
    }
    setStep({ kind: "said", words: moderationProblem(outcome) });
    if (sessionEnded(outcome)) {
      onSessionEnded(token);
    }
  }

  function remove(message: Message) {
    setStep({ kind: "sending" });
    void deleteMessage(apiUrl, token, message.id, options).then((outcome) =>
      sent(outcome, () => {
        onDeleted(message);
        close();
      }),
    );
  }

  function reportFor(message: Message, reason: ReportReason) {
    setStep({ kind: "sending" });
    void report(apiUrl, token, "message", message.id, reason, options).then((outcome) =>
      sent(outcome, () => {
        close();
        sayInIsland(t(REPORTED));
      }),
    );
  }

  function block(person: { public_id: string }) {
    setStep({ kind: "sending" });
    void blockMember(apiUrl, token, person.public_id, options).then((outcome) =>
      sent(outcome, () => {
        markBlocked(person.public_id);
        close();
        onBlocked();
      }),
    );
  }

  return (
    <SheetModal visible={open} onRequestClose={close} onHidden={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessible={false}
        importantForAccessibility="no"
        testID="message-sheet-backdrop"
      />
      <Sheet>
        {step.kind === "first" && about.kind === "message" && about.message.mine && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {t("Delete this message for both of you?")}
            </Text>
            <Choice label={t("Delete")} onPress={() => remove(about.message)} danger />
          </>
        )}
        {step.kind === "first" && about.kind === "message" && !about.message.mine && (
          <Choice
            label={t("Report this message")}
            onPress={() => setStep({ kind: "reasons" })}
          />
        )}
        {step.kind === "reasons" && about.kind === "message" && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {t("Why are you reporting this?")}
            </Text>
            {REPORT_REASONS.map((reason) => (
              <Choice
                key={reason}
                label={t(REASON_TEXTS[reason])}
                onPress={() => reportFor(about.message, reason)}
              />
            ))}
          </>
        )}
        {step.kind === "first" && about.kind === "block" && (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {t("Block {user}?", { user: about.person.username })}
            </Text>
            <Text style={styles.words}>{t(BLOCK_EXPLAINED)}</Text>
            <Choice label={t("Block")} onPress={() => block(about.person)} danger />
          </>
        )}
        {step.kind === "sending" && (
          <Text style={styles.words} accessibilityLiveRegion="polite">
            {t("Sending…")}
          </Text>
        )}
        {step.kind === "said" && (
          <Text style={styles.words} accessibilityLiveRegion="polite">
            {step.words}
          </Text>
        )}
        <Choice
          label={step.kind === "said" ? t("Close") : t("Cancel")}
          onPress={close}
        />
      </Sheet>
    </SheetModal>
  );
}

/** The sheet at the foot of the screen, over the phone's home bar. */
function Sheet({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }]}>
      {children}
    </View>
  );
}

function Choice({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Tap style={styles.choice} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.choiceText, danger && styles.danger]}>{label}</Text>
    </Tap>
  );
}

// As the sheet of ReportMenu.tsx.
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    gap: space.sm,
    padding: space.lg,
    // The app's sheet: its radius, one physical pixel at the top (TASK-339 D).
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.hairline,
    backgroundColor: color.surface,
  },
  title: {
    ...font.heading,
    color: color.text,
  },
  words: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  choice: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
  },
  choiceText: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    textAlign: "center",
  },
  danger: {
    color: color.error,
  },
});
