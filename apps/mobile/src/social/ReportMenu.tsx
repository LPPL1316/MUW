import {
  type ReportKind,
  type ReportReason,
  REPORT_REASONS,
} from "@shaperoute/shared-types";
import { type ReactNode, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accountProblem, sessionEnded } from "../account/messages";
import type { AccountOutcome } from "../api/accounts";
import { blockMember, report } from "../api/moderation";
import { t, tLater } from "../i18n";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { markBlocked } from "./blockedNow";

/** The reasons as the sheet says them, in English: shown with `t()`. */
export const REASON_TEXTS: Record<ReportReason, string> = {
  spam: tLater("Spam"),
  offensive: tLater("Offensive or hateful"),
  harassment: tLater("Harassment or bullying"),
  sexual: tLater("Nudity or sexual content"),
  other: tLater("Something else"),
};

/** In English: shown with `t()` (TASK-210). */
export const REPORTED = tLater("Thanks for telling us. We will look at it.");
export const BLOCK_EXPLAINED = tLater(
  "You will not see each other's drawings, comments, messages or profile, any follow between you ends and your conversation is deleted. They are not told.",
);

type Failed = Exclude<AccountOutcome<unknown>, { kind: "ok" }>;

/** What the sheet shows. */
type Step =
  | { kind: "closed" }
  | { kind: "menu" }
  | { kind: "reasons" }
  | { kind: "block" }
  | { kind: "sending" }
  | { kind: "said"; words: string };

type Props = {
  /** The API the account talks to (ADR-0031). */
  apiUrl: string;
  token: string;
  /** What «Report» reports: the drawing of a post, or the member. */
  target: { kind: ReportKind; id: string };
  /** Who «Block» blocks: the author of the post, or the member. */
  person: { public_id: string; username: string };
  /** The member is blocked: the page shows it no more. */
  onBlocked?: () => void;
  onSessionEnded: (token: string) => void;
  /** The fake fetch of the tests. */
  fetchFn?: typeof fetch;
  apiKey?: string | null;
};

/** A request about blocking or reporting that failed, in words. */
export function moderationProblem(failed: Failed): string {
  // Gone meanwhile, or an API older than TASK-121.
  if (failed.kind === "api_error" && failed.code === "http_error") {
    return t("This is not available any more.");
  }
  return accountProblem(failed);
}

/**
 * The «…» of a post in «Feed» and of another member's profile (TASK-121,
 * ADR-0228): a small sheet with «Report» and «Block». «Report» asks why,
 * from a short list, and says thanks; the report is kept for whoever runs
 * the app. «Block» asks first, saying what it does; once blocked, the
 * member's cards leave «Feed» at once and `onBlocked` is called.
 */
export function ReportMenu({
  apiUrl,
  token,
  target,
  person,
  onBlocked,
  onSessionEnded,
  fetchFn,
  apiKey,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const close = () => setStep({ kind: "closed" });
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

  function reportFor(reason: ReportReason) {
    setStep({ kind: "sending" });
    void report(apiUrl, token, target.kind, target.id, reason, options).then(
      (outcome) => sent(outcome, () => setStep({ kind: "said", words: t(REPORTED) })),
    );
  }

  function block() {
    setStep({ kind: "sending" });
    void blockMember(apiUrl, token, person.public_id, options).then((outcome) =>
      sent(outcome, () => {
        close();
        markBlocked(person.public_id);
        onBlocked?.();
      }),
    );
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        onPress={() => setStep({ kind: "menu" })}
        accessibilityRole="button"
        accessibilityLabel={t("More")}
        accessibilityHint={t("Report or block")}
        hitSlop={space.sm}
        testID="report-menu"
      >
        <Text style={styles.moreText}>…</Text>
      </Pressable>
      <Modal
        visible={step.kind !== "closed"}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={close}
      >
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessible={false}
          importantForAccessibility="no"
          testID="report-backdrop"
        />
        <Sheet>
          {step.kind === "menu" && (
            <>
              <Choice
                label={t("Report")}
                onPress={() => setStep({ kind: "reasons" })}
              />
              <Choice
                label={t("Block {user}", { user: person.username })}
                onPress={() => setStep({ kind: "block" })}
                danger
              />
            </>
          )}
          {step.kind === "reasons" && (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {t("Why are you reporting this?")}
              </Text>
              {REPORT_REASONS.map((reason) => (
                <Choice
                  key={reason}
                  label={t(REASON_TEXTS[reason])}
                  onPress={() => reportFor(reason)}
                />
              ))}
            </>
          )}
          {step.kind === "block" && (
            <>
              <Text style={styles.title} accessibilityRole="header">
                {t("Block {user}?", { user: person.username })}
              </Text>
              <Text style={styles.words}>{t(BLOCK_EXPLAINED)}</Text>
              <Choice label={t("Block")} onPress={block} danger />
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
      </Modal>
    </>
  );
}

/** The sheet at the foot of the screen, over the phone's home bar. Mounted
 * only while the menu is open. */
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
    <Pressable
      style={({ pressed }) => [styles.choice, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.choiceText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  more: {
    minWidth: MIN_TAP_SIZE,
    minHeight: MIN_TAP_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    color: color.textMuted,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  pressed: {
    opacity: 0.6,
  },
  // Clear, as over the super like: a tap on it closes the sheet.
  backdrop: {
    flex: 1,
  },
  sheet: {
    gap: space.sm,
    padding: space.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  title: {
    color: color.text,
    fontSize: fontSize.input,
    fontWeight: fontWeight.semibold,
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
